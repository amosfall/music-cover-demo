import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";

export const dynamic = "force-dynamic";

export type WallItem = {
  id: string;
  lyrics: string;
  songName: string | null;
  albumName: string;
  artistName: string | null;
  imageUrl: string;
  source: "album" | "card";
  showOnLyricsWall: boolean;
};

export async function GET() {
  try {
    // 从 AlbumCover 取有歌词的条目
    const albums = await withDbRetry(() =>
      prisma.albumCover.findMany({
        where: { lyrics: { not: null } },
        orderBy: { createdAt: "desc" },
      })
    );

    // 从 LyricsCard 取所有条目
    const cards = await withDbRetry(() =>
      prisma.lyricsCard.findMany({
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
