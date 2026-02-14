import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";
import { normalizeText } from "@/lib/text-normalization";

export const dynamic = "force-dynamic";

type TopAlbum = {
  albumName: string;
  artistName: string | null;
  imageUrl: string;
  pickCount: number;
  avgRating: number;
  reviewCount: number;
  releaseYear: string | null;
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
      // 規範化 key：移除空格，忽略大小寫，並進行簡繁轉換
      // 這能解決 "神的游戏" (簡) 和 "神的遊戲" (繁) 被分開的問題
      const normalizedAlbumName = normalizeText(item.albumName);
      const normalizedArtistName = normalizeText(item.artistName);
      
      // key 的構成：規範化後的專輯名 + 規範化後的藝人名
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
                 albumName: item.albumName, // 優先使用原始數據中的名字（通常是比較完整的）
                 artistName: item.artistName || null,
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
          albumName: item.albumName, // 保持原始顯示
          artistName: item.artistName || null, // 保持原始顯示
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

      // 找封面和发行年份：取第一张非空的
      const cover = await prisma.albumCover.findFirst({
        where: {
          albumName,
          ...(artistName ? { artistName } : {}),
          imageUrl: { not: "" },
        },
        select: { imageUrl: true, releaseYear: true },
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
        releaseYear: cover?.releaseYear || null,
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
