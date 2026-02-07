import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";

/**
 * POST /api/albums/clear-except-first
 * 一键清除：删除所有专辑封面（不保留）
 */
export async function POST() {
  try {
    const result = await withDbRetry(async () => {
      const deleted = await prisma.albumCover.deleteMany({});
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
