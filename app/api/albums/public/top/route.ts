import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";

export const dynamic = "force-dynamic";

type TopAlbum = {
  albumName: string;
  artistName: string | null;
  imageUrl: string;
  pickCount: number;
  avgRating: number;
  reviewCount: number;
};

export async function GET() {
  try {
    // 1. 聚合 AlbumCover 表，找出出现次数最多的专辑
    // Prisma 的 groupBy 目前支持 count
    const topPicks = await withDbRetry(() =>
      prisma.albumCover.groupBy({
        by: ["albumName", "artistName"],
        _count: {
          _all: true,
        },
        orderBy: {
          _count: {
            albumName: "desc", // 按数量降序
          },
        },
        take: 20,
      })
    );

    // 2. 对于这 20 张专辑，还需要：
    //    - 找一张封面图 (imageUrl)
    //    - 找评论平均分 (avgRating)
    //    - 找评论数 (reviewCount)
    
    const result: TopAlbum[] = [];

    for (const item of topPicks) {
      const albumName = item.albumName;
      const artistName = item.artistName; // 可能为 null

      // 找封面：取第一张非空的
      const cover = await prisma.albumCover.findFirst({
        where: {
          albumName,
          ...(artistName ? { artistName } : {}),
          imageUrl: { not: "" },
        },
        select: { imageUrl: true },
      });

      // 找评分聚合
      const reviewAgg = await prisma.albumReview.aggregate({
        where: {
          albumName,
          ...(artistName ? { artistName } : {}),
        },
        _avg: { rating: true },
        _count: { _all: true },
      });

      result.push({
        albumName,
        artistName,
        imageUrl: cover?.imageUrl || "",
        pickCount: item._count._all,
        avgRating: reviewAgg._avg.rating || 0,
        reviewCount: reviewAgg._count._all,
      });
    }

    // 再次按 pickCount 排序（groupBy 已经排了，但为了保险），也可以按 avgRating 综合排序
    result.sort((a, b) => b.pickCount - a.pickCount);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Fetch top albums failed:", error);
    return NextResponse.json({ error: "Failed to fetch top albums" }, { status: 500 });
  }
}
