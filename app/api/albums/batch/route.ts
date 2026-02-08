import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";
import { fetchNeteaseLyrics } from "@/lib/netease-lyrics";
import { getUserIdOr401 } from "@/lib/auth";

export const maxDuration = 60;

type AlbumInput = {
  imageUrl: string;
  albumName: string;
  artistName?: string | null;
  /** 网易云歌曲 ID，传入则按这首歌拉取歌词并写入 */
  songId?: string | null;
  /** 歌曲名（与 songId 配套，用于展示「导入的是哪一首」） */
  songName?: string | null;
};

export async function POST(request: NextRequest) {
  const authResult = await getUserIdOr401();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const albums = body?.albums;
    const categoryId = body?.categoryId ?? null;
    if (!Array.isArray(albums) || albums.length === 0) {
      return NextResponse.json(
        { error: "请提供 albums 数组（每项含 imageUrl、albumName）" },
        { status: 400 }
      );
    }

    const apiBase = process.env.NETEASE_API_URL?.trim();
    const created: { id: string }[] = [];

    for (const a of albums as AlbumInput[]) {
      const imageUrl = a?.imageUrl?.trim();
      const albumName = a?.albumName?.trim();
      if (!imageUrl || !albumName) continue;

      let lyrics: string | null = null;
      const songId = a?.songId?.trim() || null;
      const songName = a?.songName?.trim() || null;
      if (songId && apiBase) {
        lyrics = await fetchNeteaseLyrics(apiBase, songId);
        if (!lyrics) lyrics = null;
      }

      const item = await withDbRetry(() =>
        prisma.albumCover.create({
          data: {
            imageUrl,
            albumName,
            artistName: a?.artistName ?? null,
            songId: songId || null,
            songName: songName || null,
            lyrics,
            categoryId: categoryId || null,
            userId: authResult.userId,
          },
        })
      );
      created.push({ id: item.id });
    }

    return NextResponse.json({ created: created.length, ids: created.map((c) => c.id) });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Batch create albums error:", error);
    // 便于在 Vercel 日志或响应中排查：数据库/连接类错误给出明确提示
    const isDb =
      /DATABASE_URL|connection|P1001|P1017|ECONNREFUSED|ETIMEDOUT|Connection terminated/i.test(msg);
    const hint = isDb
      ? "请检查 Vercel 环境变量 DATABASE_URL 是否配置且为 Neon 的 Pooled 连接串（主机名含 -pooler）。"
      : undefined;
    return NextResponse.json(
      { error: "批量保存失败", hint },
      { status: 500 }
    );
  }
}
