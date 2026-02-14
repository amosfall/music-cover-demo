import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserIdOr401 } from "@/lib/auth";
import { withDbRetry } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const authResult = await getUserIdOr401();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json().catch(() => ({}));
    const categoryId = body.categoryId;

    const result = await withDbRetry(async () => {
      let where: any = { userId: authResult.userId };
      
      // 如果指定了 categoryId 且不是 "all"，则只删除该分类下的专辑
      if (categoryId && categoryId !== "all") {
        // 检查是否为 Default 分类
        const defaultCat = await prisma.category.findFirst({
          where: { name: "Default", userId: authResult.userId },
        });
        
        if (defaultCat && categoryId === defaultCat.id) {
          // 如果是 Default 分类，同时删除 categoryId 为该 ID 和 null 的记录
          where = {
            userId: authResult.userId,
            OR: [
              { categoryId: categoryId },
              { categoryId: null }
            ]
          };
        } else {
          where.categoryId = categoryId;
        }
      }

      const deleted = await prisma.albumCover.deleteMany({ where });
      return { deleted: deleted.count };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Clear albums error:", error);
    return NextResponse.json(
      { error: "清除失败，请稍后重试" },
      { status: 500 }
    );
  }
}
