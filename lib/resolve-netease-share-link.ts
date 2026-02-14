/**
 * 解析网易云短链接 (163cn.tv)，跟随重定向获取真实 URL 并提取 id 参数。
 * 用于支持手机端复制的分享链接。
 */

const SHORT_LINK_HOST = "163cn.tv";

/** 从 URL 中提取 id 参数（支持 playlist?id=、playlist/123、?id=、&id= 等格式） */
function extractIdFromUrl(url: string): string | null {
  const playlistMatch =
    url.match(/playlist\?id=(\d+)/i) ||
    url.match(/playlist\/(\d+)/i) ||
    url.match(/#\/playlist\?id=(\d+)/i);
  if (playlistMatch) return playlistMatch[1];

  const genericMatch = url.match(/[?&]id=(\d+)/);
  return genericMatch ? genericMatch[1] : null;
}

/**
 * 解析网易云短链接：请求 URL 并跟随重定向，从最终 URL 中提取 id。
 * @param shortUrl 短链接（如 https://163cn.tv/xxxx）
 * @returns 提取到的 id，若无法解析则返回 null
 */
export async function resolveNeteaseShareLink(
  shortUrl: string
): Promise<string | null> {
  try {
    const url = shortUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return null;
    }

    const host = new URL(url).hostname.toLowerCase();
    const isShortLink =
      host === SHORT_LINK_HOST || host.endsWith(`.${SHORT_LINK_HOST}`);

    let finalUrl: string;
    if (isShortLink) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, {
        redirect: "follow",
        headers: { 
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
          "Cookie": "os=pc; appver=2.9.7"
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      finalUrl = res.url;
    } else {
      finalUrl = url;
    }

    return extractIdFromUrl(finalUrl);
  } catch {
    return null;
  }
}
