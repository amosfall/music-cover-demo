import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SongResult = {
  id: number;
  name: string;
  artistName: string;
  albumName: string;
  albumId: number;
  picUrl: string;
  matchedLyrics: string | null; // 匹配到的歌词片段
  matchScore: number; // 匹配度分数
};

/**
 * 从网易云 API 获取歌曲的完整歌词
 */
async function fetchSongLyrics(
  songId: number,
  apiBase: string
): Promise<string | null> {
  try {
    const url = `${apiBase}/lyric?id=${songId}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const lrc = data?.lrc?.lyric;
    if (!lrc) return null;
    // 去除时间戳，返回纯歌词文本
    return lrc
      .split("\n")
      .map((line: string) => line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, "").trim())
      .filter((line: string) => line.length > 0)
      .join("\n");
  } catch {
    return null;
  }
}

/**
 * 在歌词文本中寻找包含用户输入的那一行，返回匹配片段
 */
function findMatchedSnippet(
  fullLyrics: string,
  userInput: string
): { snippet: string; score: number } | null {
  const inputNorm = userInput.replace(/\s+/g, "").toLowerCase();
  if (!inputNorm) return null;

  const lines = fullLyrics.split("\n");

  // 1. 精确包含：歌词某一行包含用户输入的完整内容
  for (const line of lines) {
    const lineNorm = line.replace(/\s+/g, "").toLowerCase();
    if (lineNorm.includes(inputNorm)) {
      return { snippet: line.trim(), score: 100 };
    }
  }

  // 2. 用户输入包含歌词某一行（用户输入了更多内容）
  for (const line of lines) {
    const lineNorm = line.replace(/\s+/g, "").toLowerCase();
    if (lineNorm.length > 3 && inputNorm.includes(lineNorm)) {
      return { snippet: line.trim(), score: 80 };
    }
  }

  // 3. 模糊匹配：计算字符重叠度
  let bestLine = "";
  let bestOverlap = 0;
  for (const line of lines) {
    const lineNorm = line.replace(/\s+/g, "").toLowerCase();
    if (lineNorm.length < 2) continue;
    // 计算连续公共子串长度
    let overlap = 0;
    for (let i = 0; i < inputNorm.length; i++) {
      for (let j = i + 2; j <= inputNorm.length; j++) {
        const sub = inputNorm.slice(i, j);
        if (lineNorm.includes(sub) && sub.length > overlap) {
          overlap = sub.length;
        }
      }
    }
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestLine = line.trim();
    }
  }

  if (bestOverlap >= 3) {
    const score = Math.min(70, Math.round((bestOverlap / inputNorm.length) * 70));
    return { snippet: bestLine, score };
  }

  return null;
}

function parseSongBasic(song: Record<string, unknown>) {
  const al = (song.al || song.album || {}) as Record<string, unknown>;
  const ar = (song.ar || song.artists || []) as { name?: string }[];
  return {
    id: song.id as number,
    name: (song.name as string) || "未知歌曲",
    artistName: Array.isArray(ar)
      ? ar.map((a) => a?.name).filter(Boolean).join(", ")
      : "",
    albumName: (al.name as string) || "未知专辑",
    albumId: (al.id as number) || 0,
    picUrl: ((al.picUrl as string) || "").replace(/^http:/, "https:"),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keywords = searchParams.get("keywords")?.trim();
    const searchType = searchParams.get("type") || "lyrics";

    if (!keywords) {
      return NextResponse.json(
        { error: "请输入搜索关键词" },
        { status: 400 }
      );
    }

    const apiBase = process.env.NETEASE_API_URL;
    if (!apiBase) {
      return NextResponse.json(
        { error: "未配置 NETEASE_API_URL，无法搜索" },
        { status: 503 }
      );
    }

    const base = apiBase.replace(/\/$/, "");
    const headers = { "User-Agent": "Mozilla/5.0" };

    // ===== 按歌曲名搜索（简单模式） =====
    if (searchType === "song") {
      const url = `${base}/cloudsearch?keywords=${encodeURIComponent(keywords)}&type=1&limit=10`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`网易云 API 响应 ${res.status}`);
      const data = await res.json();
      const songs = data?.result?.songs;
      if (!Array.isArray(songs) || songs.length === 0) {
        return NextResponse.json({ results: [] });
      }
      const results: SongResult[] = songs.map(
        (song: Record<string, unknown>) => ({
          ...parseSongBasic(song),
          matchedLyrics: null,
          matchScore: 0,
        })
      );
      return NextResponse.json({ results });
    }

    // ===== 按歌词内容搜索（type=1006） =====
    console.log(`[search-songs] 歌词搜索关键词: "${keywords}"`);

    const lyricsUrl = `${base}/cloudsearch?keywords=${encodeURIComponent(keywords)}&type=1006&limit=20`;
    const lyricsRes = await fetch(lyricsUrl, { headers });

    let candidateSongs: Record<string, unknown>[] = [];

    if (lyricsRes.ok) {
      const lyricsData = await lyricsRes.json();
      console.log(
        `[search-songs] type=1006 返回歌曲数:`,
        lyricsData?.result?.songs?.length ?? 0
      );
      // 打印前5个结果方便调试
      if (Array.isArray(lyricsData?.result?.songs)) {
        lyricsData.result.songs.slice(0, 5).forEach((s: Record<string, unknown>, i: number) => {
          const ar = (s.ar || s.artists || []) as { name?: string }[];
          const artistStr = Array.isArray(ar)
            ? ar.map((a) => a?.name).filter(Boolean).join(", ")
            : "";
          console.log(
            `[search-songs]   #${i + 1}: ${s.name} - ${artistStr} (id: ${s.id})`
          );
          // 检查是否有内联歌词字段
          if (s.lyrics) console.log(`[search-songs]     lyrics field:`, s.lyrics);
          if (s.txt) console.log(`[search-songs]     txt field:`, s.txt);
        });
        candidateSongs = lyricsData.result.songs;
      }
    }

    // 如果 type=1006 没有结果，回退 type=1
    if (candidateSongs.length === 0) {
      console.log(`[search-songs] type=1006 无结果，回退 type=1`);
      const fallbackUrl = `${base}/cloudsearch?keywords=${encodeURIComponent(keywords)}&type=1&limit=15`;
      const fallbackRes = await fetch(fallbackUrl, { headers });
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        if (Array.isArray(fallbackData?.result?.songs)) {
          candidateSongs = fallbackData.result.songs;
          console.log(
            `[search-songs] type=1 返回歌曲数: ${candidateSongs.length}`
          );
        }
      }
    }

    if (candidateSongs.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // 取前 10 首，逐个获取歌词并匹配
    const top = candidateSongs.slice(0, 10);
    const results: SongResult[] = await Promise.all(
      top.map(async (song) => {
        const basic = parseSongBasic(song);
        const fullLyrics = await fetchSongLyrics(basic.id, base);
        let matchedLyrics: string | null = null;
        let matchScore = 0;

        if (fullLyrics) {
          const match = findMatchedSnippet(fullLyrics, keywords);
          if (match) {
            matchedLyrics = match.snippet;
            matchScore = match.score;
            console.log(
              `[search-songs]   "${basic.name}" 匹配分数=${match.score}, 片段="${match.snippet}"`
            );
          }
        }

        return {
          ...basic,
          matchedLyrics,
          matchScore,
        };
      })
    );

    // 按匹配度排序：有匹配的排前面，匹配度高的优先
    results.sort((a, b) => b.matchScore - a.matchScore);

    console.log(
      `[search-songs] 最终结果:`,
      results.slice(0, 5).map((r) => `${r.name}(${r.matchScore})`)
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search songs error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "搜索失败" },
      { status: 500 }
    );
  }
}
