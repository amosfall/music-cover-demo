"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import ScatteredLyrics from "@/components/ScatteredLyrics";
import type { LyricFragment } from "@/components/ScatteredLyrics";
import AlbumStrip from "@/components/AlbumStrip";
import type { StripItem } from "@/components/AlbumStrip";
import TabNav from "@/components/TabNav";

type WallItem = {
  id: string;
  lyrics: string;
  songName: string | null;
  albumName: string;
  artistName: string | null;
  imageUrl: string;
  source: "album" | "card";
};

/** 每首歌最多取的歌词行数，避免几百行歌词淹没屏幕 */
const MAX_LINES_PER_SONG = 6;

export default function LyricsWallPage() {
  const [items, setItems] = useState<WallItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    fetch("/api/lyrics-wall")
      .then((res) => res.json())
      .then((data) => {
        setItems(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 过滤元信息行（作词/作曲等）
  const metaRegex = /^(作词|作曲|编曲|制作人|混音|母带|录音|吉他|贝斯|鼓|键盘|和声|监制|出品|词|曲|编)\s*[：:]/i;

  // 将所有歌词拆分为 fragments
  const fragments: LyricFragment[] = useMemo(() => {
    const result: LyricFragment[] = [];
    for (const item of items) {
      const lines = item.lyrics
        .split(/\n/)
        .map((l) => l.trim())
        .filter((l) => l && !metaRegex.test(l));
      const selected = lines.slice(0, MAX_LINES_PER_SONG);
      for (const line of selected) {
        result.push({
          text: line,
          sourceId: item.id,
          albumName: item.albumName,
          artistName: item.artistName,
        });
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // 去重的专辑列表（用于底部 dock）
  const albumList: StripItem[] = useMemo(() => {
    const seen = new Set<string>();
    const list: StripItem[] = [];
    for (const item of items) {
      const key = `${item.albumName}||${item.imageUrl}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push({
          id: item.id,
          imageUrl: item.imageUrl,
          albumName: item.albumName,
          artistName: item.artistName,
        });
      }
    }
    return list;
  }, [items]);

  const handleSelectAlbum = (album: StripItem) => {
    // toggle: 再次点击相同的取消高亮
    setHighlightId((prev) => (prev === album.id ? null : album.id));
  };

  const handleDeleteAlbum = async (album: StripItem) => {
    if (!confirm(`确定删除「${album.albumName}」的歌词？`)) return;
    // 找到对应的 WallItem 来确定 source 和 id
    const item = items.find((i) => i.id === album.id);
    if (!item) return;
    const endpoint =
      item.source === "album"
        ? `/api/albums/${item.id}`
        : `/api/lyrics/${item.id}`;
    const res = await fetch(endpoint, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      if (highlightId === item.id) setHighlightId(null);
    }
  };

  const handleClickBackground = () => {
    setHighlightId(null);
  };

  // ── 加载态 ──
  if (loading) {
    return (
      <div className="lyrics-gallery">
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
        </div>
      </div>
    );
  }

  // ── 空态 ──
  if (fragments.length === 0) {
    return (
      <div className="lyrics-gallery">
        <header className="flex items-center justify-between px-6 pt-6 sm:px-10 sm:pt-8">
          <TabNav />
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center px-4">
          <p className="text-5xl opacity-20">&#x1F3B6;</p>
          <p className="text-lg font-light text-gray-400">还没有歌词数据</p>
          <p className="text-sm text-gray-400/60 max-w-sm">
            在封面页粘贴网易云歌曲链接抓取，或在歌词页手动添加，歌词会在这里漂浮展示
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="/"
              className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white no-underline transition-opacity hover:opacity-90"
            >
              去封面页添加歌曲
            </a>
            <a
              href="/lyrics"
              className="rounded-full border border-[var(--paper-dark)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--ink)] no-underline transition-colors hover:bg-[var(--paper-dark)]"
            >
              去歌词页手动添加
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── 正常态 ──
  return (
    <div className="lyrics-gallery" onClick={handleClickBackground}>
      {/* 顶部 */}
      <header
        className="relative z-10 flex items-center justify-between px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2 sm:px-10 sm:pt-7"
        onClick={(e) => e.stopPropagation()}
      >
        <TabNav />
      </header>

      {/* 散乱漂浮歌词 */}
      <ScatteredLyrics fragments={fragments} highlightId={highlightId} />

      {/* 底部专辑 Dock */}
      <div onClick={(e) => e.stopPropagation()}>
        <AlbumStrip
          items={albumList}
          activeId={highlightId}
          onSelect={handleSelectAlbum}
          onDelete={handleDeleteAlbum}
        />
      </div>
    </div>
  );
}
