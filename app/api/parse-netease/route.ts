import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { saveImage, isVercel, hasBlobToken } from "@/lib/storage";
import { isDbConnectionError, withDbRetry } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParseResult = { type: "song" | "album" | "playlist"; id: string } | null;

function parseNeteaseUrl(url: string): ParseResult {
  try {
    const trimmed = url.trim();
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

/** 使用 NeteaseCloudMusicApi（需本地运行 npx NeteaseCloudMusicApi） */
async function fetchViaNeteaseApi(
  baseUrl: string,
  type: "song" | "album",
  id: string
): Promise<{ albumName: string; artistName: string; picUrl: string }> {
  const url = baseUrl.replace(/\/$/, "");
  if (type === "song") {
    const res = await fetch(`${url}/song/detail?ids=${id}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) throw new Error("API 请求失败");
    const data = await res.json();
    const songs = data?.songs;
    if (!songs?.length) throw new Error("未找到歌曲信息");
    return extractSongInfo(songs[0]);
  } else {
    const res = await fetch(`${url}/album?id=${id}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) throw new Error("API 请求失败");
    const data = await res.json();
    const album = data?.album;
    if (!album?.name) throw new Error("未找到专辑信息");
    const artist = album.artist || album.artists;
    const artistName = Array.isArray(artist)
      ? artist.map((a: { name?: string }) => a?.name).filter(Boolean).join(", ")
      : (artist?.name as string) || "";
    return {
      albumName: album.name,
      artistName,
      picUrl: (album.picUrl || album.pic || "").replace(/^http:/, "https:"),
    };
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
    const url = body?.url?.trim();
    if (!url) {
      return NextResponse.json(
        { error: "请输入网易云音乐链接" },
        { status: 400 }
      );
    }

    const parsed = parseNeteaseUrl(url);
    if (!parsed) {
      return NextResponse.json(
        { error: "无法识别链接格式，请粘贴完整的歌曲或专辑链接" },
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

    let info: { albumName: string; artistName: string; picUrl: string };
    info = await fetchViaNeteaseApi(apiBase, parsed.type, parsed.id);

    if (!info.picUrl) {
      return NextResponse.json(
        { error: "未能获取封面图片" },
        { status: 400 }
      );
    }

    const imageUrl = await downloadAndSaveCover(info.picUrl);

    const album = await withDbRetry(() =>
      prisma.albumCover.create({
        data: {
          imageUrl,
          albumName: info.albumName,
          artistName: info.artistName || null,
          releaseYear: null,
          genre: null,
          notes: null,
        },
      })
    );

    return NextResponse.json({
      success: true,
      album,
    });
  } catch (error) {
    console.error("Parse NetEase error:", error);
    const msg =
      error instanceof Error
        ? error.message
        : "解析失败，请确认 NeteaseCloudMusicApi 已运行且 NETEASE_API_URL 正确";
    const isConn = isDbConnectionError(error);
    const finalMsg = isConn
      ? "数据库连接被断开（已自动重试一次仍失败）。请将 DATABASE_URL 改为 Neon 的「Pooled connection」连接串并重启。"
      : msg;
    return NextResponse.json({ error: finalMsg }, { status: 500 });
  }
}
