import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDbConnectionError } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 诊断数据库连接是否正常。
 * GET /api/check-db 即可查看，便于排查「Connection terminated unexpectedly」。
 */
export async function GET() {
  // #region agent log
  const rawUrl = process.env.DATABASE_URL ?? "";
  const hasUrl = !!rawUrl.trim();
  const urlContainsPooler = rawUrl.includes("pooler");
  fetch("http://127.0.0.1:7242/ingest/e4529bf3-29a2-4a50-8203-29588364bc75", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "app/api/check-db/route.ts:GET:env",
      message: "DATABASE_URL check",
      data: { hasUrl, urlContainsPooler },
      timestamp: Date.now(),
      sessionId: "debug-session",
      hypothesisId: "H1",
    }),
  }).catch(() => {});
  // #endregion
  if (!process.env.DATABASE_URL?.trim()) {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/e4529bf3-29a2-4a50-8203-29588364bc75", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "app/api/check-db/route.ts:GET",
        message: "DATABASE_URL missing",
        data: {},
        timestamp: Date.now(),
        sessionId: "debug-session",
        hypothesisId: "H2",
      }),
    }).catch(() => {});
    // #endregion
    return NextResponse.json({
      ok: false,
      hint: "未配置 DATABASE_URL。请在 .env.local 或 Vercel 环境变量中设置（Neon 建议用 Pooled connection）。",
    });
  }

  try {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/e4529bf3-29a2-4a50-8203-29588364bc75", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "app/api/check-db/route.ts:beforeQuery",
        message: "before prisma.$queryRaw",
        data: {},
        timestamp: Date.now(),
        sessionId: "debug-session",
        hypothesisId: "H3",
      }),
    }).catch(() => {});
    // #endregion
    await prisma.$queryRaw`SELECT 1`;
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/e4529bf3-29a2-4a50-8203-29588364bc75", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "app/api/check-db/route.ts:afterQuery",
        message: "after prisma.$queryRaw success",
        data: { ok: true },
        timestamp: Date.now(),
        sessionId: "debug-session",
        hypothesisId: "H3",
      }),
    }).catch(() => {});
    // #endregion
    return NextResponse.json({
      ok: true,
      hint: "数据库连接正常。",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isConn = isDbConnectionError(err);
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/e4529bf3-29a2-4a50-8203-29588364bc75", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "app/api/check-db/route.ts:catch",
        message: "DB query error",
        data: { errorSlice: msg.slice(0, 80), isDbConnectionError: isConn },
        timestamp: Date.now(),
        sessionId: "debug-session",
        hypothesisId: isConn ? "H4" : "H3",
      }),
    }).catch(() => {});
    // #endregion
    return NextResponse.json({
      ok: false,
      error: msg.slice(0, 200),
      hint: isConn
        ? "连接被断开或超时。请将 DATABASE_URL 改为 Neon 控制台中的「Pooled connection」连接串（主机名带 -pooler），保存后重启或 Redeploy。"
        : "请检查 DATABASE_URL 是否正确、数据库服务是否可用。",
    });
  }
}
