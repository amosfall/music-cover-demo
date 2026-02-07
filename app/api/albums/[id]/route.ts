import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";

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
  const { id } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch (parseErr) {
    console.error("[albums PUT] 解析 body 失败:", parseErr);
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  const { imageUrl, albumName, artistName, releaseYear, genre, notes, categoryId } = body;
  console.log("[albums PUT] 收到请求:", { id, bodyKeys: Object.keys(body), categoryId });

  try {
    const updateData: Record<string, unknown> = {};
    if (imageUrl) updateData.imageUrl = imageUrl;
    if (albumName) updateData.albumName = albumName;
    if (artistName !== undefined) updateData.artistName = artistName;
    if (releaseYear !== undefined) updateData.releaseYear = releaseYear;
    if (genre !== undefined) updateData.genre = genre;
    if (notes !== undefined) updateData.notes = notes;
    if (categoryId !== undefined) updateData.categoryId = categoryId || null;

    const item = await withDbRetry(() =>
      prisma.albumCover.update({
        where: { id },
        data: updateData as Parameters<typeof prisma.albumCover.update>[0]["data"],
      })
    );

    console.log("[albums PUT] Prisma 更新成功:", { id, categoryId: item.categoryId, albumName: item.albumName });
    return NextResponse.json(item);
  } catch (error) {
    console.error("[albums PUT] 更新失败:", { id, error, message: (error as Error)?.message });
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
