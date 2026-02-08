import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";
import { getUserIdOr401 } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await getUserIdOr401();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;
    const body = await request.json();
    const name = (body?.name as string)?.trim();
    if (!name) {
      return NextResponse.json(
        { error: "分类名称不能为空" },
        { status: 400 }
      );
    }
    const category = await withDbRetry(() =>
      prisma.category.update({
        where: { id, userId: authResult.userId },
        data: { name },
      })
    );
    return NextResponse.json(category);
  } catch (error) {
    console.error("Failed to update category:", error);
    return NextResponse.json(
      { error: "重命名失败" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await getUserIdOr401();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;

    await withDbRetry(async () => {
      await prisma.albumCover.updateMany({
        where: { categoryId: id, userId: authResult.userId },
        data: { categoryId: null },
      });
      await prisma.category.delete({
        where: { id, userId: authResult.userId },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete category:", error);
    return NextResponse.json(
      { error: "删除分类失败" },
      { status: 500 }
    );
  }
}
