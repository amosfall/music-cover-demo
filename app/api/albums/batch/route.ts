import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";

type AlbumInput = { imageUrl: string; albumName: string; artistName?: string | null };

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

    const created: { id: string }[] = [];
    for (const a of albums as AlbumInput[]) {
      const imageUrl = a?.imageUrl?.trim();
      const albumName = a?.albumName?.trim();
      if (!imageUrl || !albumName) continue;
      const item = await withDbRetry(() =>
        prisma.albumCover.create({
          data: {
            imageUrl,
            albumName,
            artistName: a?.artistName ?? null,
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
