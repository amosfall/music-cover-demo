import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const item = await prisma.albumCover.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ error: "未找到" }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to fetch album:", error);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { imageUrl, albumName, artistName, releaseYear, genre, notes } = body;

    const item = await prisma.albumCover.update({
      where: { id },
      data: {
        ...(imageUrl && { imageUrl }),
        ...(albumName && { albumName }),
        ...(artistName !== undefined && { artistName }),
        ...(releaseYear !== undefined && { releaseYear }),
        ...(genre !== undefined && { genre }),
        ...(notes !== undefined && { notes }),
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to update album:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.albumCover.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete album:", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
