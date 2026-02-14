import { PlaylistTrackItem } from "./netease";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

export async function fetchAppleMusicPlaylist(url: string): Promise<PlaylistTrackItem[]> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`Apple Music 页面请求失败: ${res.status}`);
  }

  const html = await res.text();

  // Extract JSON from script tag - 支援多種模式
  const scriptPatterns = [
    /<script type="application\/json" id="serialized-server-data">(.+?)<\/script>/s,
    /<script[^>]*id="serialized-server-data"[^>]*>(.+?)<\/script>/s,
    /<script[^>]*type="application\/json"[^>]*>(.+?)<\/script>/s
  ];

  let jsonStr = null;
  for (const pattern of scriptPatterns) {
    const match = html.match(pattern);
    if (match) {
      jsonStr = match[1];
      break;
    }
  }

  if (!jsonStr) {
    throw new Error("无法解析 Apple Music 页面数据");
  }

  try {
    const data = JSON.parse(jsonStr);

    // Navigate the complex Apple Music JSON structure
    // 根據實際資料結構，data 是物件而不是陣列
    const sections = data?.data?.sections;
    if (!Array.isArray(sections)) {
      throw new Error("Apple Music 数据结构不匹配: 找不到 sections");
    }

    // Find the section that contains tracks - 尋找 trackLockup section
    const trackSection = sections.find((s: any) => s.itemKind === 'trackLockup');
    if (!trackSection || !Array.isArray(trackSection.items)) {
      throw new Error("未找到歌曲列表部分");
    }

    return trackSection.items.map((item: any) => {
      // 從實際資料結構提取資訊
      const title = item.title || "未知";
      
      // 藝人名稱在 subtitleLinks[0].title
      const artistName = item.subtitleLinks?.[0]?.title || "未知";
      
      // 專輯名稱在 tertiaryLinks[0].title  
      const albumName = item.tertiaryLinks?.[0]?.title || "";
      
      // Artwork: URL template needs size replacement
      // 從 artwork.dictionary.url 提取
      const artworkUrl = item.artwork?.dictionary?.url || "";
      const picUrl = artworkUrl.replace("{w}", "300").replace("{h}", "300").replace("{f}", "jpg");

      return {
        name: title,
        artistName: artistName,
        picUrl: picUrl,
        albumName: albumName,
        songId: "", // Netease ID not applicable
        originalLink: item.contentDescriptor?.url || ""
      };
    });
  } catch (e: any) {
    throw new Error(`Apple Music 数据解析失败: ${e.message}`);
  }
}