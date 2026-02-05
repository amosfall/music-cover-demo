import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const items = await prisma.albumCover.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch albums:", error);
    return NextResponse.json(
      { error: "获取专辑列表失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl, albumName, artistName, releaseYear, genre, notes } = body;

    if (!imageUrl || !albumName) {
      return NextResponse.json(
        { error: "封面图片和专辑名不能为空" },
        { status: 400 }
      );
    }

    const item = await prisma.albumCover.create({
      data: {
        imageUrl,
        albumName,
        artistName: artistName ?? null,
        releaseYear: releaseYear ?? null,
        genre: genre ?? null,
        notes: notes ?? null,
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to create album:", error);
    return NextResponse.json(
      { error: "保存失败" },
      { status: 500 }
    );
  }
}
