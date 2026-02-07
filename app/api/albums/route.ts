import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");

    const items = await withDbRetry(async () => {
      let where: { categoryId?: string | null; OR?: { categoryId: string | null }[] } = {};
      if (categoryId && categoryId !== "all") {
        const defaultCat = await prisma.category.findFirst({
          where: { name: "Default" },
        });
        if (defaultCat && categoryId === defaultCat.id) {
          where = { OR: [{ categoryId: categoryId }, { categoryId: null }] };
        } else {
          where = { categoryId };
        }
      }
      return prisma.albumCover.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });
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
    const { imageUrl, albumName, artistName, releaseYear, genre, notes, categoryId } = body;

    if (!imageUrl || !albumName) {
      return NextResponse.json(
        { error: "封面图片和专辑名不能为空" },
        { status: 400 }
      );
    }

    const item = await withDbRetry(() =>
      prisma.albumCover.create({
        data: {
          imageUrl,
          albumName,
          artistName: artistName ?? null,
          releaseYear: releaseYear ?? null,
          genre: genre ?? null,
          notes: notes ?? null,
          categoryId: categoryId || null,
        },
      })
    );

    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to create album:", error);
    return NextResponse.json(
      { error: "保存失败" },
      { status: 500 }
    );
  }
}

