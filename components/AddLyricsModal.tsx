"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { getProxyImageUrl } from "@/lib/proxy-image";
import type { LyricsCardData } from "./LyricsWall";

type Album = {
  id: string;
  imageUrl: string;
  albumName: string;
  artistName: string | null;
};

type SearchResult = {
  id: number;
  name: string;
  artistName: string;
  albumName: string;
  albumId: number;
  picUrl: string;
  matchedLyrics: string | null;
  matchScore: number;
};

type Props = {
  onClose: () => void;
  onSuccess: () => void;
  editItem?: LyricsCardData;
};

export default function AddLyricsModal({ onClose, onSuccess, editItem }: Props) {
  const isEdit = !!editItem;

  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [mode, setMode] = useState<"search" | "select" | "manual">(
    editItem ? "manual" : "search"
  );
  const [lyrics, setLyrics] = useState(editItem?.lyrics ?? "");
  const [albumName, setAlbumName] = useState(editItem?.albumName ?? "");
  const [artistName, setArtistName] = useState(editItem?.artistName ?? "");
  const [imageUrl, setImageUrl] = useState(editItem?.imageUrl ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 搜索相关
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedSong, setSelectedSong] = useState<SearchResult | null>(null);
  const lyricsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/albums")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setAlbums(data);
      })
      .catch(() => {});
  }, []);

  // 歌曲搜索（searchBy: "lyrics" 按歌词搜索, "song" 按歌曲名搜索）
  const doSearch = useCallback(async (query: string, searchBy: "lyrics" | "song" = "lyrics") => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `/api/search-songs?keywords=${encodeURIComponent(trimmed)}&type=${searchBy}`
      );
      const data = await res.json();
      if (Array.isArray(data.results)) {
        setSearchResults(data.results);
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // 歌词输入变化 -> 自动用歌词内容搜索（防抖）
  const handleLyricsChange = (value: string) => {
    setLyrics(value);
    if (mode === "search" && !searchQuery.trim()) {
      // 仅在歌曲名搜索框为空时，才自动用歌词搜索
      if (lyricsTimerRef.current) clearTimeout(lyricsTimerRef.current);
      lyricsTimerRef.current = setTimeout(() => {
        const firstLine = value.split(/\n/).find((l) => l.trim());
        if (firstLine) doSearch(firstLine, "lyrics");
      }, 600);
    }
  };

  // 歌曲名搜索框变化 -> 用歌曲名搜索（防抖，优先级更高）
  const handleSearchQueryChange = (value: string) => {
    setSearchQuery(value);
    if (queryTimerRef.current) clearTimeout(queryTimerRef.current);
    queryTimerRef.current = setTimeout(() => {
      if (value.trim()) {
        doSearch(value, "song");
      } else {
        // 歌曲名清空时，回退到用歌词搜索
        const firstLine = lyrics.split(/\n/).find((l) => l.trim());
        if (firstLine) doSearch(firstLine, "lyrics");
        else setSearchResults([]);
      }
    }, 500);
  };

  const handleSearchNow = () => {
    if (searchQuery.trim()) {
      doSearch(searchQuery, "song");
    } else {
      const firstLine = lyrics.split(/\n/).find((l) => l.trim()) || "";
      if (firstLine) doSearch(firstLine, "lyrics");
    }
  };

  const handleSelectSong = (song: SearchResult) => {
    setSelectedSong(song);
    setAlbumName(song.albumName);
    setArtistName(song.artistName);
    setImageUrl(song.picUrl);
    setError(null);
  };

  const handleSelectAlbum = (album: Album) => {
    setSelectedAlbum(album);
    setAlbumName(album.albumName);
    setArtistName(album.artistName || "");
    setImageUrl(album.imageUrl);
    setError(null);
  };

  const handleSubmit = async () => {
    const finalLyrics = lyrics.trim();
    let finalAlbumName: string | undefined;
    let finalImageUrl: string | undefined;
    let finalArtistName: string | null;

    if (mode === "search") {
      finalAlbumName = selectedSong?.albumName;
      finalImageUrl = selectedSong?.picUrl;
      finalArtistName = selectedSong?.artistName || null;
    } else if (mode === "select") {
      finalAlbumName = selectedAlbum?.albumName;
      finalImageUrl = selectedAlbum?.imageUrl;
      finalArtistName = selectedAlbum?.artistName || null;
    } else {
      finalAlbumName = albumName.trim();
      finalImageUrl = imageUrl.trim();
      finalArtistName = artistName.trim() || null;
    }

    if (!finalLyrics) {
      setError("请输入歌词");
      return;
    }
    if (!finalAlbumName) {
      setError(mode === "search" ? "请从搜索结果中选择一首歌曲" : "请选择或输入专辑名");
      return;
    }
    if (!finalImageUrl) {
      setError("请提供封面图片");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const url = isEdit ? `/api/lyrics/${editItem.id}` : "/api/lyrics";
      const method = isEdit ? "PUT" : "POST";
      console.log("[AddLyrics] 提交数据:", { lyrics: finalLyrics, albumName: finalAlbumName, artistName: finalArtistName, imageUrl: finalImageUrl?.slice(0, 60) });
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lyrics: finalLyrics,
          albumName: finalAlbumName,
          artistName: finalArtistName,
          imageUrl: finalImageUrl,
        }),
      });
      const text = await res.text();
      console.log("[AddLyrics] 响应:", res.status, text.slice(0, 200));
      let data;
      try { data = JSON.parse(text); } catch { throw new Error(`服务器返回异常: ${res.status} - ${text.slice(0, 100)}`); }
      if (!res.ok) throw new Error(data.error || `保存失败 (${res.status})`);
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[AddLyrics] 保存错误:", msg);
      setError(msg || "保存失败（未知错误）");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="scrapbook-card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[var(--ink)]">
            {isEdit ? "编辑歌词" : "添加歌词"}
          </h2>
          <button
            onClick={onClose}
            className="text-2xl leading-none text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* 歌词输入 */}
        <div className="mb-5">
          <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">
            歌词 <span className="text-red-500">*</span>
          </label>
          <p className="mb-1.5 text-xs text-[var(--ink-muted)]">
            {mode === "search"
              ? "输入歌词后自动搜索匹配歌曲，搜索不准时可用下方歌曲名搜索"
              : "每行一句歌词"}
          </p>
          <div className="relative">
            <span className="absolute left-3 top-3 text-lg text-[var(--accent-light)] opacity-60">
              &ldquo;
            </span>
            <textarea
              value={lyrics}
              onChange={(e) => handleLyricsChange(e.target.value)}
              placeholder={"输入歌词，每行一句...\n例如：\n我曾经跨过山和大海\n也穿过人山人海"}
              rows={4}
              className="w-full rounded-lg border border-[var(--paper-dark)] bg-white px-4 py-3 pl-8 pr-8 text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)] focus:outline-none"
              style={{
                fontFamily: "Georgia, 'Noto Serif SC', serif",
                fontSize: "1.05rem",
                lineHeight: "1.7",
              }}
            />
            <span className="absolute right-3 bottom-3 text-lg text-[var(--accent-light)] opacity-60">
              &rdquo;
            </span>
          </div>
        </div>

        {/* 模式切换 */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setMode("search")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === "search"
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--paper-dark)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            搜索歌曲
          </button>
          <button
            onClick={() => setMode("select")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === "select"
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--paper-dark)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            已有专辑
          </button>
          <button
            onClick={() => {
              setMode("manual");
              setSelectedAlbum(null);
              setSelectedSong(null);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === "manual"
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--paper-dark)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            手动输入
          </button>
        </div>

        {/* 搜索歌曲 */}
        {mode === "search" && (
          <div className="mb-5">
            {/* 可选：用歌曲名搜索（当歌词匹配不准时使用） */}
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-[var(--ink-muted)]">
                搜索不准？试试输入歌曲名或歌手名
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchQueryChange(e.target.value)}
                  placeholder="歌曲名 / 歌手名（可选）"
                  className="flex-1 rounded-lg border border-[var(--paper-dark)] bg-white px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)] focus:outline-none"
                />
                <button
                  onClick={handleSearchNow}
                  disabled={searching}
                  className="shrink-0 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  {searching ? "..." : "搜索"}
                </button>
              </div>
            </div>
            {searching && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-[var(--ink-muted)]">
                <span className="inline-block animate-pulse">正在匹配歌词</span>
                <span className="inline-flex gap-0.5">
                  <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
                </span>
              </div>
            )}
            {!searching && searchResults.length === 0 && (lyrics.trim() || searchQuery.trim()) && (
              <p className="py-4 text-center text-sm text-[var(--ink-muted)]">
                输入歌词后将自动搜索匹配歌曲
              </p>
            )}
            {!searching && searchResults.length > 0 && (
              <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-[var(--paper-dark)] p-2">
                {searchResults.map((song) => (
                  <button
                    key={song.id}
                    onClick={() => handleSelectSong(song)}
                    className={`flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors ${
                      selectedSong?.id === song.id
                        ? "bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]"
                        : "hover:bg-[var(--paper-dark)]/50"
                    }`}
                  >
                    {song.picUrl && (
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-[var(--paper-dark)]">
                        <Image
                          src={song.picUrl}
                          alt={song.albumName}
                          fill
                          className="object-cover"
                          sizes="48px"
                          unoptimized
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--ink)]">
                        {song.name}
                      </p>
                      <p className="truncate text-xs text-[var(--ink-muted)]">
                        {song.artistName} · {song.albumName}
                      </p>
                      {song.matchedLyrics && (
                        <p
                          className="mt-0.5 truncate text-xs"
                          style={{
                            fontFamily: "Georgia, 'Noto Serif SC', serif",
                            color: song.matchScore >= 80 ? "var(--accent)" : "var(--ink-muted)",
                            fontStyle: "italic",
                          }}
                        >
                          {song.matchScore >= 80 ? "✦" : "♪"} &ldquo;...{song.matchedLyrics}...&rdquo;
                        </p>
                      )}
                      {!song.matchedLyrics && (
                        <p className="mt-0.5 text-xs text-[var(--ink-muted)] opacity-50">
                          未匹配到歌词片段
                        </p>
                      )}
                    </div>
                    {song.matchScore >= 80 && (
                      <span className="shrink-0 rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
                        高匹配
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 从已有专辑选择 */}
        {mode === "select" && (
          <div className="mb-5">
            {albums.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--ink-muted)]">
                还没有专辑，请先在封面墙添加专辑
              </p>
            ) : (
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-[var(--paper-dark)] p-2">
                {albums.map((album) => (
                  <button
                    key={album.id}
                    onClick={() => handleSelectAlbum(album)}
                    className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors ${
                      selectedAlbum?.id === album.id
                        ? "bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]"
                        : "hover:bg-[var(--paper-dark)]/50"
                    }`}
                  >
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-[var(--paper-dark)]">
                      <Image
                        src={getProxyImageUrl(album.imageUrl)}
                        alt={album.albumName}
                        fill
                        className="object-cover"
                        sizes="40px"
                        unoptimized
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--ink)]">
                        {album.albumName}
                      </p>
                      {album.artistName && (
                        <p className="truncate text-xs text-[var(--ink-muted)]">
                          {album.artistName}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 手动输入 */}
        {mode === "manual" && (
          <div className="mb-5 space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--ink)]">
                专辑名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={albumName}
                onChange={(e) => setAlbumName(e.target.value)}
                placeholder="如：Midnights"
                className="w-full rounded-lg border border-[var(--paper-dark)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--ink)]">
                歌手（可选）
              </label>
              <input
                type="text"
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder="如：Taylor Swift"
                className="w-full rounded-lg border border-[var(--paper-dark)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--ink)]">
                封面图片链接 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-[var(--paper-dark)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
              />
            </div>
          </div>
        )}

        {/* 已选歌曲预览（搜索模式） */}
        {mode === "search" && selectedSong && (
          <div className="mb-4 flex items-center gap-3 rounded-lg bg-[var(--accent)]/5 p-3">
            {selectedSong.picUrl && (
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-[var(--paper-dark)]">
                <Image
                  src={selectedSong.picUrl}
                  alt={selectedSong.albumName}
                  fill
                  className="object-cover"
                  sizes="40px"
                  unoptimized
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--ink)]">
                已选：{selectedSong.name}
              </p>
              <p className="truncate text-xs text-[var(--ink-muted)]">
                {selectedSong.artistName} · {selectedSong.albumName}
              </p>
            </div>
          </div>
        )}

        {/* 提交按钮 */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full rounded-xl bg-[var(--accent)] py-3 font-medium text-white transition-opacity hover:bg-[var(--accent-light)] disabled:opacity-50"
        >
          {loading ? "保存中..." : isEdit ? "更新歌词" : "保存歌词"}
        </button>
      </div>
    </div>
  );
}
