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
    // 修正：artistName 可能為 null 或空字符串，這會導致同一張專輯被分開統計
    // 這裡我們需要更複雜的邏輯：先取出所有數據，然後在內存中聚合
    
    // 為了性能，我們還是先用 groupBy，但後續在內存中做二次合併
    const rawGroups = await withDbRetry(() =>
      prisma.albumCover.groupBy({
        by: ["albumName", "artistName"],
        _count: {
          _all: true,
        },
        // 取更多數據以確保合併後能湊夠 20 條
        take: 100,
        orderBy: {
          _count: {
            albumName: "desc",
          },
        },
      })
    );

    // 內存合併邏輯
    const mergedMap = new Map<string, {
      albumName: string;
      artistName: string | null;
      count: number;
    }>();

    for (const item of rawGroups) {
      // 規範化 key：移除空格，忽略大小寫
      // 這裡簡單處理：如果有 artistName，則作為 key 的一部分
      // 如果 artistName 缺失，嘗試歸類到已有同名專輯
      
      const normalizedAlbumName = item.albumName.trim();
      const normalizedArtistName = item.artistName?.trim() || "";
      
      // 簡單策略：完全匹配 "Album||Artist"
      // 但為了解決 "神的游戏" (Artist: 张悬) 和 "神的游戏" (Artist: null) 的問題
      // 我們可以嘗試：如果 artistName 為空，看看是否已有同名專輯
      
      let key = `${normalizedAlbumName}||${normalizedArtistName}`;
      
      // 嘗試查找是否已有同名專輯但有藝人名的記錄
      if (!normalizedArtistName) {
         for (const existingKey of mergedMap.keys()) {
             if (existingKey.startsWith(`${normalizedAlbumName}||`) && existingKey.length > normalizedAlbumName.length + 2) {
                 key = existingKey; // 合併到那條有藝人名的記錄
                 break;
             }
         }
      } else {
         // 如果當前有藝人名，檢查是否已有一條同名但無藝人名的記錄，將其合併過來
         const noArtistKey = `${normalizedAlbumName}||`;
         if (mergedMap.has(noArtistKey)) {
             const noArtistData = mergedMap.get(noArtistKey)!;
             // 將無藝人名的數據加到當前有藝人名的記錄上
             const currentCount = (mergedMap.get(key)?.count || 0) + item._count._all + noArtistData.count;
             mergedMap.set(key, {
                 albumName: normalizedAlbumName,
                 artistName: normalizedArtistName,
                 count: currentCount
             });
             mergedMap.delete(noArtistKey);
             continue; 
         }
      }

      const existing = mergedMap.get(key);
      if (existing) {
        existing.count += item._count._all;
      } else {
        mergedMap.set(key, {
          albumName: normalizedAlbumName,
          artistName: normalizedArtistName || null, // 保持 null 如果真的沒有
          count: item._count._all
        });
      }
    }

    // 轉換為數組並排序
    const topPicks = Array.from(mergedMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

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
        pickCount: item.count,
        avgRating: reviewAgg._avg.rating || 0,
        reviewCount: reviewAgg._count._all,
      });
    }

    // 再次按 pickCount 排序
    result.sort((a, b) => b.pickCount - a.pickCount);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Fetch top albums failed:", error);
    return NextResponse.json({ error: "Failed to fetch top albums" }, { status: 500 });
  }
}
