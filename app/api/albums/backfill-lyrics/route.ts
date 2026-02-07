import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";
import {
  fetchNeteaseLyrics,
  getFirstTrackFromAlbum,
} from "@/lib/netease-lyrics";

export const dynamic = "force-dynamic";

/**
 * POST /api/albums/backfill-lyrics
 * 为「我的收藏」里没有歌词的条目补拉歌词（支持有 songId 或 有 albumId 的「按专辑再拉一次」）。
 * 需要配置 NETEASE_API_URL。
 */
export async function POST() {
  const apiBase = process.env.NETEASE_API_URL?.trim();
  if (!apiBase) {
    return NextResponse.json(
      { error: "请先配置 NETEASE_API_URL（与封面抓取相同）" },
      { status: 503 }
    );
  }

  try {
    // 1. 无歌词但有 songId：直接按歌曲拉歌词
    const bySong = await withDbRetry(() =>
      prisma.albumCover.findMany({
        where: {
          lyrics: null,
          songId: { not: null },
        },
        select: { id: true, songId: true },
      })
    );

    let updatedBySong = 0;
    for (const row of bySong) {
      const songId = row.songId?.trim();
      if (!songId) continue;
      const lyrics = await fetchNeteaseLyrics(apiBase, songId);
      if (!lyrics) continue;
      await withDbRetry(() =>
        prisma.albumCover.update({
          where: { id: row.id },
          data: { lyrics },
        })
      );
      updatedBySong += 1;
    }

    // 2. 无歌词但有 albumId：按专辑再拉一次（取专辑第一首的歌词）
    const byAlbum = await withDbRetry(() =>
      prisma.albumCover.findMany({
        where: {
          lyrics: null,
          albumId: { not: null },
        },
        select: { id: true, albumId: true },
      })
    );

    let updatedByAlbum = 0;
    for (const row of byAlbum) {
      const albumId = row.albumId?.trim();
      if (!albumId) continue;
      const track = await getFirstTrackFromAlbum(apiBase, albumId);
      if (!track) continue;
      const lyrics = await fetchNeteaseLyrics(apiBase, track.songId);
      if (!lyrics) continue;
      await withDbRetry(() =>
        prisma.albumCover.update({
          where: { id: row.id },
          data: {
            lyrics,
            songId: track.songId,
            songName: track.songName,
          },
        })
      );
      updatedByAlbum += 1;
    }

    const totalUpdated = updatedBySong + updatedByAlbum;
    const totalCandidates = bySong.length + byAlbum.length;

    return NextResponse.json({
      totalBySong: bySong.length,
      updatedBySong,
      totalByAlbum: byAlbum.length,
      updatedByAlbum,
      total: totalCandidates,
      updated: totalUpdated,
      message:
        totalUpdated > 0
          ? `已为 ${totalUpdated} 条收藏补全歌词（其中按专辑拉取 ${updatedByAlbum} 条），可到歌词墙查看`
          : totalCandidates === 0
            ? "没有需要补全的收藏（无歌词且无 songId/albumId 的条目为 0）"
            : "未拉取到新歌词（可能 API 无返回或网络问题）",
    });
  } catch (e) {
    console.error("[backfill-lyrics]", e);
    return NextResponse.json(
      { error: (e as Error)?.message ?? "补全歌词失败" },
      { status: 500 }
    );
  }
}
