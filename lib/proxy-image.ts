/**
 * 网易云等外链封面通过 API 代理加载，绕过防盗链。
 * 仅对需要代理的域名返回 /api/proxy-image?url=...，其余返回原 URL。
 */
const PROXY_HOSTS = ["music.126.net"];

export function isProxyImageUrl(url: string): boolean {
  if (!url || !url.startsWith("http")) return false;
  return PROXY_HOSTS.some((h) => url.includes(h));
}

export function getProxyImageUrl(url: string): string {
  if (!url) return url;
  if (isProxyImageUrl(url)) {
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  }
  return url;
}
