import { clerkMiddleware } from "@clerk/nextjs/server";

// 所有页面均可匿名访问；诗的歌 /lyrics-wall 在页面内做只读访客模式，登录后解锁编辑
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
