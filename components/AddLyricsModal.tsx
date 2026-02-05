"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

type Album = {
  id: string;
  imageUrl: string;
  albumName: string;
  artistName: string | null;
};

type Props = {
  onClose: () => void;
  onSuccess: () => void;
};

export default function AddLyricsModal({ onClose, onSuccess }: Props) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [mode, setMode] = useState<"select" | "manual">("select");
  const [lyrics, setLyrics] = useState("");
  const [albumName, setAlbumName] = useState("");
  const [artistName, setArtistName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/albums")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setAlbums(data);
      })
      .catch(() => {});
  }, []);

  const handleSelectAlbum = (album: Album) => {
    setSelectedAlbum(album);
    setAlbumName(album.albumName);
    setArtistName(album.artistName || "");
    setImageUrl(album.imageUrl);
    setError(null);
  };

  const handleSubmit = async () => {
    const finalLyrics = lyrics.trim();
    const finalAlbumName = mode === "select" ? selectedAlbum?.albumName : albumName.trim();
    const finalImageUrl = mode === "select" ? selectedAlbum?.imageUrl : imageUrl.trim();
    const finalArtistName =
      mode === "select"
        ? selectedAlbum?.artistName || null
        : artistName.trim() || null;

    if (!finalLyrics) {
      setError("请输入歌词");
      return;
    }
    if (!finalAlbumName) {
      setError("请选择或输入专辑名");
      return;
    }
    if (!finalImageUrl) {
      setError("请提供封面图片链接");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lyrics: finalLyrics,
          albumName: finalAlbumName,
          artistName: finalArtistName,
          imageUrl: finalImageUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
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
            添加歌词
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
          <div className="relative">
            <span className="absolute left-3 top-3 text-lg text-[var(--accent-light)] opacity-60">
              &ldquo;
            </span>
            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="输入一句打动你的歌词..."
              rows={3}
              className="w-full rounded-lg border border-[var(--paper-dark)] bg-white px-4 py-3 pl-8 pr-8 text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)] focus:outline-none"
              style={{
                fontFamily: "Georgia, 'Noto Serif SC', serif",
                fontStyle: "italic",
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
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setMode("select")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === "select"
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--paper-dark)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            从已有专辑选择
          </button>
          <button
            onClick={() => {
              setMode("manual");
              setSelectedAlbum(null);
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
                        src={album.imageUrl}
                        alt={album.albumName}
                        fill
                        className="object-cover"
                        sizes="40px"
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

        {/* 预览 */}
        {(selectedAlbum || (mode === "manual" && imageUrl && albumName)) && lyrics.trim() && (
          <div className="mb-5">
            <p className="mb-2 text-xs font-medium text-[var(--ink-muted)]">预览</p>
            <div className="lyrics-card">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[var(--paper-dark)] shadow-sm">
                <Image
                  src={mode === "select" ? selectedAlbum!.imageUrl : imageUrl}
                  alt="preview"
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <p className="lyrics-text text-sm">{lyrics}</p>
                <p className="mt-1.5 truncate text-xs text-[var(--ink-muted)]">
                  {[
                    mode === "select" ? selectedAlbum?.artistName : artistName,
                    mode === "select" ? selectedAlbum?.albumName : albumName,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 提交按钮 */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full rounded-xl bg-[var(--accent)] py-3 font-medium text-white transition-opacity hover:bg-[var(--accent-light)] disabled:opacity-50"
        >
          {loading ? "保存中..." : "保存歌词"}
        </button>
      </div>
    </div>
  );
}
