import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type PlaylistTrackItem = {
  name: string;
  artistName: string;
  picUrl: string;
  albumName?: string;
};

/**
 * POST /api/playlist
 * Body: { playlistId: string } 或 { url: string }（从中解析 id）
 * 使用 NETEASE_API_URL 请求歌单详情，返回每首歌的 name、歌手、封面 picUrl。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let playlistId: string | null =
      body?.playlistId?.trim() || body?.id?.trim() || null;

    if (!playlistId && typeof body?.url === "string") {
      const url = body.url.trim();
      const match = url.match(/playlist\?id=(\d+)/i) || url.match(/playlist\/(\d+)/i);
      playlistId = match ? match[1] : null;
    }

    if (!playlistId) {
      return NextResponse.json(
        { error: "请提供 playlistId 或歌单链接（含 id）" },
        { status: 400 }
      );
    }

    const apiBase = process.env.NETEASE_API_URL;
    if (!apiBase) {
      return NextResponse.json(
        {
          error:
            "请配置 NETEASE_API_URL（与解析单曲相同，如本地 npx NeteaseCloudMusicApi 或公网 API）",
        },
        { status: 503 }
      );
    }

    const base = apiBase.replace(/\/$/, "");
    // NeteaseCloudMusicApi: /playlist/detail?id=xxx 返回 playlist.tracks
    // Railway 冷启动可能较慢，设置 60s 超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    const res = await fetch(`${base}/playlist/detail?id=${playlistId}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      console.error("[playlist] API not ok:", res.status, text.slice(0, 200));
      return NextResponse.json(
        { error: `歌单接口请求失败: ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const playlist = data?.playlist;
    const tracks = playlist?.tracks;
    if (!Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json(
        { error: "未获取到歌单曲目，请检查歌单 id 或链接是否有效" },
        { status: 404 }
      );
    }

    // 歌单接口返回的 track 可能没有每首歌自己的 al.picUrl（或统一成歌单封面），
    // 所以用 song/detail 按歌曲 id 拉取详情，拿到每首歌正确的专辑封面。
    const ids = tracks
      .map((t: Record<string, unknown>) => t.id as number)
      .filter((id: unknown) => typeof id === "number" && id > 0);
    if (ids.length === 0) {
      return NextResponse.json(
        { error: "歌单曲目无有效 id" },
        { status: 404 }
      );
    }

    const CHUNK = 50;
    const allSongs: Record<string, unknown>[] = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const detailCtrl = new AbortController();
      const detailTimeout = setTimeout(() => detailCtrl.abort(), 30000);
      const detailRes = await fetch(
        `${base}/song/detail?ids=${chunk.join(",")}`,
        { headers: { "User-Agent": "Mozilla/5.0" }, signal: detailCtrl.signal }
      );
      clearTimeout(detailTimeout);
      if (!detailRes.ok) continue;
      const detailData = await detailRes.json();
      const songs = detailData?.songs;
      if (Array.isArray(songs)) allSongs.push(...songs);
    }

    const idToSong = new Map<number, Record<string, unknown>>();
    for (const s of allSongs) {
      const id = s.id as number;
      if (id != null) idToSong.set(id, s);
    }

    const items: PlaylistTrackItem[] = tracks.map((t: Record<string, unknown>) => {
      const tid = t.id as number;
      const song = idToSong.get(tid) || t;
      const name = (song.name as string) || (t.name as string) || "未知";
      const ar = (song.ar as { name?: string }[]) || (song.artists as { name?: string }[]) || (t.ar as { name?: string }[]) || (t.artists as { name?: string }[]) || [];
      const artistName = Array.isArray(ar)
        ? ar.map((a) => (a as { name?: string })?.name).filter(Boolean).join(", ")
        : "";
      const al = (song.al as { picUrl?: string; name?: string }) || (song.album as { picUrl?: string; name?: string }) || (t.al as { picUrl?: string; name?: string }) || (t.album as { picUrl?: string; name?: string }) || {};
      const picUrl = (al.picUrl as string) || "";
      const albumName = (al.name as string) || name;
      return {
        name,
        artistName: artistName || "未知",
        picUrl: picUrl.replace(/^http:/, "https:"),
        albumName,
      };
    });

    return NextResponse.json({ items, total: items.length });
  } catch (err) {
    console.error("[playlist] error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    const isNetwork =
      msg === "fetch failed" ||
      /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|network/i.test(msg);
    const hint =
      "打开 /api/check-netease 可诊断连接状态。若用 Railway，冷启动可能需 30 秒，请稍后重试。";
    const apiHost = process.env.NETEASE_API_URL || "";
    const isRailway = /railway|railway\.app/i.test(apiHost);
    const railHint = isRailway
      ? "若使用 Railway，首次请求可能需 30–60 秒冷启动，请稍后重试。或改用本地 API：npm run netease-api + NETEASE_API_URL=http://localhost:3002"
      : hint;
    const finalMsg = isNetwork
      ? `无法连接网易云 API：${msg}。${railHint}`
      : msg;
    return NextResponse.json({ error: finalMsg }, { status: 500 });
  }
}
