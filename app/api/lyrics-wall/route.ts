import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";
import { getUserIdOrNull } from "@/lib/auth";

export const dynamic = "force-dynamic";

export type WallItem = {
  id: string;
  lyrics: string;
  songName: string | null;
  albumName: string;
  artistName: string | null;
  releaseYear: string | null;
  imageUrl: string;
  source: "album" | "card";
  showOnLyricsWall: boolean;
};

export async function GET() {
  const userId = await getUserIdOrNull();
  // 未登录时展示默认数据（userId 为 null 的旧数据）；已登录时只展示当前用户数据
  const userFilter = userId ? { userId } : { userId: null };

  try {
    const albums = await withDbRetry(() =>
      prisma.albumCover.findMany({
        where: { lyrics: { not: null }, ...userFilter },
        orderBy: { createdAt: "desc" },
      })
    );

    const cards = await withDbRetry(() =>
      prisma.lyricsCard.findMany({
        where: userFilter,
        orderBy: { createdAt: "desc" },
      })
    );

    const result: WallItem[] = [];

    for (const a of albums) {
      if (a.lyrics) {
        result.push({
          id: a.id,
          lyrics: a.lyrics,
          songName: a.songName ?? null,
          albumName: a.albumName,
          artistName: a.artistName,
          releaseYear: a.releaseYear ?? null,
          imageUrl: a.imageUrl,
          source: "album",
          showOnLyricsWall: a.showOnLyricsWall,
        });
      }
    }

    for (const c of cards) {
      result.push({
        id: c.id,
        lyrics: c.lyrics,
        songName: null,
        albumName: c.albumName,
        artistName: c.artistName,
        releaseYear: null,
        imageUrl: c.imageUrl,
        source: "card",
        showOnLyricsWall: c.showOnLyricsWall,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch lyrics wall data:", error);
    return NextResponse.json(
      { error: "获取歌词墙数据失败" },
      { status: 500 }
    );
  }
}
