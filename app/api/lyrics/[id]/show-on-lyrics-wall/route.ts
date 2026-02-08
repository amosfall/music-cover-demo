import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";
import { getUserIdOr401 } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/lyrics/[id]/show-on-lyrics-wall
 * Body: { showOnLyricsWall: boolean }
 * 仅更新「是否在歌词墙展示」，避免完整 PUT 的校验影响。
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await getUserIdOr401();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;
    let body: { showOnLyricsWall?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求体需为 JSON" }, { status: 400 });
    }
    const showOnLyricsWall = body?.showOnLyricsWall;
    if (typeof showOnLyricsWall !== "boolean") {
      return NextResponse.json(
        { error: "请提供 showOnLyricsWall: true | false" },
        { status: 400 }
      );
    }
    const updated = await withDbRetry(() =>
      prisma.lyricsCard.update({
        where: { id, userId: authResult.userId },
        data: { showOnLyricsWall },
      })
    );
    return NextResponse.json({ success: true, showOnLyricsWall: updated.showOnLyricsWall });
  } catch (e) {
    const msg = (e as Error)?.message ?? "";
    if (msg.includes("Record to update not found") || msg.includes("record not found")) {
      return NextResponse.json({ error: "未找到该歌词卡" }, { status: 404 });
    }
    console.error("[lyrics show-on-lyrics-wall]", e);
    return NextResponse.json(
      { error: msg || "更新失败" },
      { status: 500 }
    );
  }
}
