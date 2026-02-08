import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";
import { getUserIdOr401 } from "@/lib/auth";

/**
 * POST /api/albums/clear-except-first
 * 一键清除：删除当前用户所有专辑封面（不保留）
 */
export async function POST() {
  const authResult = await getUserIdOr401();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const result = await withDbRetry(async () => {
      const deleted = await prisma.albumCover.deleteMany({ where: { userId: authResult.userId } });
      return { deleted: deleted.count };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Clear all albums failed:", error);
    return NextResponse.json(
      { error: "一键清除失败" },
      { status: 500 }
    );
  }
}
