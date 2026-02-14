import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

const clerkHandler = clerkMiddleware();
const LOG_ENDPOINT = "http://127.0.0.1:7242/ingest/e4529bf3-29a2-4a50-8203-29588364bc75";

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  if (request.nextUrl.pathname === "/api/debug-log") return NextResponse.next();
  const origin = request.nextUrl.origin;
  // #region agent log
  const entryPayload = { location: "middleware.ts:entry", message: "middleware request", data: { pathname: request.nextUrl.pathname, hasClerkKey: !!process.env.CLERK_SECRET_KEY, hypothesisId: "B" } };
  fetch(LOG_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...entryPayload, timestamp: Date.now() }) }).catch(() => { });
  fetch(`${origin}/api/debug-log`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entryPayload) }).catch(() => { });
  // #endregion
  let res: NextResponse | Response;
  try {
    if (!process.env.CLERK_SECRET_KEY) {
      res = NextResponse.next();
    } else {
      const clerkRes = await clerkHandler(request, event);
      if (clerkRes) res = clerkRes;
      else res = NextResponse.next();
    }
    // #region agent log
    const exitPayload = { location: "middleware.ts:exit", message: "middleware response", data: { status: res?.status, hypothesisId: "B" } };
    fetch(LOG_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...exitPayload, timestamp: Date.now() }) }).catch(() => { });
    fetch(`${origin}/api/debug-log`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(exitPayload) }).catch(() => { });
    // #endregion
    return res;
  } catch (e) {
    // #region agent log
    const catchPayload = { location: "middleware.ts:catch", message: "middleware threw", data: { error: String(e), hypothesisId: "B" } };
    fetch(LOG_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...catchPayload, timestamp: Date.now() }) }).catch(() => { });
    fetch(`${origin}/api/debug-log`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(catchPayload) }).catch(() => { });
    // #endregion
    throw e;
  }
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
