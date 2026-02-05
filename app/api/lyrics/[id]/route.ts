import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await withDbRetry(() =>
      prisma.lyricsCard.delete({ where: { id } })
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete lyrics card:", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
