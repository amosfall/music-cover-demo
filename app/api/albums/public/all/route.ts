import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Group by albumName and artistName to get unique albums
    const allAlbums = await withDbRetry(() =>
      prisma.albumCover.groupBy({
        by: ["albumName", "artistName"],
        orderBy: {
          albumName: "asc",
        },
      })
    );

    const result = [];

    // 2. For each unique album, find a cover image
    // Note: Fetching image for every album might be slow if N is large.
    // Optimization: We could do this in parallel or use a raw query if needed.
    // For now, sequential/parallel fetch is okay for small-medium datasets.
    
    // Use Promise.all to fetch images in parallel
    const albumsWithImages = await Promise.all(
      allAlbums.map(async (item, idx) => {
        const albumName = item.albumName;
        const artistName = item.artistName;

        const cover = await prisma.albumCover.findFirst({
          where: {
            albumName,
            ...(artistName ? { artistName } : {}),
            imageUrl: { not: "" },
          },
          select: { imageUrl: true },
        });

        // We don't fetch ratings here to keep the list lightweight
        // The modal will fetch reviews when opened
        
        return {
          id: `all-${idx}`, // Virtual ID
          albumName,
          artistName,
          imageUrl: cover?.imageUrl || "",
          pickCount: 0, // Not needed for list view
          avgRating: 0, // Not needed for list view
          reviewCount: 0, // Not needed for list view
        };
      })
    );

    result.push(...albumsWithImages);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Fetch all public albums failed:", error);
    return NextResponse.json({ error: "Failed to fetch albums" }, { status: 500 });
  }
}
