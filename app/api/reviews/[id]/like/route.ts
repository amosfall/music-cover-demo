import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";
import { getUserIdOr401 } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await getUserIdOr401();
  if (authResult instanceof NextResponse) return authResult;

  const { id: reviewId } = await params;

  try {
    const result = await withDbRetry(async () => {
      // 检查是否已点赞
      const existingLike = await prisma.reviewLike.findUnique({
        where: {
          reviewId_userId: {
            reviewId,
            userId: authResult.userId,
          },
        },
      });

      if (existingLike) {
        // 取消点赞
        await prisma.$transaction([
          prisma.reviewLike.delete({
            where: { id: existingLike.id },
          }),
          prisma.albumReview.update({
            where: { id: reviewId },
            data: { likes: { decrement: 1 } },
          }),
        ]);
        return { liked: false };
      } else {
        // 点赞
        await prisma.$transaction([
          prisma.reviewLike.create({
            data: {
              reviewId,
              userId: authResult.userId,
            },
          }),
          prisma.albumReview.update({
            where: { id: reviewId },
            data: { likes: { increment: 1 } },
          }),
        ]);
        return { liked: true };
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Toggle like failed:", error);
    return NextResponse.json(
      { error: "操作失败，请稍后重试" },
      { status: 500 }
    );
  }
}
