import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const log: string[] = [];
  try {
    await prisma.$queryRawUnsafe(
      'CREATE TABLE IF NOT EXISTS "LyricsCard" ("id" TEXT NOT NULL, "lyrics" TEXT NOT NULL, "albumName" TEXT NOT NULL, "artistName" TEXT, "imageUrl" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "LyricsCard_pkey" PRIMARY KEY ("id"))'
    );
    log.push("LyricsCard table: OK");

    for (const col of ["songId", "songName", "lyrics"]) {
      try {
        await prisma.$queryRawUnsafe('ALTER TABLE "AlbumCover" ADD COLUMN IF NOT EXISTS "' + col + '" TEXT');
        log.push("AlbumCover." + col + ": OK");
      } catch (e) {
        log.push("AlbumCover." + col + ": " + (e instanceof Error ? e.message.slice(0, 100) : String(e)));
      }
    }

    const tables = await prisma.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    log.push("Tables: " + JSON.stringify(tables));

    const lc = await prisma.lyricsCard.count();
    log.push("LyricsCard count: " + lc);

    return NextResponse.json({ ok: true, log });
  } catch (e) {
    log.push("Error: " + (e instanceof Error ? e.message.slice(0, 300) : String(e)));
    return NextResponse.json({ ok: false, log }, { status: 500 });
  }
}
