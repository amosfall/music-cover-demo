import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 从网易云 API 获取歌曲的完整歌词
 */
async function fetchSongLyrics(
  songId: number,
  apiBase: string
): Promise<string | null> {
  try {
    const url = `${apiBase}/lyric?id=${songId}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const lrc = data?.lrc?.lyric;
    if (!lrc) return null;
    return lrc
      .split("\n")
      .map((line: string) => line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, "").trim())
      .filter((line: string) => line.length > 0)
      .join("\n");
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const songId = id ? parseInt(id, 10) : NaN;

    if (!id || isNaN(songId)) {
      return NextResponse.json(
        { error: "请提供有效的歌曲 ID" },
        { status: 400 }
      );
    }

    const apiBase = process.env.NETEASE_API_URL;
    if (!apiBase) {
      return NextResponse.json(
        { error: "未配置 NETEASE_API_URL" },
        { status: 503 }
      );
    }

    const base = apiBase.replace(/\/$/, "");
    const lyrics = await fetchSongLyrics(songId, base);

    return NextResponse.json({
      lyrics: lyrics ?? "",
    });
  } catch (error) {
    console.error("Fetch song lyrics error:", error);
    return NextResponse.json(
      { error: "获取歌词失败" },
      { status: 500 }
    );
  }
}
