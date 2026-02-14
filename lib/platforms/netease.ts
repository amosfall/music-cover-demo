import { resolveNeteaseShareLink } from "@/lib/resolve-netease-share-link";

export type PlaylistTrackItem = {
  name: string;
  artistName: string;
  picUrl: string;
  albumName?: string;
  songId?: string; // Netease specific
  originalLink?: string; // Optional
};

export async function fetchNeteasePlaylist(urlOrId: string): Promise<PlaylistTrackItem[]> {
  let playlistId: string | null = urlOrId.trim();

  // URL parsing logic
  if (urlOrId.includes("http")) {
    const url = urlOrId.trim();
    const host = (() => {
      try {
        return new URL(url).hostname.toLowerCase();
      } catch {
        return "";
      }
    })();
    if (host === "163cn.tv" || host.endsWith(".163cn.tv")) {
      playlistId = await resolveNeteaseShareLink(url);
    }
    if (!playlistId || playlistId.includes("http")) {
      const match = url.match(/playlist\?id=(\d+)/i) || url.match(/playlist\/(\d+)/i);
      playlistId = match ? match[1] : null;
    }
  }

  if (!playlistId) {
    throw new Error("无法从链接中提取网易云歌单 ID");
  }

  const apiBase = process.env.NETEASE_API_URL;
  if (!apiBase) {
    throw new Error("请配置 NETEASE_API_URL 环境变量");
  }

  const base = apiBase.replace(/\/$/, "");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  
  const extraCookie = process.env.NETEASE_COOKIE || "os=pc; appver=2.9.7";
  
  const res = await fetch(`${base}/playlist/detail?id=${playlistId}`, {
    headers: { 
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Cookie": extraCookie,
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`网易云 API 请求失败: ${res.status} ${text.slice(0, 50)}`);
  }

  const data = await res.json();
  const playlist = data?.playlist;
  const tracks = playlist?.tracks;
  if (!Array.isArray(tracks) || tracks.length === 0) {
    throw new Error("未获取到歌单曲目，请检查歌单 ID 是否有效");
  }

  // Fetch song details to get correct album covers
  const ids = tracks
    .map((t: any) => t.id as number)
    .filter((id: any) => typeof id === "number" && id > 0);

  const CHUNK = 50;
  const allSongs: any[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const detailCtrl = new AbortController();
    const detailTimeout = setTimeout(() => detailCtrl.abort(), 30000);
    const detailRes = await fetch(
      `${base}/song/detail?ids=${chunk.join(",")}`,
      { 
        headers: { 
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Cookie": extraCookie,
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        }, 
        signal: detailCtrl.signal 
      }
    );
    clearTimeout(detailTimeout);
    if (!detailRes.ok) continue;
    const detailData = await detailRes.json();
    const songs = detailData?.songs;
    if (Array.isArray(songs)) allSongs.push(...songs);
  }

  const idToSong = new Map<number, any>();
  for (const s of allSongs) {
    const id = s.id as number;
    if (id != null) idToSong.set(id, s);
  }

  return tracks.map((t: any) => {
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
      songId: String(tid),
    };
  });
}
