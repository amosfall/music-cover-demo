import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";

const DEFAULT_KEEP = 4;

/**
 * POST /api/albums/clear-except-first
 * 保留最早添加的 N 张专辑，删除其余
 * Body: { keep?: number } 默认 4
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { keep?: number };
    const keep = Math.max(1, Math.min(20, body?.keep ?? DEFAULT_KEEP));

    const result = await withDbRetry(async () => {
      const toKeep = await prisma.albumCover.findMany({
        orderBy: { createdAt: "asc" },
        take: keep,
        select: { id: true },
      });
      const keepIds = toKeep.map((a) => a.id);

      const deleted = await prisma.albumCover.deleteMany({
        where: { id: { notIn: keepIds } },
      });

      return { kept: keepIds.length, deleted: deleted.count };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Clear except first failed:", error);
    return NextResponse.json(
      { error: "一键清除失败" },
      { status: 500 }
    );
  }
}
