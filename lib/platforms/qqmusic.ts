import { PlaylistTrackItem } from "./netease";

// Mock headers to avoid bot detection
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Referer": "https://y.qq.com/",
};

export async function fetchQQMusicPlaylist(url: string): Promise<PlaylistTrackItem[]> {
  // 1. Resolve mobile share link if needed
  let finalUrl = url;
  if (url.includes("i.y.qq.com")) {
    // Simply fetch the mobile page, it often redirects or contains data too
    // But desktop page is easier to parse. Let's try to fetch and see if we get a redirect
    try {
      const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
      finalUrl = res.url; // Follow redirect to desktop version if possible
    } catch {
      // Ignore error, try original url
    }
  }

  // 2. Fetch HTML
  const res = await fetch(finalUrl, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`QQ音乐页面请求失败: ${res.status}`);
  }
  const html = await res.text();

  // 3. Extract __INITIAL_DATA__
  // Pattern: window.__INITIAL_DATA__ = {...}
  const match = html.match(/window\.__INITIAL_DATA__\s*=\s*({.+?})\s*(?:;|<\/script>)/s);
  
  if (!match) {
    // If desktop page fails, maybe it's still a mobile page structure?
    // Mobile page often has window.firstPageData
    const mobileMatch = html.match(/window\.firstPageData\s*=\s*({.+?})\s*(?:;|<\/script>)/s);
    if (mobileMatch) {
      return parseMobileData(mobileMatch[1]);
    }
    throw new Error("无法解析 QQ 音乐页面数据（未找到 __INITIAL_DATA__ 或 firstPageData）");
  }

  try {
    const jsonStr = match[1];
    const data = JSON.parse(jsonStr);

    // 4. Navigate JSON structure (Desktop)
    // Structure: data.playlist.songList or data.detail.songList
    const songList = data.playlist?.songList || data.detail?.songList || data.songList;
    
    if (!Array.isArray(songList) || songList.length === 0) {
      throw new Error("未在页面数据中找到歌曲列表");
    }

    return mapQQSongs(songList);
  } catch (e: any) {
    throw new Error(`QQ 音乐数据解析失败: ${e.message}`);
  }
}

function parseMobileData(jsonStr: string): PlaylistTrackItem[] {
  try {
    const data = JSON.parse(jsonStr);
    // Mobile structure might differ, usually taogeData.songlist or similar
    const songList = data.taogeData?.songlist || data.songlist || [];
    return mapQQSongs(songList);
  } catch (e: any) {
    throw new Error(`QQ 音乐移动端数据解析失败: ${e.message}`);
  }
}

function mapQQSongs(list: any[]): PlaylistTrackItem[] {
  return list.map((item: any) => {
    // item structure can be nested
    const song = item.songInfo || item;
    
    // Album cover
    const albumMid = song.albummid || song.album?.mid;
    // QQ Music cover URL pattern
    const picUrl = albumMid 
      ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albumMid}.jpg` 
      : "";

    // Artists
    const singers = song.singer || song.singers || [];
    const artistName = Array.isArray(singers) 
      ? singers.map((s: any) => s.name).join(", ") 
      : (typeof singers === 'string' ? singers : "未知");

    // Album Name
    const albumName = song.albumname || song.album?.name || song.name || "";

    return {
      name: song.songname || song.name || "未知",
      artistName: artistName || "未知",
      picUrl,
      albumName,
      songId: "", 
      originalLink: song.songmid ? `https://y.qq.com/n/ryqq/songDetail/${song.songmid}` : undefined
    };
  }).filter(item => item.name !== "未知");
}
