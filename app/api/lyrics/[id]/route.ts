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
    const { lyrics, albumName, artistName, imageUrl, showOnLyricsWall } = body;

    const updateData: Record<string, unknown> = {};
    if (lyrics !== undefined) updateData.lyrics = lyrics?.trim() ?? "";
    if (albumName !== undefined) updateData.albumName = albumName?.trim() ?? "";
    if (artistName !== undefined) updateData.artistName = artistName?.trim() || null;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl?.trim() ?? "";
    if (showOnLyricsWall !== undefined) updateData.showOnLyricsWall = Boolean(showOnLyricsWall);

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "未提供可更新字段" }, { status: 400 });
    }
    const isContentUpdate = "lyrics" in updateData || "albumName" in updateData || "imageUrl" in updateData;
    if (isContentUpdate && (!lyrics?.trim() || !albumName?.trim() || !imageUrl?.trim())) {
      return NextResponse.json(
        { error: "歌词、专辑名和封面图不能为空" },
        { status: 400 }
      );
    }

    const item = await withDbRetry(() =>
      prisma.lyricsCard.update({
        where: { id },
        data: updateData as Parameters<typeof prisma.lyricsCard.update>[0]["data"],
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
