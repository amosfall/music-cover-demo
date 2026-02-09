import { NextResponse } from "next/server";
import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";

const LOG_DIR = join(process.cwd(), ".cursor");
const LOG_PATH = join(LOG_DIR, "debug.log");

export async function POST(req: Request) {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    const payload = await req.json();
    const line = JSON.stringify({ ...payload, timestamp: Date.now() }) + "\n";
    appendFileSync(LOG_PATH, line);
  } catch {
    // ignore
  }
  return NextResponse.json({ ok: true });
}
