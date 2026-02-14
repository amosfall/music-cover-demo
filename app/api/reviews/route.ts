import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";
import { getUserIdOr401 } from "@/lib/auth";
import { clerkClient } from "@clerk/nextjs/server";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const albumName = searchParams.get("albumName");
  const artistName = searchParams.get("artistName");

  if (!albumName) {
    return NextResponse.json({ error: "Missing albumName" }, { status: 400 });
  }

  try {
    // 1. 获取当前用户（用于判断是否点赞）
    const { userId: currentUserId } = await auth();

    // 2. 获取评论列表，按点赞数降序，其次按时间降序
    const reviews = await withDbRetry(() =>
      prisma.albumReview.findMany({
        where: {
          albumName,
          ...(artistName ? { artistName } : {}),
        },
        orderBy: [
          { likes: "desc" },
          { createdAt: "desc" }
        ],
        take: 50,
        include: {
          likedBy: currentUserId ? {
            where: { userId: currentUserId },
            select: { id: true }
          } : false
        }
      })
    );

    // 3. 收集所有需要查询的用户 ID
    const userIds = [...new Set(reviews.map(r => r.userId))];

    // 4. 批量获取 Clerk 用户信息
    let usersMap: Record<string, { username: string; imageUrl: string }> = {};
    if (userIds.length > 0) {
      try {
        const client = await clerkClient();
        const usersList = await client.users.getUserList({
          userId: userIds,
          limit: 100,
        });
        
        usersList.data.forEach(user => {
          usersMap[user.id] = {
            username: user.username || user.firstName || "匿名用户",
            imageUrl: user.imageUrl
          };
        });
      } catch (err) {
        console.error("Failed to fetch Clerk users:", err);
      }
    }

    // 5. 组合数据
    const result = reviews.map(r => ({
      ...r,
      user: usersMap[r.userId] || { username: "未知用户", imageUrl: "" },
      isLiked: r.likedBy && r.likedBy.length > 0
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Fetch reviews failed:", error);
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await getUserIdOr401();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { albumName, artistName, rating, content } = body;

    if (!albumName || typeof rating !== "number") {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 每个人对每张专辑（专辑名+歌手名）只能评一次？或者允许追评？
    // 这里简单起见，允许发多条，但通常是 upsert。这里先做成 create。
    const review = await withDbRetry(() =>
      prisma.albumReview.create({
        data: {
          albumName,
          artistName: artistName || null,
          rating: Math.max(1, Math.min(5, rating)),
          content: content?.trim() || null,
          userId: authResult.userId,
        },
      })
    );

    return NextResponse.json(review);
  } catch (error) {
    console.error("Create review failed:", error);
    return NextResponse.json({ error: "Failed to post review" }, { status: 500 });
  }
}
