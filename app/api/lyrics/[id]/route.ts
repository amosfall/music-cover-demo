import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { lyrics, albumName, artistName, imageUrl } = body;

    if (!lyrics?.trim() || !albumName?.trim() || !imageUrl?.trim()) {
      return NextResponse.json(
        { error: "歌词、专辑名和封面图不能为空" },
        { status: 400 }
      );
    }

    const item = await withDbRetry(() =>
      prisma.lyricsCard.update({
        where: { id },
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
    console.error("Failed to update lyrics card:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await withDbRetry(() =>
      prisma.lyricsCard.delete({ where: { id } })
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete lyrics card:", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
