"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";

export type ClaimResult =
  | { ok: true; claimed: { albums: number; categories: number; lyrics: number } }
  | { ok: false; error: string };

/**
 * 将当前库中所有 userId 为 null 的专辑、分类、歌词卡认领到当前登录用户。
 * 登录后首次进入专辑页时调用一次即可，幂等（无匿名数据时不会改任何行）。
 */
export async function claimAnonymousData(): Promise<ClaimResult> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, error: "请先登录后再认领数据" };
  }

  try {
    const result = await withDbRetry(async () => {
      const [albumsResult, categoriesResult, lyricsResult] = await Promise.all([
        prisma.albumCover.updateMany({
          where: { userId: null },
          data: { userId },
        }),
        prisma.category.updateMany({
          where: { userId: null },
          data: { userId },
        }),
        prisma.lyricsCard.updateMany({
          where: { userId: null },
          data: { userId },
        }),
      ]);

      return {
        albums: albumsResult.count,
        categories: categoriesResult.count,
        lyrics: lyricsResult.count,
      };
    });

    revalidatePath("/albums");
    revalidatePath("/lyrics");
    revalidatePath("/lyrics-wall");
    return {
      ok: true,
      claimed: result,
    };
  } catch (err) {
    console.error("claimAnonymousData failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "认领失败，请稍后重试",
    };
  }
}
