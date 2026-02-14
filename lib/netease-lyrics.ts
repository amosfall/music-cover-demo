/**
 * 根据网易云专辑 ID 拉取专辑详情，返回第一首曲目的 id、name。
 * 用于「按专辑再拉一次」补歌词。
 */
export async function getFirstTrackFromAlbum(
  apiBase: string,
  albumId: string
): Promise<{ songId: string; songName: string } | null> {
  const base = apiBase.replace(/\/$/, "");
  const extraCookie = process.env.NETEASE_COOKIE || "os=pc; appver=2.9.7";
  try {
    const res = await fetch(`${base}/album?id=${albumId}`, {
      headers: { 
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Cookie": extraCookie,
        "Accept": "application/json, text/plain, */*",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const album = data?.album;
    const songs = album?.songs ?? album?.tracks;
    const first = Array.isArray(songs) && songs.length > 0 ? songs[0] : null;
    if (!first) return null;
    const id = (first as { id?: number }).id ?? (first as { id?: string }).id;
    const name = (first as { name?: string }).name;
    if (id == null || id === "") return null;
    return {
      songId: String(id),
      songName: typeof name === "string" ? name : "未知",
    };
  } catch {
    return null;
  }
}

/**
 * 从网易云 API 拉取歌词并规范化（去时间戳、元信息行）。
 * 供 parse-netease 与 backfill-lyrics 使用。
 */
export async function fetchNeteaseLyrics(
  apiBase: string,
  songId: string
): Promise<string | null> {
  const base = apiBase.replace(/\/$/, "");
  const extraCookie = process.env.NETEASE_COOKIE || "os=pc; appver=2.9.7";
  try {
    const res = await fetch(`${base}/lyric?id=${songId}`, {
      headers: { 
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Cookie": extraCookie,
        "Accept": "application/json, text/plain, */*",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw: string = data?.lrc?.lyric || "";
    const metaCn =
      /^(作词|作曲|编曲|制作人|混音|母带|录音|吉他|贝斯|鼓|键盘|和声|监制|出品|词|曲|编)\s*[：:]/i;
    const metaEn =
      /^(Produced by|Co-produced by|Written by|Composed by|Coordinated by|Mixed by|Mastered by|Recorded by|Engineered by|Acoustic guitar|Electric guitar|Bass|Guitar|Drums|Piano|Keyboards|Strings|Vocals|Backing vocals|Synth|Programming|Cover)\s*[：:]/i;
    const nameLabel = /^[a-zA-Z][a-zA-Z0-9_\s]{0,24}\s*[：:]/;
    const roleLabel = /^(男|女|合唱|独唱|男声|女声)\s*[：:]/;
    const normalized = raw
      .replace(/\[\d{2}:\d{2}[.:]\d{2,3}\]/g, "")
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => {
        if (!l) return false;
        if (metaCn.test(l) || metaEn.test(l)) return false;
        if (nameLabel.test(l) || roleLabel.test(l)) return false;
        return true;
      })
      .join("\n");
    return normalized || null;
  } catch {
    return null;
  }
}

/**
 * 根據關鍵詞搜索歌曲，返回最匹配的一首。
 * 用於當導入來源（如 Apple Music）沒有提供網易雲 ID 時，嘗試自動匹配。
 */
export async function searchSong(
  apiBase: string,
  keyword: string
): Promise<{ id: string; name: string; artist: string } | null> {
  const base = apiBase.replace(/\/$/, "");
  const extraCookie = process.env.NETEASE_COOKIE || "os=pc; appver=2.9.7";
  try {
    // type=1: 單曲
    const res = await fetch(`${base}/cloudsearch?keywords=${encodeURIComponent(keyword)}&type=1&limit=5`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Cookie": extraCookie,
        "Accept": "application/json, text/plain, */*",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const songs = data?.result?.songs;
    
    if (Array.isArray(songs) && songs.length > 0) {
      // 簡單取第一首，通常是最相關的
      const song = songs[0];
      const artist = Array.isArray(song.ar) 
        ? song.ar.map((a: any) => a.name).join("/") 
        : (song.ar?.name || "未知");
        
      return {
        id: String(song.id),
        name: song.name,
        artist: artist
      };
    }
    return null;
  } catch {
    return null;
  }
}
