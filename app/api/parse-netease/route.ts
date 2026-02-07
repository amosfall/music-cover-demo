import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { saveImage, isVercel, hasBlobToken } from "@/lib/storage";
import { isDbConnectionError, withDbRetry } from "@/lib/db";
import { fetchNeteaseLyrics } from "@/lib/netease-lyrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ParseResult = { type: "song" | "album" | "playlist"; id: string } | null;

/** 从输入字符串中提取真实 URL，去掉末尾 (@网易云音乐) 等文字 */
function extractAndCleanUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  // 提取第一个 http(s) URL
  const urlMatch = trimmed.match(/https?:\/\/[^\s\u200b\u200c\u200d\ufffc]+/);
  let url = urlMatch ? urlMatch[0] : trimmed;

  // 去掉可能粘在 URL 末尾的 (@网易云音乐)、（@xxx） 等
  url = url
    .replace(/\s*\(@[^)]*\)\s*$/i, "")
    .replace(/\s*（@[^）]*）\s*$/g, "")
    .replace(/(@[\u4e00-\u9fff\w]+)\s*$/g, "")
    .replace(/[\s）\)\u4e00-\u9fff]+$/g, "")
    .trim();

  return url.startsWith("http://") || url.startsWith("https://") ? url : "";
}

/** 短链接重定向：若为 163cn.tv 则从 302 Location 头提取真实长链接 */
async function resolveShortLink(url: string): Promise<string> {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host !== "163cn.tv" && !host.endsWith(".163cn.tv")) {
      return url;
    }
    // 用 manual 模式拿到 302 的 Location，避免被后续 HTML 页面覆盖
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const location = res.headers.get("location");
    console.log("[parse-netease] 163cn.tv redirect location:", location);
    if (location && location.startsWith("http")) {
      return location;
    }
    return url;
  } catch {
    return url;
  }
}

