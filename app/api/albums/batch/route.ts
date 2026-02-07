import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";
import { fetchNeteaseLyrics } from "@/lib/netease-lyrics";

type AlbumInput = {
  imageUrl: string;
  albumName: string;
  artistName?: string | null;
  /** 网易云歌曲 ID，传入则按这首歌拉取歌词并写入 */
  songId?: string | null;
  /** 歌曲名（与 songId 配套，用于展示「导入的是哪一首」） */
  songName?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const albums = body?.albums;
    const categoryId = body?.categoryId ?? null;
    if (!Array.isArray(albums) || albums.length === 0) {
      return NextResponse.json(
        { error: "请提供 albums 数组（每项含 imageUrl、albumName）" },
        { status: 400 }
      );
    }

    const apiBase = process.env.NETEASE_API_URL?.trim();
    const created: { id: string }[] = [];

    for (const a of albums as AlbumInput[]) {
      const imageUrl = a?.imageUrl?.trim();
      const albumName = a?.albumName?.trim();
      if (!imageUrl || !albumName) continue;

      let lyrics: string | null = null;
      const songId = a?.songId?.trim() || null;
      const songName = a?.songName?.trim() || null;
      if (songId && apiBase) {
        lyrics = await fetchNeteaseLyrics(apiBase, songId);
        if (!lyrics) lyrics = null;
      }

      const item = await withDbRetry(() =>
        prisma.albumCover.create({
          data: {
            imageUrl,
            albumName,
            artistName: a?.artistName ?? null,
            songId: songId || null,
            songName: songName || null,
            lyrics,
            categoryId: categoryId || null,
          },
        })
      );
      created.push({ id: item.id });
    }

    return NextResponse.json({ created: created.length, ids: created.map((c) => c.id) });
  } catch (error) {
    console.error("Batch create albums error:", error);
    return NextResponse.json(
      { error: "批量保存失败" },
      { status: 500 }
    );
  }
}
