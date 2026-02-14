"use client";

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { flushSync } from "react-dom";
import { useSearchParams, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useAuth } from "@clerk/nextjs";
import ScatteredLyrics from "@/components/ScatteredLyrics";
import type { LyricFragment } from "@/components/ScatteredLyrics";
import AlbumStrip from "@/components/AlbumStrip";
import type { StripItem } from "@/components/AlbumStrip";
import TabNav from "@/components/TabNav";
import WelcomeScreen from "@/components/WelcomeScreen";
import { getProxyImageUrl } from "@/lib/proxy-image";

type WallItem = {
  id: string;
  lyrics: string;
  songName: string | null;
  albumName: string;
  artistName: string | null;
  releaseYear: string | null;
  imageUrl: string;
  source: "album" | "card";
  showOnLyricsWall?: boolean;
};

/** 每首歌最多取的歌词行数，避免几百行歌词淹没屏幕 */
const MAX_LINES_PER_SONG = 6;


/** 专辑唯一键，同一专辑合并为一条 */
function getAlbumKey(item: { albumName: string; imageUrl: string }) {
  return `${item.albumName}||${item.imageUrl}`;
}

const STRIP_ORDER_STORAGE_KEY = "lyrics-wall-strip-order";

const EMPTY_HINT_STORAGE_KEY = "lyrics-wall-empty-hint";
const DEFAULT_EMPTY_HINT = `登录之后点清空,然后复制歌单链接,就可以形成自己的专辑/文字墙
复制歌单的链接到"歌"底部的"这里",稍等片刻就可以识别成功喔
在诗的歌,点击任意一行歌词即可查看
建议歌单里10首歌左右效果为最佳
联系邮箱：amosfallcheng@gmail.com`;

/** 去掉 LRC 时间戳 [00:00.00]，只保留有效歌词 */
function stripLrcTime(line: string): string {
  return line.replace(/^\s*\[\d{1,2}:\d{2}([.:]\d{2,3})?\]\s*/, "").trim();
}

