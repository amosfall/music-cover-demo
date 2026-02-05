import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";

export async function GET() {
  try {
    const items = await withDbRetry(() =>
      prisma.lyricsCard.findMany({
        orderBy: { createdAt: "desc" },
      })
    );
    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch lyrics:", error);
    return NextResponse.json(
      { error: "获取歌词列表失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lyrics, albumName, artistName, imageUrl } = body;

    if (!lyrics?.trim() || !albumName?.trim() || !imageUrl?.trim()) {
      return NextResponse.json(
        { error: "歌词、专辑名和封面图不能为空" },
        { status: 400 }
      );
    }

    const item = await withDbRetry(() =>
      prisma.lyricsCard.create({
        data: {
          lyrics: lyrics.trim(),
          albumName: albumName.trim(),
          artistName: artistName?.trim() || null,
          imageUrl: imageUrl.trim(),
        },
      })
    );

    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to create lyrics card:", error);
    return NextResponse.json(
      { error: "保存失败" },
      { status: 500 }
    );
  }
}
