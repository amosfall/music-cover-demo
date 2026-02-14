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

  // Extract JSON from script tag
  const match = html.match(/<script type="application\/json" id="serialized-server-data">(.+?)<\/script>/);
  if (!match) {
    throw new Error("无法解析 Apple Music 页面数据");
  }

  try {
    const jsonStr = match[1];
    const data = JSON.parse(jsonStr);

    // Navigate the complex Apple Music JSON structure
    // Typically: data[0].data.sections -> look for "items" in sections
    const sections = data[0]?.data?.sections;
    if (!Array.isArray(sections)) {
      throw new Error("Apple Music 数据结构不匹配");
    }

    // Find the section that contains tracks
    const trackSection = sections.find((s: any) => s.itemKind === 'trackLockup');
    if (!trackSection || !Array.isArray(trackSection.items)) {
      throw new Error("未找到歌曲列表部分");
    }

    return trackSection.items.map((item: any) => {
      const title = item.title;
      const artistName = item.artistName;
      const albumName = item.albumName;
      
      // Artwork: URL template needs size replacement
      // e.g. "https://is1-ssl.mzstatic.com/image/.../{w}x{h}bb.jpg"
      const artworkUrl = item.artwork?.url || "";
      const picUrl = artworkUrl.replace("{w}", "300").replace("{h}", "300").replace("{f}", "jpg");

      return {
        name: title || "未知",
        artistName: artistName || "未知",
        picUrl,
        albumName: albumName || "",
        songId: "", // Netease ID not applicable
        originalLink: item.url
      };
    });
  } catch (e: any) {
    throw new Error(`Apple Music 数据解析失败: ${e.message}`);
  }
}
