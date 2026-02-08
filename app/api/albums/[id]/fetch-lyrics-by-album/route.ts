import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";
import {
  fetchNeteaseLyrics,
  getFirstTrackFromAlbum,
} from "@/lib/netease-lyrics";
import { getUserIdOr401 } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/albums/[id]/fetch-lyrics-by-album
 * Body: { albumId: string } 网易云专辑 ID（可从专辑链接 ?id=xxx 里取）
 * 用于早期没有 albumId 的收藏：手动传入专辑 ID，按专辑拉取第一首歌词并更新本条。
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await getUserIdOr401();
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const apiBase = process.env.NETEASE_API_URL?.trim();
  if (!apiBase) {
    return NextResponse.json(
      { error: "请先配置 NETEASE_API_URL" },
      { status: 503 }
    );
  }

  let body: { albumId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "请提供 body: { albumId: \"专辑ID\" }" },
      { status: 400 }
    );
  }

  const albumId = body.albumId?.trim();
  if (!albumId) {
    return NextResponse.json(
      { error: "请提供 albumId（网易云专辑链接中的 id）" },
      { status: 400 }
    );
  }

  try {
    const item = await prisma.albumCover.findFirst({ where: { id, userId: authResult.userId } });
    if (!item) {
      return NextResponse.json({ error: "未找到该收藏" }, { status: 404 });
    }

    const track = await getFirstTrackFromAlbum(apiBase, albumId);
    if (!track) {
      return NextResponse.json(
        { error: "无法获取该专辑曲目，请检查专辑 ID 或 API" },
        { status: 502 }
      );
    }

    const lyrics = await fetchNeteaseLyrics(apiBase, track.songId);
    if (!lyrics) {
      return NextResponse.json(
        { error: "该曲目暂无歌词或拉取失败" },
        { status: 502 }
      );
    }

    await withDbRetry(() =>
      prisma.albumCover.update({
        where: { id, userId: authResult.userId },
        data: {
          lyrics,
          songId: track.songId,
          songName: track.songName,
          albumId, // 顺便写入，下次批量补全也可用
        },
      })
    );

    return NextResponse.json({
      success: true,
      message: "已按专辑拉取歌词并更新",
    });
  } catch (e) {
    console.error("[fetch-lyrics-by-album]", e);
    return NextResponse.json(
      { error: (e as Error)?.message ?? "拉取失败" },
      { status: 500 }
    );
  }
}
