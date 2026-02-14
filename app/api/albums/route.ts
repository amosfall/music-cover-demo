import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";
import { getUserIdOrNull, getUserIdOr401 } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdOrNull();
    const userFilter = userId ? { userId } : { userId: null };

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");
    const scope = searchParams.get("scope");

    const items = await withDbRetry(async () => {
      let where: Record<string, unknown> = {};

      if (scope === "public") {
        // 公共区域：获取所有专辑（不筛选 userId），限制数量防止过载
        // 如果需要可以加过滤条件比如 isPublic: true，目前直接返回所有
        return prisma.albumCover.findMany({
          where: {},
          orderBy: { createdAt: "desc" },
          take: 100, // 限制最新 100 条
        });
      }

      // 个人区域：必须筛选 userId
      where = { ...userFilter };
      
      if (categoryId && categoryId !== "all") {
        const defaultCat = await prisma.category.findFirst({
          where: { name: "Default", ...userFilter },
        });
        if (defaultCat && categoryId === defaultCat.id) {
          where = { ...userFilter, OR: [{ categoryId: categoryId }, { categoryId: null }] };
        } else {
          where = { ...userFilter, categoryId };
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
  const authResult = await getUserIdOr401();
  if (authResult instanceof NextResponse) return authResult;

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
          userId: authResult.userId,
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