function loadStripOrder(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const s = window.localStorage.getItem(STRIP_ORDER_STORAGE_KEY);
    if (!s) return [];
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStripOrder(ids: string[]) {
  try {
    window.localStorage.setItem(STRIP_ORDER_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

function LyricsWallContent() {
  const { isSignedIn, isLoaded } = useAuth();
  const [showWelcome, setShowWelcome] = useState(true);
  const [items, setItems] = useState<WallItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  /** 居中界面内「显示哪首歌」：null = 全部，否则为 sourceId 只显示该首 */
  const [centerSongId, setCenterSongId] = useState<string | null>(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [stripOrder, setStripOrder] = useState<string[]>(() => loadStripOrder());
  /** 首次打开页面显示「试着点一行歌词吧」，点击任一行后永久隐藏 */
  const [hintDismissed, setHintDismissed] = useState(false);
  /** 空态说明文案（可编辑），从 localStorage 读取初始值 */
  const [emptyHintText, setEmptyHintText] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_EMPTY_HINT;
    try {
      const saved = window.localStorage.getItem(EMPTY_HINT_STORAGE_KEY);
      return saved != null ? saved : DEFAULT_EMPTY_HINT;
    } catch { return DEFAULT_EMPTY_HINT; }
  });
  const saveEmptyHint = useCallback((value: string) => {
    setEmptyHintText(value);
    try {
      window.localStorage.setItem(EMPTY_HINT_STORAGE_KEY, value);
    } catch {}
  }, []);
  /** 居中块是否已展开完整歌词（双击编辑或点击添加区域时展开） */
  const [centerBlockExpanded, setCenterBlockExpanded] = useState(false);
  const fetchVersionRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const userHasToggledRef = useRef(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (searchParams.get("manage") === "1") setShowManageModal(true);
  }, [searchParams]);
  useEffect(() => {
    setCenterBlockExpanded(false);
  }, [highlightId]);
  const closeManageModal = useCallback(() => {
    setShowManageModal(false);
    if (searchParams.get("manage") === "1") router.replace("/lyrics-wall");
  }, [searchParams, router]);

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
    if (isLoaded) {
      fetchData();
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchData, isLoaded]);

  // 过滤元信息行：作词/作曲/编曲/制作人员等，不展示在歌词墙
  const metaRegexCn =
    /^(作词|作曲|编曲|制作人|制作|混音|混音师|母带|录音|录音师|吉他|电吉他|木吉他|原声吉他弹奏编写|贝斯|鼓|键盘|钢琴|和声|监制|出品|词|曲|编|混音及后制|后制工程|钢琴录制|录音室|吉他[\/／]贝斯|电吉他[\/／]贝斯)\s*[：:]/i;
  const metaRegexEn =
    /^(Produced by|Co-produced by|Written by|Composed by|Arrangement|Coordinated by|Mixed by|Mastered by|Recorded by|Engineered by|Acoustic guitar|Electric guitar|Bass|Guitar|Drums|Piano|Keyboards|Strings|Vocals|Backing vocals|Synth|Programming|Cover)\s*[：:]/i;
  /** 整行以编曲/钢琴/混音等制作信息开头 */
  const creditLineRegex = /^(编曲|混音及后制|后制工程|录音\/混音|钢琴|钢琴录制|录音室)/;
  /** 人名/角色+冒号：enno:、男：、女：、合唱：、独唱： 等 */
  const nameLabelRegex = /^[a-zA-Z][a-zA-Z0-9_\s]{0,24}\s*[：:]/;
  const roleLabelRegex = /^(男|女|合唱|独唱|男声|女声)\s*[：:]/;
  const isMetaLine = (line: string) =>
    metaRegexCn.test(line) ||
    metaRegexEn.test(line) ||
    creditLineRegex.test(line) ||
    nameLabelRegex.test(line) ||
    roleLabelRegex.test(line);
  /** 在歌词字符串中替换某一行（按展示文本匹配），保留 LRC 时间戳 */
  const replaceLyricLine = useCallback(
    (lyrics: string, oldDisplayText: string, newText: string): string => {
      const lines = lyrics.split("\n");
      const lrcTimestampRegex = /^(\s*\[\d{1,2}:\d{2}([.:]\d{2,3})?\]\s*)/;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (stripLrcTime(line) === oldDisplayText) {
          const match = line.match(lrcTimestampRegex);
          const prefix = match ? match[1] : "";
          lines[i] = prefix + newText.trim();
          return lines.join("\n");
        }
      }
      return lyrics;
    },
    []
  );

  /** 删除歌词中的某一行（按展示文本匹配） */
  const removeLyricLine = useCallback((lyrics: string, oldDisplayText: string): string => {
    const lines = lyrics.split("\n");
      const matched = lines.findIndex((l) => stripLrcTime(l) === oldDisplayText);
    const filtered = lines.filter((l) => stripLrcTime(l) !== oldDisplayText);
    return filtered.join("\n");
  }, []);

  /** 在歌词末尾追加一行 */
  const appendLyricLine = useCallback((lyrics: string, newText: string): string => {
    const trimmed = newText.trim();
    if (!trimmed) return lyrics;
    const suffix = lyrics.endsWith("\n") ? "" : "\n";
    return lyrics + suffix + trimmed;
  }, []);

  const handleEditLyric = useCallback(
    async (sourceId: string, oldText: string, newText: string) => {
      if (!isSignedIn) return;
      const item = items.find((i) => i.id === sourceId);
      if (!item) return;
      if (!newText.trim()) {
        // 清空即删除该行，flushSync 确保 UI 即时更新
        const newLyrics = removeLyricLine(item.lyrics, oldText);
        const prevItems = items;
        flushSync(() => {
          setItems((prev) =>
            prev.map((i) => (i.id === sourceId ? { ...i, lyrics: newLyrics } : i))
          );
        });
        const endpoint =
          item.source === "album" ? `/api/albums/${sourceId}` : `/api/lyrics/${sourceId}`;
        const body =
          item.source === "album"
            ? { lyrics: newLyrics }
            : { lyrics: newLyrics, albumName: item.albumName, imageUrl: item.imageUrl };
        const res = await fetch(endpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setItems(prevItems);
          alert(err?.error || `保存失败 ${res.status}，请刷新后重试`);
        }
        return;
      }
      if (newText.trim() === oldText) return;
      const newLyrics = replaceLyricLine(item.lyrics, oldText, newText);
      const prevItems = items;
      // 乐观更新：先更新 UI，居中页面立即显示修改
      setItems((prev) =>
        prev.map((i) => (i.id === sourceId ? { ...i, lyrics: newLyrics } : i))
      );
      const endpoint =
        item.source === "album" ? `/api/albums/${sourceId}` : `/api/lyrics/${sourceId}`;
      const body =
        item.source === "album"
          ? { lyrics: newLyrics }
          : { lyrics: newLyrics, albumName: item.albumName, imageUrl: item.imageUrl };
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setItems(prevItems);
        alert(err?.error || `保存失败 ${res.status}，请刷新后重试`);
      }
    },
    [isSignedIn, items, replaceLyricLine, removeLyricLine]
  );

  const handleDeleteLyricLines = useCallback(
    async (sourceId: string, texts: string[]) => {
      if (!isSignedIn || texts.length === 0) return;
      const item = items.find((i) => i.id === sourceId);
      if (!item) return;
      let newLyrics = item.lyrics;
      for (const t of texts) {
        newLyrics = removeLyricLine(newLyrics, t);
      }
      const prevItems = items;
      flushSync(() => {
        setItems((prev) =>
          prev.map((i) => (i.id === sourceId ? { ...i, lyrics: newLyrics } : i))
        );
      });
      const endpoint =
        item.source === "album" ? `/api/albums/${sourceId}` : `/api/lyrics/${sourceId}`;
      const body =
        item.source === "album"
          ? { lyrics: newLyrics }
          : { lyrics: newLyrics, albumName: item.albumName, imageUrl: item.imageUrl };
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setItems(prevItems);
        alert(err?.error || `保存失败 ${res.status}，请刷新后重试`);
      }
    },
    [isSignedIn, items, removeLyricLine]
  );

  const handleAddLyric = useCallback(
    async (sourceId: string) => {
      if (!isSignedIn) return;
      const item = items.find((i) => i.id === sourceId);
      if (!item) return;
      const newLyrics = appendLyricLine(item.lyrics, "（新歌词行）");
      const prevItems = items;
      setItems((prev) =>
        prev.map((i) => (i.id === sourceId ? { ...i, lyrics: newLyrics } : i))
      );
      const endpoint =
        item.source === "album" ? `/api/albums/${sourceId}` : `/api/lyrics/${sourceId}`;
      const body =
        item.source === "album"
          ? { lyrics: newLyrics }
          : { lyrics: newLyrics, albumName: item.albumName, imageUrl: item.imageUrl };
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setItems(prevItems);
        alert(err?.error || `保存失败 ${res.status}，请刷新后重试`);
      }
    },
    [isSignedIn, items, appendLyricLine]
  );

  const handleEditCredit = useCallback(
    async (
      type: "artist" | "album" | "song",
      newValue: string,
      context: { albumKey: string; sourceId: string }
    ) => {
      if (!isSignedIn) return;
      const { albumKey, sourceId } = context;
      const toUpdate =
        type === "song"
          ? items.filter((i) => i.id === sourceId)
          : items.filter((i) => getAlbumKey(i) === albumKey);
      if (toUpdate.length === 0) return;
      const updateKey =
        type === "artist" ? "artistName" : type === "album" ? "albumName" : "songName";
      const payload =
        type === "artist"
          ? { artistName: newValue }
          : type === "album"
            ? { albumName: newValue }
            : { songName: newValue };

      // 先乐观更新 UI，用户立即看到变化
      const prevItems = items;
      setItems((prev) =>
        prev.map((i) =>
          toUpdate.some((u) => u.id === i.id) ? { ...i, [updateKey]: newValue } : i
        )
      );

      for (const item of toUpdate) {
        const endpoint =
          item.source === "album" ? `/api/albums/${item.id}` : `/api/lyrics/${item.id}`;
        const body =
          item.source === "album"
            ? payload
            : type === "album"
              ? { ...payload, lyrics: item.lyrics, albumName: newValue, imageUrl: item.imageUrl }
              : payload;
        const res = await fetch(endpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          // 失败时回滚
          setItems(prevItems);
          alert(err?.error || `保存失败 ${res.status}，请刷新后重试`);
          return;
        }
      }
    },
    [isSignedIn, items]
  );

  // 只展示勾选「上墙」的项（老数据无字段时视为 true）
  const displayItems = useMemo(
    () => items.filter((i) => i.showOnLyricsWall !== false),
    [items]
  );

  // 将所有歌词拆分为 fragments（仅用 displayItems），带 albumKey / songName 便于按专辑合并与按歌排版
  const fragments: LyricFragment[] = useMemo(() => {
    const result: LyricFragment[] = [];
    for (const item of displayItems) {
      if (!item.lyrics || !item.lyrics.trim()) continue; // 忽略无歌词的項目
      const lines = item.lyrics
        .split(/\n/)
        .map((l) => stripLrcTime(l))
        .filter((l) => l && !isMetaLine(l));
      const selected = lines.slice(0, MAX_LINES_PER_SONG);
      const albumKey = getAlbumKey(item);
      for (const line of selected) {
        result.push({
          text: line,
          sourceId: item.id,
          albumKey,
          albumName: item.albumName,
          artistName: item.artistName,
          songName: item.songName ?? null,
        });
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayItems]);

  /** 居中块编辑用：当前高亮专辑的歌词，只调取 6 行（与展示一致） */
  const centerBlockFragments: LyricFragment[] = useMemo(() => {
    if (!highlightId) return [];
    const result: LyricFragment[] = [];
    for (const item of displayItems) {
      if (getAlbumKey(item) !== highlightId) continue;
      const lines = item.lyrics
        .split(/\n/)
        .map((l) => stripLrcTime(l))
        .filter((l) => l && !isMetaLine(l));
      const selected = lines.slice(0, MAX_LINES_PER_SONG);
      const albumKey = getAlbumKey(item);
      for (const line of selected) {
        result.push({
          text: line,
          sourceId: item.id,
          albumKey,
          albumName: item.albumName,
          artistName: item.artistName,
          songName: item.songName ?? null,
        });
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId, displayItems]);

  // 按专辑去重的列表（用于底部 dock），id 为 albumKey，同一专辑只一条
  const rawAlbumList: StripItem[] = useMemo(() => {
    const seen = new Set<string>();
    const list: StripItem[] = [];
    for (const item of displayItems) {
      const key = getAlbumKey(item);
      if (!seen.has(key)) {
        seen.add(key);
        list.push({
          id: key,
          imageUrl: item.imageUrl,
          albumName: item.albumName,
          artistName: item.artistName,
        });
      }
    }
    return list;
  }, [displayItems]);

  // 按 stripOrder 排序；无 order 时用原始顺序，并同步 stripOrder
  const albumList: StripItem[] = useMemo(() => {
    if (stripOrder.length === 0) return rawAlbumList;
    const orderMap = new Map(stripOrder.map((id, i) => [id, i]));
    return [...rawAlbumList].sort((a, b) => {
      const ai = orderMap.get(a.id) ?? 1e9;
      const bi = orderMap.get(b.id) ?? 1e9;
      return ai - bi;
    });
  }, [rawAlbumList, stripOrder]);

  // 同步 stripOrder：兼容旧版存的 item id，映射为 albumKey 并去重
  useEffect(() => {
    if (rawAlbumList.length === 0) return;
    const itemIdToAlbumKey = new Map(displayItems.map((i) => [i.id, getAlbumKey(i)]));
    const albumKeySet = new Set(rawAlbumList.map((a) => a.id));
    setStripOrder((prev) => {
      let next = prev.map((id) => itemIdToAlbumKey.get(id) ?? id);
      next = next.filter((id) => albumKeySet.has(id));
      next = next.filter((id, i) => next.indexOf(id) === i);
      for (const a of rawAlbumList) {
        if (!next.includes(a.id)) next.push(a.id);
      }
      const result = next.length ? next : rawAlbumList.map((a) => a.id);
      // 仅在结果实际变化时更新，避免冗余 setState 引起的级联重渲染
      if (
        result.length === prev.length &&
        result.every((id, i) => id === prev[i])
      )
        return prev;
      return result;
    });
  }, [rawAlbumList, displayItems]);

  // 居中界面时：左右方向键切换上一张/下一张专辑（循环）
  useEffect(() => {
    if (!highlightId || albumList.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const idx = albumList.findIndex((a) => a.id === highlightId);
      if (idx === -1) return;
      e.preventDefault();
      if (e.key === "ArrowRight") {
        const nextIdx = (idx + 1) % albumList.length;
        setHighlightId(albumList[nextIdx].id);
      } else {
        const prevIdx = (idx - 1 + albumList.length) % albumList.length;
        setHighlightId(albumList[prevIdx].id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [highlightId, albumList]);

  const handleDeleteAlbum = async (album: StripItem) => {
    if (!isSignedIn) return;
    if (!confirm(`确定删除「${album.albumName}」下全部歌曲的歌词？`)) return;
    const albumKey = album.id;
    const toDelete = items.filter((i) => getAlbumKey(i) === albumKey);
    const deletedIds: string[] = [];
    for (const item of toDelete) {
      const endpoint =
        item.source === "album"
          ? `/api/albums/${item.id}`
          : `/api/lyrics/${item.id}`;
      const res = await fetch(endpoint, { method: "DELETE" });
      if (res.ok) deletedIds.push(item.id);
    }
    if (deletedIds.length > 0) {
      setItems((prev) => prev.filter((i) => !deletedIds.includes(i.id)));
    }
    if (highlightId === albumKey) setHighlightId(null);
  };

  // 当前专辑下的歌曲 id 列表（displayItems 顺序），用于点击封面换歌
  const albumSongIds = useMemo(() => {
    if (!highlightId) return [];
    return displayItems.filter((i) => getAlbumKey(i) === highlightId).map((i) => i.id);
  }, [highlightId, displayItems]);

  useEffect(() => {
    if (!highlightId) {
      setCenterSongId(null);
      return;
    }
    if (albumSongIds.length > 1) {
      setCenterSongId(albumSongIds[0]);
    } else {
      setCenterSongId(null);
    }
  }, [highlightId, albumSongIds]);

  const handleSelectAlbum = (album: StripItem) => {
    if (album.id === highlightId) {
      if (albumSongIds.length <= 1) {
        setHighlightId(null);
        return;
      }
      const idx = centerSongId == null ? 0 : albumSongIds.indexOf(centerSongId);
      const nextIdx = (idx + 1) % albumSongIds.length;
      setCenterSongId(albumSongIds[nextIdx]);
      return;
    }
    setHighlightId(album.id);
    setCenterSongId(null);
  };

  const handleClickBackground = () => {
// 点击关闭时先 blur 触发保存，500ms 后关闭，无需用户先按 Enter
          setTimeout(() => setHighlightId(null), 500);
  };

  const handleFragmentClick = useCallback((albumKey: string) => {
    setHintDismissed(true);
    setHighlightId((prev) => (prev === albumKey ? null : albumKey));
  }, []);

  const handleRequestClose = useCallback(() => {
    setTimeout(() => setHighlightId(null), 500);
  }, []);


  const handleToggleShowOnWall = async (item: WallItem, checked: boolean) => {
    if (!isSignedIn) return;
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

  // ── 每次打开诗的歌先显示欢迎页，点击进入后展示歌词墙 ──
  if (showWelcome) {
    return <WelcomeScreen onEnter={() => setShowWelcome(false)} />;
  }

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

  /** 歌词居中沉浸模式：点击某行后 highlightId 有值，隐藏顶部导航与管理展示 */
  const isImmersive = highlightId !== null;

  // 单一 return：空态与正常态二选一渲染主内容，管理展示弹层始终独立渲染，避免「取消全部勾选」后 displayItems 为空导致走空态分支时弹层从树中消失
  return (
    <>
      {fragments.length === 0 ? (
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
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4">
            <p className="text-5xl opacity-20">&#x1F3B6;</p>
            <p className="text-lg font-light text-gray-400 text-center">
              {items.length > 0
                ? "当前没有歌曲上墙"
                : "还没有歌词数据"}
            </p>
            {items.length > 0 ? (
              <p className="text-center text-sm text-[var(--ink-muted)] max-w-sm">
                点击「管理展示」勾选要出现在诗的歌的歌曲
              </p>
            ) : (
              <textarea
                value={emptyHintText}
                onChange={(e) => saveEmptyHint(e.target.value)}
                className="w-full max-w-md resize-y rounded-lg border border-[var(--paper-dark)] bg-white/80 px-4 py-3 text-center text-sm leading-relaxed text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                rows={5}
                placeholder={DEFAULT_EMPTY_HINT}
              />
            )}
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
                  <button
                    type="button"
                    onClick={() => setShowManageModal(true)}
                    className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                  >
                    管理展示
                  </button>
                  <a
                    href="/albums"
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
      ) : (
    <div className="lyrics-gallery relative" onClick={handleClickBackground}>
      {/* 顶部：歌词居中时隐藏，做成沉浸效果 */}
      {!isImmersive && (
        <header
          className="relative z-10 flex items-center justify-between gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2 sm:gap-3 sm:px-10 sm:pt-7"
          onClick={(e) => e.stopPropagation()}
        >
          <TabNav />
          {/* 绝对居中：仅首次打开显示，点击任一行歌词后消失且不再出现 */}
          {!hintDismissed && (
            <div
              className="absolute left-1/2 top-1/2 z-0 max-w-max -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden
            >
              <p
                className="text-center text-base text-[var(--ink-muted)] opacity-40 sm:text-lg"
                style={{ fontFamily: 'SimSun, "宋体", "Songti SC", serif' }}
              >
                试着点一行歌词吧
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              if (!isSignedIn) {
                router.push("/sign-in");
                return;
              }
              setShowManageModal(true);
            }}
            className="shrink-0 rounded-full border border-[var(--paper-dark)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-[var(--paper-dark)] sm:px-4 sm:py-2 sm:text-sm"
          >
            管理展示
          </button>
        </header>
      )}

      {/* 散乱漂浮歌词：点击某行可选中对应专辑、唤起居中展示 */}
      <ScatteredLyrics
        fragments={fragments}
        centerBlockFragments={centerBlockFragments}
        centerBlockExpanded={centerBlockExpanded}
        onExpandCenterBlock={() => setCenterBlockExpanded(true)}
        highlightId={highlightId}
        centerSongId={centerSongId}
        onCenterSongChange={setCenterSongId}
        onFragmentClick={handleFragmentClick}
        onRequestClose={handleRequestClose}
        onEditLyric={isSignedIn ? handleEditLyric : undefined}
        onDeleteLyricLines={isSignedIn ? handleDeleteLyricLines : undefined}
        onEditCredit={isSignedIn ? handleEditCredit : undefined}
        onAddLyric={isSignedIn ? handleAddLyric : undefined}
      />

      {/* 底部专辑 Dock：Portal 到 body，避免被父级 overflow/transform 裁切或遮挡 */}
      {mounted &&
        createPortal(
          <div onClick={(e) => e.stopPropagation()}>
            <AlbumStrip
              items={albumList}
              activeId={highlightId}
              onSelect={handleSelectAlbum}
              onDelete={isSignedIn ? handleDeleteAlbum : undefined}
              onReorder={
                isSignedIn
                  ? (newItems) => {
                      const ids = newItems.map((i) => i.id);
                      setStripOrder(ids);
                      saveStripOrder(ids);
                    }
                  : undefined
              }
            />
          </div>,
          document.body
        )}
    </div>
      )}
      {/* 管理展示弹层：与空态/正常态解耦，始终在 showManageModal 时渲染，避免取消全部勾选后弹层消失 */}
      {mounted &&
        showManageModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.target === e.currentTarget && closeManageModal()}
          >
            <div
              className="flex max-h-[85dvh] w-full max-w-[calc(100vw-2rem)] flex-col rounded-xl bg-white shadow-xl sm:max-w-md sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[var(--paper-dark)] p-4">
                <h2 className="text-lg font-medium text-[var(--ink)]">选择上墙</h2>
                <button
                  type="button"
                  onClick={() => closeManageModal()}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-1.5 text-[var(--ink-muted)] hover:bg-[var(--paper-dark)] hover:text-[var(--ink)]"
                  aria-label="关闭"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <p className="mb-3 text-sm text-[var(--ink-muted)]">点击整行勾选/取消，勾选的歌曲会出现在诗的歌</p>
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
                            crossOrigin="anonymous"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[var(--ink)]">
                            {item.albumName}
                            {item.songName?.trim() ? ` - ${item.songName.trim()}` : ""}
                          </p>
                          {(item.artistName || item.releaseYear?.trim()) && (
                            <p className="truncate text-xs text-[var(--ink-muted)]">
                              {item.artistName
                                ? `${item.artistName}${item.releaseYear?.trim() ? ` / ${item.releaseYear.trim()}` : ""}`
                                : item.releaseYear?.trim() ?? ""}
                            </p>
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
    </>
  );
}

function LyricsWallLoading() {
  return (
    <div className="lyrics-gallery">
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
      </div>
    </div>
  );
}

export default function LyricsWallPage() {
  return (
    <Suspense fallback={<LyricsWallLoading />}>
      <LyricsWallContent />
    </Suspense>
  );
}
