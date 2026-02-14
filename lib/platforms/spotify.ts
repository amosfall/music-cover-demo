import { PlaylistTrackItem } from "./netease";

let spotifyToken: string | null = null;
let spotifyTokenExpiresAt = 0;

async function getSpotifyToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("请在 .env.local 中配置 SPOTIFY_CLIENT_ID 和 SPOTIFY_CLIENT_SECRET");
  }

  // Check if token is still valid (buffer 60s)
  if (spotifyToken && Date.now() < spotifyTokenExpiresAt) {
    return spotifyToken;
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 
        'Authorization': `Basic ${basic}`, 
        'Content-Type': 'application/x-www-form-urlencoded' 
      },
      body: 'grant_type=client_credentials'
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Spotify Token API 错误: ${res.status} ${text}`);
    }

    const data = await res.json();
    if (!data.access_token) {
      throw new Error("Spotify Token 响应缺失 access_token");
    }

    spotifyToken = data.access_token;
    spotifyTokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
    
    return spotifyToken;
  } catch (err: any) {
    throw new Error(`无法连接 Spotify 认证服务: ${err.message}`);
  }
}

export async function fetchSpotifyPlaylist(url: string): Promise<PlaylistTrackItem[]> {
  const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
  if (!match) {
    throw new Error("无法从链接解析 Spotify 歌单 ID");
  }
  const playlistId = match[1];

  const token = await getSpotifyToken();
  
  try {
    const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      if (res.status === 404) throw new Error("未找到该 Spotify 歌单（请确认链接正确且歌单公开）");
      const text = await res.text();
      throw new Error(`Spotify API 请求失败: ${res.status} ${text}`);
    }

    const data = await res.json();
    const items = data.tracks?.items || [];

    return items
      .map((item: any) => {
        const track = item.track;
        if (!track) return null;

        const album = track.album;
        const artists = track.artists || [];
        // Get largest image
        const picUrl = album.images?.[0]?.url || "";

        return {
          name: track.name,
          artistName: artists.map((a: any) => a.name).join(", "),
          picUrl,
          albumName: album.name,
          songId: "", // Netease songId is not available
          originalLink: track.external_urls?.spotify,
        };
      })
      .filter((item: any): item is PlaylistTrackItem => item !== null);
  } catch (err: any) {
    throw new Error(`Spotify 歌单获取失败: ${err.message}`);
  }
}
