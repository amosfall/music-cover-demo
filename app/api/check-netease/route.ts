import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 诊断 NETEASE_API_URL 在运行环境（Vercel/本地）是否可访问。
 * GET /api/check-netease 即可查看结果，便于排查「fetch failed」。
 */
export async function GET() {
  const raw = process.env.NETEASE_API_URL?.trim() || "";
  const apiBase = raw
    ? raw.startsWith("http")
      ? raw
      : `https://${raw}`
    : "";

  const hostMatch = apiBase.match(/^https?:\/\/([^/]+)/);
  const host = hostMatch ? hostMatch[1] : "(未配置)";

  if (!apiBase) {
    return new NextResponse(
      JSON.stringify({
        configured: false,
        host: null,
        hint: "在 Vercel 添加 NETEASE_API_URL 并 Redeploy，或本地 .env.local 添加 NETEASE_API_URL",
      }),
      { headers: { "Content-Type": "application/json; charset=utf-8" } }
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(apiBase, {
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0 (Vercel-Netease-Check)" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const body = {
      configured: true,
      host,
      reachable: true,
      status: res.status,
      hint:
        res.status >= 400
          ? "服务返回异常状态，但网络可达。若抓取仍失败，请检查网易云 API 具体接口是否正常。"
          : "网络可达，可尝试使用抓取功能。",
    };
    return new NextResponse(JSON.stringify(body), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const msg = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "";
    const isAbort = name === "AbortError" || msg.includes("abort");
    const isNetwork =
      msg === "fetch failed" ||
      /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|network/i.test(msg);

    let hint = "";
    if (isAbort) {
      hint = "请求超时（10s）。若为 Railway，可能是冷启动过慢，请稍后重试。";
    } else if (isNetwork) {
      hint =
        "当前运行环境无法连接该地址。请确认：1) 环境变量 NETEASE_API_URL 正确 2) Railway 服务已启动 3) 若刚改过 Vercel 变量，需 Redeploy。";
    } else {
      hint = `异常: ${msg}`;
    }

    return new NextResponse(
      JSON.stringify({ configured: true, host, reachable: false, error: msg, hint }),
      { headers: { "Content-Type": "application/json; charset=utf-8" } }
    );
  }
}