function parseNeteaseUrl(url: string): ParseResult {
  try {
    const trimmed = url.trim();
    // 主站格式：music.163.com/#/song?id=123 或 /song/123
    const mainMatch = trimmed.match(
      /music\.163\.com[^/]*\/(?:#\/)?(song|album|playlist)(?:\?id=|\/)(\d+)/i
    );
    if (mainMatch) {
      return {
        type: mainMatch[1] as "song" | "album" | "playlist",
        id: mainMatch[2],
      };
    }
    const songMatch = trimmed.match(/music\.163\.com[^/]*\/song\?id=(\d+)/i);
    if (songMatch) return { type: "song", id: songMatch[1] };
    const albumMatch = trimmed.match(/music\.163\.com[^/]*\/album\?id=(\d+)/i);
    if (albumMatch) return { type: "album", id: albumMatch[1] };
    // 兜底：任意 ?id= 或 &id=
    const idMatch = trimmed.match(/[?&]id=(\d+)/);
    if (idMatch) return { type: "song", id: idMatch[1] };
    return null;
  } catch {
    return null;
  }
}

function extractSongInfo(song: Record<string, unknown>) {
  const al = song.al || song.album || {};
  const ar = song.ar || song.artists || [];
  const albumName =
    (al as { name?: string })?.name || (song.name as string) || "未知专辑";
  const artistName = Array.isArray(ar)
    ? (ar as { name?: string }[]).map((a) => a?.name).filter(Boolean).join(", ")
    : "";
  const picUrl =
    (al as { picUrl?: string })?.picUrl ||
    (al as { pic?: string })?.pic ||
    (song as { picUrl?: string })?.picUrl ||
    "";

  return {
    albumName,
    artistName,
    picUrl: (picUrl as string).replace(/^http:/, "https:"),
    songName: song.name as string,
  };
}

type SongInfo = {
  albumName: string;
  artistName: string;
  picUrl: string;
  songName: string | null;
  songId: string | null;
  /** 专辑解析时拉取第一首的歌词，便于出现在歌词墙 */
  lyrics?: string | null;
};

/** 获取歌曲歌词（委托给 lib，此处保留别名供专辑分支调用） */
function fetchLyrics(baseUrl: string, songId: string): Promise<string | null> {
  return fetchNeteaseLyrics(baseUrl, songId);
}

const FETCH_TIMEOUT_MS = 60000; // Railway 冷启动可能需 30-60 秒

/** 使用 NeteaseCloudMusicApi（需本地运行 npx NeteaseCloudMusicApi） */
async function fetchViaNeteaseApi(
  baseUrl: string,
  type: "song" | "album",
  id: string
): Promise<SongInfo> {
  const url = baseUrl.replace(/\/$/, "");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    if (type === "song") {
      const res = await fetch(`${url}/song/detail?ids=${id}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error("API 请求失败");
    const data = await res.json();
    const songs = data?.songs;
    if (!songs?.length) throw new Error("未找到歌曲信息");
    const info = extractSongInfo(songs[0]);
    return { ...info, songId: id };
    } else {
      const ctrl2 = new AbortController();
      const t2 = setTimeout(() => ctrl2.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(`${url}/album?id=${id}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: ctrl2.signal,
      });
      clearTimeout(t2);
      if (!res.ok) throw new Error("API 请求失败");
    const data = await res.json();
    const album = data?.album;
    if (!album?.name) throw new Error("未找到专辑信息");
    const artist = album.artist || album.artists;
    const artistName = Array.isArray(artist)
      ? artist.map((a: { name?: string }) => a?.name).filter(Boolean).join(", ")
      : (artist?.name as string) || "";
    const songs = album.songs ?? album.tracks;
    const firstSong = Array.isArray(songs) && songs.length > 0 ? songs[0] : null;
    const firstSongId = firstSong ? String((firstSong as { id?: number }).id ?? (firstSong as { id?: string }).id ?? "") : null;
    const firstSongName = firstSong ? ((firstSong as { name?: string }).name ?? null) : null;
    let lyrics: string | null = null;
    if (firstSongId && firstSongId !== "0") {
      const raw = await fetchLyrics(url, firstSongId);
      lyrics = raw ?? null;
    }
    return {
      albumName: album.name,
      artistName,
      picUrl: (album.picUrl || album.pic || "").replace(/^http:/, "https:"),
      songName: firstSongName ?? null,
      songId: firstSongId ?? null,
      lyrics: lyrics ?? null,
    };
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 下载封面并保存到存储。
 * 在 Vercel 环境如果没有配置 Blob 存储，则直接使用原始 CDN URL。
 */
async function downloadAndSaveCover(picUrl: string): Promise<string> {
  if (!picUrl?.startsWith("http")) throw new Error("无效的封面地址");

  // Vercel 上没有 Blob Token 时，直接使用网易云 CDN 链接（避免 EROFS 错误）
  if (isVercel && !hasBlobToken) {
    return picUrl;
  }

  const res = await fetch(picUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });
  if (!res.ok) throw new Error("封面下载失败");
  const buffer = Buffer.from(await res.arrayBuffer());
  const ext = picUrl.includes("jpg") || picUrl.includes("jpeg") ? "jpg" : "png";
  const filename = `albums/${randomUUID()}.${ext}`;
  return saveImage(buffer, filename);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawInput = body?.url?.trim();
    const categoryId = body?.categoryId ?? null;
    if (!rawInput) {
      return NextResponse.json(
        { error: "请输入网易云音乐链接" },
        { status: 400 }
      );
    }

    // 1. 链接清洗
    let url = extractAndCleanUrl(rawInput);
    console.log("[parse-netease] rawInput:", JSON.stringify(rawInput).slice(0, 300));
    console.log("[parse-netease] cleaned url:", JSON.stringify(url));
    if (!url) {
      return NextResponse.json(
        { error: "链接格式不正确，请尝试复制歌曲的长链接（未提取到URL）" },
        { status: 400 }
      );
    }

    // 2. 短链接重定向（163cn.tv）
    url = await resolveShortLink(url);
    console.log("[parse-netease] after redirect:", url);

    // 3. 统一提取 songId / albumId
    const parsed = parseNeteaseUrl(url);
    console.log("[parse-netease] parsed:", parsed);
    if (!parsed) {
      return NextResponse.json(
        { error: `链接格式不正确，请尝试复制歌曲的长链接（解析后URL: ${url.slice(0, 100)}）` },
        { status: 400 }
      );
    }

    if (parsed.type === "playlist") {
      return NextResponse.json(
        { error: "暂不支持歌单链接，请使用歌曲或专辑链接" },
        { status: 400 }
      );
    }

    const apiBase = process.env.NETEASE_API_URL;

    if (!apiBase) {
      return NextResponse.json(
        {
          error:
            "请先配置网易云 API。在项目根目录运行：npx NeteaseCloudMusicApi（端口需与 3000 不同），然后在 .env.local 中添加 NETEASE_API_URL=http://localhost:端口",
        },
        { status: 503 }
      );
    }

    const info = await fetchViaNeteaseApi(apiBase, parsed.type, parsed.id);

    if (!info.picUrl) {
      return NextResponse.json(
        { error: "未能获取封面图片" },
        { status: 400 }
      );
    }

    // 歌词：单曲链接在此拉取；专辑链接已在 fetchViaNeteaseApi 中拉取第一首
    let lyrics: string | null = info.lyrics ?? null;
    if (parsed.type === "song" && info.songId && !lyrics) {
      const raw = await fetchLyrics(apiBase, info.songId);
      lyrics = raw ?? null;
    }

    const imageUrl = await downloadAndSaveCover(info.picUrl);

    const album = await withDbRetry(() =>
      prisma.albumCover.create({
        data: {
          imageUrl,
          albumName: info.albumName,
          artistName: info.artistName || null,
          songId: info.songId || null,
          songName: info.songName || null,
          lyrics,
          albumId: parsed.type === "album" ? parsed.id : null,
          releaseYear: null,
          genre: null,
          notes: null,
          categoryId: categoryId || null,
        },
      })
    );

    return NextResponse.json({
      success: true,
      album,
    });
  } catch (error) {
    console.error("Parse NetEase error:", error);
    const rawMsg = error instanceof Error ? error.message : String(error);
    const isConn = isDbConnectionError(error);
    const isNetwork =
      rawMsg === "fetch failed" ||
      /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|network/i.test(rawMsg);
    let finalMsg: string;
    if (isConn) {
      finalMsg =
        "数据库连接被断开（已自动重试一次仍失败）。请将 DATABASE_URL 改为 Neon 的「Pooled connection」连接串并重启。";
    } else if (isNetwork) {
      const hasUrl = !!process.env.NETEASE_API_URL?.trim();
      const apiHost = process.env.NETEASE_API_URL || "";
      const isRailway = /railway|railway\.app/i.test(apiHost);
      finalMsg = hasUrl
        ? isRailway
          ? "无法连接网易云 API。若使用 Railway，首次请求可能需 30–60 秒冷启动，请稍后重试。或改用本地 API：运行 npm run netease-api，并设置 NETEASE_API_URL=http://localhost:3002"
          : "无法连接网易云 API（网络错误）。请确认：1) NETEASE_API_URL 可从本机访问；2) 若为本地地址，请先运行 npx NeteaseCloudMusicApi。"
        : "请先在 .env.local 中配置 NETEASE_API_URL，并运行 npx NeteaseCloudMusicApi（或填写公网 API 地址）。";
    } else {
      finalMsg = rawMsg || "解析失败，请确认 NeteaseCloudMusicApi 已运行且 NETEASE_API_URL 正确";
    }
    return NextResponse.json({ error: finalMsg }, { status: 500 });
  }
}
