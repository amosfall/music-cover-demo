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
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({
      ok: false,
      hint: "未配置 DATABASE_URL。请在 .env.local 或 Vercel 环境变量中设置（Neon 建议用 Pooled connection）。",
    });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      hint: "数据库连接正常。",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isConn = isDbConnectionError(err);
    return NextResponse.json({
      ok: false,
      error: msg.slice(0, 200),
      hint: isConn
        ? "连接被断开或超时。请将 DATABASE_URL 改为 Neon 控制台中的「Pooled connection」连接串（主机名带 -pooler），保存后重启或 Redeploy。"
        : "请检查 DATABASE_URL 是否正确、数据库服务是否可用。",
    });
  }
}
