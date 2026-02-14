import { NextRequest, NextResponse } from "next/server";
import { fetchNeteasePlaylist, PlaylistTrackItem } from "@/lib/platforms/netease";
import { fetchSpotifyPlaylist } from "@/lib/platforms/spotify";
import { fetchQQMusicPlaylist } from "@/lib/platforms/qqmusic";
import { fetchAppleMusicPlaylist } from "@/lib/platforms/applemusic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Pro 可延长至 60s；Hobby 仍为 10s，歌单过大可能超时
export const maxDuration = 60;

export { type PlaylistTrackItem };

/**
 * POST /api/playlist
 * Body: { url: string }
 * 自动识别平台并获取歌单详情
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = (body?.url || body?.playlistId || "").trim();

    if (!url) {
      return NextResponse.json(
        { error: "请提供歌单链接" },
        { status: 400 }
      );
    }

    let items: PlaylistTrackItem[] = [];

    // Dispatcher
    if (url.includes("spotify.com")) {
      items = await fetchSpotifyPlaylist(url);
    } else if (url.includes("qq.com")) {
      items = await fetchQQMusicPlaylist(url);
    } else if (url.includes("music.apple.com")) {
      items = await fetchAppleMusicPlaylist(url);
    } else {
      // Default to Netease
      items = await fetchNeteasePlaylist(url);
    }

    return NextResponse.json({ items, total: items.length });
  } catch (err) {
    console.error("[playlist] error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    const isNetwork =
      msg === "fetch failed" ||
      /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|network/i.test(msg);
    
    // Customize error message based on platform hint
    let finalMsg = msg;
    if (isNetwork) {
      finalMsg = `网络请求失败: ${msg}。请检查服务器网络连接。`;
    }

    return NextResponse.json({ error: finalMsg }, { status: 500 });
  }
}
