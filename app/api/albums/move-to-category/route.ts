import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";
import { getUserIdOr401 } from "@/lib/auth";

/** 批量将专辑移入目标分类 */
export async function POST(request: NextRequest) {
  const authResult = await getUserIdOr401();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { albumIds, targetCategoryId } = body as {
      albumIds?: string[];
      targetCategoryId?: string;
    };
    if (!Array.isArray(albumIds) || albumIds.length === 0 || !targetCategoryId) {
      return NextResponse.json(
        { error: "需要提供 albumIds 和 targetCategoryId" },
        { status: 400 }
      );
    }

    const result = await withDbRetry(async () => {
      const updated = await prisma.albumCover.updateMany({
        where: { id: { in: albumIds }, userId: authResult.userId },
        data: { categoryId: targetCategoryId },
      });
      return updated;
    });

    console.log("[move-to-category] Moved", result.count, "albums to", targetCategoryId);
    return NextResponse.json({ moved: result.count, ids: albumIds });
  } catch (error) {
    console.error("[move-to-category] Failed:", error);
    return NextResponse.json(
      { error: "移动失败" },
      { status: 500 }
    );
  }
}
