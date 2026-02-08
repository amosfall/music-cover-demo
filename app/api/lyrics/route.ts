import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry, isDbConnectionError } from "@/lib/db";
import { getUserIdOr401, getUserIdOrNull } from "@/lib/auth";

export async function GET() {
  try {
    const userId = await getUserIdOrNull();
    const userFilter = userId ? { userId } : { userId: null };
    const items = await withDbRetry(() =>
      prisma.lyricsCard.findMany({
        where: userFilter,
        orderBy: { createdAt: "desc" },
      })
    );
    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch lyrics:", error);
    return NextResponse.json(
      { error: "获取歌词列表失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authResult = await getUserIdOr401();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { lyrics, albumName, artistName, imageUrl, songName } = body;

    if (!lyrics?.trim() || !albumName?.trim() || !imageUrl?.trim()) {
      return NextResponse.json(
        { error: "歌词、专辑名和封面图不能为空" },
        { status: 400 }
      );
    }

    const item = await withDbRetry(() =>
      prisma.lyricsCard.create({
        data: {
          lyrics: lyrics.trim(),
          albumName: albumName.trim(),
          artistName: artistName?.trim() || null,
          imageUrl: imageUrl.trim(),
          songName: songName?.trim() || null,
          userId: authResult.userId,
        },
      })
    );

    return NextResponse.json(item);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Failed to create lyrics card:", error);
    const isDb = isDbConnectionError(error) || /relation.*does not exist|table.*lyrics/i.test(msg);
    const hint = isDb
      ? "请确认生产环境已执行 npx prisma db push，且 DATABASE_URL 为 Neon Pooled 连接串。"
      : undefined;
    return NextResponse.json(
      { error: "保存失败", hint, detail: process.env.NODE_ENV === "development" ? msg : undefined },
      { status: 500 }
    );
  }
}
