"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import ScatteredLyrics from "@/components/ScatteredLyrics";
import type { LyricFragment } from "@/components/ScatteredLyrics";
import AlbumStrip from "@/components/AlbumStrip";
import type { StripItem } from "@/components/AlbumStrip";
import TabNav from "@/components/TabNav";
import { getProxyImageUrl } from "@/lib/proxy-image";

type WallItem = {
  id: string;
  lyrics: string;
  songName: string | null;
  albumName: string;
  artistName: string | null;
  imageUrl: string;
  source: "album" | "card";
  showOnLyricsWall?: boolean;
};

/** 每首歌最多取的歌词行数，避免几百行歌词淹没屏幕 */
const MAX_LINES_PER_SONG = 6;

export default function LyricsWallPage() {
  const [items, setItems] = useState<WallItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const fetchVersionRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const userHasToggledRef = useRef(false);
  useEffect(() => setMounted(true), []);

  const fetchData = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    const version = ++fetchVersionRef.current;
    fetch("/api/lyrics-wall", { signal, cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (version !== fetchVersionRef.current) return;
        if (userHasToggledRef.current) return;
        setItems(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchData();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchData]);

  // 过滤元信息行：中文（作词/作曲等） + 英文（Produced by 等） + 人名/角色+冒号（合唱 enno:、男：、女： 等）
  const metaRegexCn = /^(作词|作曲|编曲|制作人|混音|母带|录音|吉他|贝斯|鼓|键盘|和声|监制|出品|词|曲|编)\s*[：:]/i;
  const metaRegexEn =
    /^(Produced by|Co-produced by|Written by|Composed by|Coordinated by|Mixed by|Mastered by|Recorded by|Engineered by|Acoustic guitar|Electric guitar|Bass|Guitar|Drums|Piano|Keyboards|Strings|Vocals|Backing vocals|Synth|Programming|Cover)\s*[：:]/i;
  /** 人名/角色+冒号：enno:、男：、女：、合唱：、独唱： 等 */
  const nameLabelRegex = /^[a-zA-Z][a-zA-Z0-9_\s]{0,24}\s*[：:]/;
  const roleLabelRegex = /^(男|女|合唱|独唱|男声|女声)\s*[：:]/;
  const isMetaLine = (line: string) =>
    metaRegexCn.test(line) ||
    metaRegexEn.test(line) ||
    nameLabelRegex.test(line) ||
    roleLabelRegex.test(line);
  // 去掉 LRC 时间戳 [00:00.00]，只保留有效歌词
  const stripLrcTime = (line: string) =>
    line.replace(/^\s*\[\d{1,2}:\d{2}([.:]\d{2,3})?\]\s*/, "").trim();

  // 只展示勾选「上墙」的项（老数据无字段时视为 true）
  const displayItems = useMemo(
    () => items.filter((i) => i.showOnLyricsWall !== false),
    [items]
  );

  // 将所有歌词拆分为 fragments（仅用 displayItems）
  const fragments: LyricFragment[] = useMemo(() => {
    const result: LyricFragment[] = [];
    for (const item of displayItems) {
      const lines = item.lyrics
        .split(/\n/)
        .map((l) => stripLrcTime(l))
        .filter((l) => l && !isMetaLine(l));
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
  }, [displayItems]);

  // 去重的专辑列表（用于底部 dock，仅 displayItems）
  const albumList: StripItem[] = useMemo(() => {
    const seen = new Set<string>();
    const list: StripItem[] = [];
    for (const item of displayItems) {
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
  }, [displayItems]);

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

  const handleToggleShowOnWall = async (item: WallItem, checked: boolean) => {
    userHasToggledRef.current = true;
    setItems((current) =>
      current.map((i) =>
        i.id === item.id ? { ...i, showOnLyricsWall: checked } : i
      )
    );
    const endpoint =
      item.source === "album"
        ? `/api/albums/${item.id}/show-on-lyrics-wall`
        : `/api/lyrics/${item.id}/show-on-lyrics-wall`;
    const res = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showOnLyricsWall: checked }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err?.error || `保存失败 ${res.status}，请刷新后重试`);
    }
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

  // ── 空态：无歌词数据 或 没有勾选上墙的项 ──
  if (fragments.length === 0) {
    return (
      <div className="lyrics-gallery">
        <header className="flex items-center justify-between px-6 pt-6 sm:px-10 sm:pt-8">
          <TabNav />
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => setShowManageModal(true)}
              className="rounded-full border border-[var(--paper-dark)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--paper-dark)]"
            >
              管理展示
            </button>
          )}
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center px-4">
          <p className="text-5xl opacity-20">&#x1F3B6;</p>
          <p className="text-lg font-light text-gray-400">
            {items.length > 0
              ? "当前没有歌曲上墙"
              : "还没有歌词数据"}
          </p>
          <p className="text-sm text-gray-400/60 max-w-sm">
            {items.length > 0
              ? "点击「管理展示」勾选要出现在歌词墙的歌曲"
              : "封面页添加的带歌词的歌曲、以及歌词页手动添加的卡片，都会在这里展示；链接抓取的歌会自动选取有效歌词行"}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {items.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowManageModal(true)}
                className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                管理展示
              </button>
            ) : (
              <>
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
              </>
            )}
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
        <button
          type="button"
          onClick={() => setShowManageModal(true)}
          className="rounded-full border border-[var(--paper-dark)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--paper-dark)]"
        >
          管理展示
        </button>
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

      {/* 管理展示弹层：用 Portal 挂到 body，避免被歌词墙的 DOM/事件影响 */}
      {mounted &&
        showManageModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
            onClick={(e) => e.target === e.currentTarget && setShowManageModal(false)}
          >
            <div
              className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[var(--paper-dark)] p-4">
                <h2 className="text-lg font-medium text-[var(--ink)]">选择上墙</h2>
                <button
                  type="button"
                  onClick={() => setShowManageModal(false)}
                  className="rounded-full p-1.5 text-[var(--ink-muted)] hover:bg-[var(--paper-dark)] hover:text-[var(--ink)]"
                  aria-label="关闭"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <p className="mb-3 text-sm text-[var(--ink-muted)]">点击整行勾选/取消，勾选的歌曲会出现在歌词墙</p>
                <ul className="space-y-2">
                  {items.map((item) => {
                    const isOn = item.showOnLyricsWall !== false;
                    return (
                      <li
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--paper-dark)]/50 p-3 transition-colors hover:bg-[var(--paper-dark)]/20 active:bg-[var(--paper-dark)]/30"
                        onClick={() => handleToggleShowOnWall(item, !isOn)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleToggleShowOnWall(item, !isOn);
                          }
                        }}
                      >
                        <span
                          role="checkbox"
                          aria-checked={isOn}
                          className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border-2 border-[var(--ink-muted)] bg-white hover:border-[var(--ink)]"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleShowOnWall(item, !isOn);
                          }}
                        >
                          {isOn && (
                            <svg className="h-3 w-3 text-[var(--ink)]" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </span>
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--paper-dark)]">
                          <img
                            src={getProxyImageUrl(item.imageUrl)}
                            alt=""
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[var(--ink)]">{item.albumName}</p>
                          {item.artistName && (
                            <p className="truncate text-xs text-[var(--ink-muted)]">{item.artistName}</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
