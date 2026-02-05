import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const results: Record<string, unknown> = {};

  // DB host (sanitized)
  const dbUrl = process.env.DATABASE_URL || "";
  const hostMatch = dbUrl.match(/@([^/?]+)/);
  results.dbHost = hostMatch ? hostMatch[1] : "not-set";
  results.dbUrlLen = dbUrl.length;

  try {
    await prisma.$queryRaw`SELECT 1`;
    results.rawSql = "OK";
  } catch (e) {
    results.rawSql = e instanceof Error ? e.message.slice(0, 200) : String(e);
  }

  try {
    const tables = await prisma.$queryRawUnsafe(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    results.tables = tables;
  } catch (e) {
    results.tables = e instanceof Error ? e.message.slice(0, 200) : String(e);
  }

  try {
    const count = await prisma.albumCover.count();
    results.albumCoverCount = count;
  } catch (e) {
    results.albumCoverError = e instanceof Error ? e.message.slice(0, 300) : String(e);
  }

  try {
    const count = await prisma.lyricsCard.count();
    results.lyricsCardCount = count;
  } catch (e) {
    results.lyricsCardError = e instanceof Error ? e.message.slice(0, 300) : String(e);
  }

  return NextResponse.json(results);
}
