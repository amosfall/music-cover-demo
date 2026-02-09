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
    const parsed = new URL(url);
    const isNetease = parsed.hostname.endsWith("music.126.net");
    const baseHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
    };
    let res: Response;
    if (isNetease) {
      res = await fetch(url, {
        headers: { ...baseHeaders, Referer: "https://music.163.com/" },
        cache: "no-store",
      });
      if (!res.ok && res.status === 403) {
        res = await fetch(url, {
          headers: baseHeaders,
          cache: "no-store",
        });
      }
    } else {
      res = await fetch(url, { headers: baseHeaders, cache: "no-store" });
    }
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      throw new Error("Response is not an image");
    }
    const blob = await res.blob();
    return new NextResponse(blob, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("Proxy image failed:", err);
    return new NextResponse("Image fetch failed", { status: 502 });
  }
}
