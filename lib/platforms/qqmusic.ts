import { PlaylistTrackItem } from "./netease";

// Mock headers to avoid bot detection
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Referer": "https://y.qq.com/",
  "Cookie": "pgv_pvi=1234567890; pgv_si=s1234567890"
};

export async function fetchQQMusicPlaylist(url: string): Promise<PlaylistTrackItem[]> {
  let finalUrl = url;
  
  // Handle mobile URLs
  if (url.includes("i.y.qq.com")) {
    try {
      const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
      finalUrl = res.url;
    } catch (error) {
      console.warn('Mobile URL redirect failed, trying original:', error);
    }
  }

  // Fetch HTML
  const res = await fetch(finalUrl, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`QQ音乐页面请求失败: ${res.status}`);
  }
  
  const html = await res.text();
  
  // Try multiple data extraction patterns
  const dataExtraction = extractQQMusicData(html);
  
  if (!dataExtraction.success) {
    // If extraction fails, check for server error page
    if (html.includes('server_error_page') || html.includes('歌单不存在')) {
       throw new Error("QQ音乐返回错误：歌单不存在或已删除");
    }
    throw new Error(`无法解析 QQ 音乐页面数据: ${dataExtraction.error}`);
  }

  return mapQQSongs(dataExtraction.songs || []);
}

function extractQQMusicData(html: string) {
  const patterns = [
    {
      name: '__INITIAL_DATA__',
      pattern: /window\.__INITIAL_DATA__\s*=\s*({[\s\S]+?})\s*(?:;|<\/script>)/,
      extractor: (data: any) => {
        // Try multiple possible paths
        const playlist = data.playlist || data.detail || data;
        const songList = playlist.songList || data.songList || playlist.songs || data.songs;
        return Array.isArray(songList) ? songList : null;
      }
    },
    {
      name: 'firstPageData',
      pattern: /window\.firstPageData\s*=\s*({[\s\S]+?})\s*(?:;|<\/script>)/,
      extractor: (data: any) => {
        const taogeData = data.taogeData || data;
        const songlist = taogeData.songlist || data.songlist || taogeData.songs || data.songs;
        return Array.isArray(songlist) ? songlist : null;
      }
    },
    {
      name: 'playlistData',
      pattern: /window\.playlistData\s*=\s*({[\s\S]+?})\s*(?:;|<\/script>)/,
      extractor: (data: any) => {
        const songs = data.songs || data.list || data.songList || data.songlist;
        return Array.isArray(songs) ? songs : null;
      }
    }
  ];

  for (const { name, pattern, extractor } of patterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        const data = JSON.parse(match[1]);
        const songs = extractor(data);
        
        if (songs && songs.length > 0) {
          return { success: true, songs };
        }
      } catch (e) {
        console.warn(`${name} 解析失败:`, e);
        continue;
      }
    }
  }

  // If no patterns worked, try to find any JSON in script tags
  // This is a fallback for when data is embedded in other variables
  const scriptTags = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
  if (scriptTags) {
    for (const script of scriptTags) {
      try {
        // Look for JSON objects in the script that might contain song lists
        const jsonMatches = script.match(/{[\s\S]+?}/g);
        if (jsonMatches) {
          for (const jsonStr of jsonMatches) {
            // Skip short strings to improve performance
            if (jsonStr.length < 100) continue;
            
            try {
              const data = JSON.parse(jsonStr);
              // Check for common song list structures
              if (data.songs || data.songList || data.songlist) {
                const songs = data.songs || data.songList || data.songlist;
                if (Array.isArray(songs) && songs.length > 0) {
                  // Verify it looks like a song list
                  if (songs[0].songname || songs[0].name || songs[0].songInfo) {
                    return { success: true, songs };
                  }
                }
              }
            } catch (e) {
              continue;
            }
          }
        }
      } catch (e) {
        continue;
      }
    }
  }

  return { 
    success: false, 
    error: "未找到任何有效的歌曲数据，可能是页面结构已更改" 
  };
}

function mapQQSongs(list: any[]): PlaylistTrackItem[] {
  return list
    .map((item: any) => {
      // Handle nested structures
      const song = item.songInfo || item.song || item;
      
      if (!song || (!song.songname && !song.name)) {
        return null;
      }

      // Album cover
      const albumMid = song.albummid || song.album?.mid || song.albumMid;
      const picUrl = albumMid 
        ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albumMid}.jpg` 
        : "";

      // Artists
      const singers = song.singer || song.singers || song.artists || [];
      const artistName = Array.isArray(singers) 
        ? singers.map((s: any) => s.name || s.singerName || "未知").join(", ") 
        : (typeof singers === 'string' ? singers : "未知");

      // Album Name
      const albumName = song.albumname || song.album?.name || song.albumName || "";

      const result: PlaylistTrackItem = {
        name: song.songname || song.name || "未知",
        artistName: artistName || "未知",
        picUrl,
        albumName: albumName || undefined,
        songId: song.songmid || song.id || "", 
        originalLink: song.songmid 
          ? `https://y.qq.com/n/ryqq/songDetail/${song.songmid}` 
          : undefined
      };
      return result;
    })
    .filter((item): item is PlaylistTrackItem => item !== null);
}
