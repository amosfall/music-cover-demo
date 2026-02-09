"use client";

import { useState, useEffect, useMemo, memo, useCallback } from "react";
import Image from "next/image";
import { getProxyImageUrl } from "@/lib/proxy-image";

const isExternalUrl = (url: string) => /^https?:\/\//.test(url);
const isDataUrl = (url: string) => /^data:/.test(url);
/** 识别占位图 URL：不发起请求，直接用内联 SVG 渲染，避免外网/墙导致不显示。music.126.net 为真实封面，不走此分支 */
const isPlaceholderUrl = (url: string) =>
  !url ||
  url.startsWith("data:image/svg") ||
  url.includes("placehold.co") ||
  url.includes("placehold.it");

/** 内联占位图：灰底 + ♪，完全不依赖外网 */
const PlaceholderCover = memo(function PlaceholderCover() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#e5e5e5] text-[var(--ink-muted)]" aria-hidden>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" className="opacity-60">
        <text x="12" y="16" textAnchor="middle" fontSize="18" fontFamily="sans-serif">♪</text>
      </svg>
    </div>
  );
});

/** 封面加载失败时的占位：灰色底 + 专辑名首字或 🎵 */
const CoverFallback = memo(function CoverFallback({ name }: { name: string }) {
  const char = name?.trim()[0] || "♪";
  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--paper-dark)] text-4xl font-medium text-[var(--ink-muted)]">
      {char}
    </div>
  );
});

const CoverImage = memo(function CoverImage({ src, alt }: { src: string; alt: string }) {
  const [err, setErr] = useState(false);
  if (!src || isPlaceholderUrl(src)) {
    return <PlaceholderCover />;
  }
  if (err) {
    return <CoverFallback name={alt} />;
  }
  const displaySrc = getProxyImageUrl(src);
  const isProxy = displaySrc.startsWith("/api/proxy-image");
  const useImg = isProxy || isExternalUrl(displaySrc) || isDataUrl(displaySrc);
  if (useImg) {
    return (
      <img
        src={displaySrc}
        alt={alt}
        className="h-full w-full object-cover"
        loading="lazy"
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <Image
      src={displaySrc}
      alt={alt}
      fill
      className="object-cover"
      sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 180px"
      unoptimized
      referrerPolicy="no-referrer"
      onError={() => setErr(true)}
    />
  );
});

type AlbumCover = {
  id: string;
  imageUrl: string;
  albumName: string;
  artistName: string | null;
  releaseYear: string | null;
  genre: string | null;
  /** 导入时代表的曲目（歌单/专辑链接对应的那首歌） */
  songName: string | null;
  songId: string | null;
};

function getItemStyle(index: number) {
  return { zIndex: index };
}

type AlbumGridProps = {
  categoryId?: string | null;
};

export default function AlbumGrid({ categoryId }: AlbumGridProps) {
  const [items, setItems] = useState<AlbumCover[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumCover | null>(null);

  useEffect(() => {
    const base = categoryId ? `/api/albums?categoryId=${encodeURIComponent(categoryId)}` : "/api/albums";
    const url = `${base}${base.includes("?") ? "&" : "?"}_=${Date.now()}`;
    fetch(url, { cache: "no-store", headers: { "Cache-Control": "no-cache", Pragma: "no-cache" } })
      .then((res) => res.json())
      .then((data) => {
        setItems(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [categoryId]);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("确定删除这张专辑？")) return;
    const res = await fetch(`/api/albums/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const handleSelectAlbum = useCallback((item: AlbumCover) => {
    setSelectedAlbum(item);
  }, []);

  const list = Array.isArray(items) ? items : [];
  const listDeduped = useMemo(() => {
    const seen = new Set<string>();
    return list.filter((item) => {
      if (seen.has(item.albumName)) return false;
      seen.add(item.albumName);
      return true;
    });
  }, [items]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }
  if (listDeduped.length === 0) {
    return null;
  }

  return (
    <>
      <div className="album-wall">
        {listDeduped.map((item, index) => (
          <div
            key={item.id}
            className="album-cover-wrapper group cursor-pointer"
            style={getItemStyle(index)}
            onClick={() => handleSelectAlbum(item)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && handleSelectAlbum(item)}
          >
            <div className="album-cover-inner relative">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-[var(--paper-dark)] shadow-lg transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl">
                <CoverImage src={item.imageUrl} alt={item.albumName} />
              </div>
              <button
                onClick={(e) => handleDelete(item.id, e)}
                className="absolute top-1 right-1 z-10 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white opacity-0 shadow backdrop-blur-sm transition-opacity hover:bg-red-600 group-hover:opacity-100"
              >
                删除
              </button>
              <div className="mt-2 text-center">
                <p className="truncate text-sm font-medium text-[var(--ink)]">
                  {item.albumName}
                </p>
                {(item.artistName || item.releaseYear) && (
                  <p className="truncate text-xs text-[var(--ink-muted)]">
                    {[item.artistName, item.releaseYear].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 专辑详情：当时导入的是哪一首歌 */}
      {selectedAlbum && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
          onClick={() => setSelectedAlbum(null)}
        >
          <div
            className="relative max-h-[85dvh] w-full max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl bg-white shadow-xl sm:max-h-[90vh] sm:max-w-sm sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-square w-full overflow-hidden rounded-t-2xl bg-[var(--paper-dark)]">
              <CoverImage src={selectedAlbum.imageUrl} alt={selectedAlbum.albumName} />
            </div>
            <div className="p-4">
              <p className="text-lg font-medium text-[var(--ink)]">
                {selectedAlbum.albumName}
              </p>
              {(selectedAlbum.artistName || selectedAlbum.releaseYear?.trim()) && (
                <p className="mt-0.5 text-sm text-[var(--ink-muted)]">
                  {[selectedAlbum.artistName, selectedAlbum.releaseYear?.trim()]
                    .filter(Boolean)
                    .join(" / ")}
                </p>
              )}
              {selectedAlbum.songName?.trim() && (
                <p className="mt-2 text-sm text-[var(--ink)]">
                  {selectedAlbum.songName}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedAlbum(null)}
              className="absolute top-2 right-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-black/50 p-1.5 text-white backdrop-blur-sm hover:bg-black/70"
              aria-label="关闭"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
