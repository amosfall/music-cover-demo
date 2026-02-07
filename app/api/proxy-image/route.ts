import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = [
  "music.126.net",
  "p1.music.126.net",
  "p2.music.126.net",
  "p3.music.126.net",
  "p4.music.126.net",
  "*.music.126.net",
  "*.blob.vercel-storage.com",
];

function isAllowedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    return ALLOWED_HOSTS.some((h) => {
      if (h.startsWith("*.")) {
        return u.hostname.endsWith(h.slice(1)) || u.hostname === h.slice(2);
      }
      return u.hostname === h;
    });
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url || !isAllowedUrl(url)) {
    return new NextResponse("Invalid URL", { status: 400 });
  }
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MusicWall/1.0)" },
      cache: "force-cache",
    });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const blob = await res.blob();
    const contentType = res.headers.get("content-type") || "image/jpeg";
    return new NextResponse(blob, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error("Proxy image failed:", err);
    return new NextResponse("Image fetch failed", { status: 502 });
  }
}
