import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * 获取当前登录用户的 Clerk userId。
 * 若未登录则返回 401 响应，用于写操作拦截。
 */
export async function getUserIdOr401(): Promise<
  { userId: string } | NextResponse
> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "未授权，请先登录" }, { status: 401 });
  }
  return { userId };
}

/**
 * 获取当前登录用户的 Clerk userId，未登录返回 null。
 * 用于读操作：可根据 null 展示空状态或重定向。
 */
export async function getUserIdOrNull(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}
