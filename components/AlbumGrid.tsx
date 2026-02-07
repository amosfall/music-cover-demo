"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { getProxyImageUrl } from "@/lib/proxy-image";

const isExternalUrl = (url: string) => /^https?:\/\//.test(url);

/** 封面加载失败时的占位：灰色底 + 专辑名首字或 🎵 */
function CoverFallback({ name }: { name: string }) {
  const char = name?.trim()[0] || "♪";
  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--paper-dark)] text-4xl font-medium text-[var(--ink-muted)]">
      {char}
    </div>
  );
}

function CoverImage({ src, alt }: { src: string; alt: string }) {
  const [err, setErr] = useState(false);
  const displaySrc = getProxyImageUrl(src);
  const isProxy = displaySrc.startsWith("/api/proxy-image");
  if (!src) {
    return <CoverFallback name={alt} />;
  }
  if (err) {
    return <CoverFallback name={alt} />;
  }
  if (isProxy || isExternalUrl(displaySrc)) {
    return (
      <img
        src={displaySrc}
        alt={alt}
        className="h-full w-full object-cover"
        loading="lazy"
        referrerPolicy="no-referrer"
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
      onError={() => setErr(true)}
    />
  );
}

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

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("确定删除这张专辑？")) return;
    const res = await fetch(`/api/albums/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  const list = Array.isArray(items) ? items : [];
  // 按 albumName 去重，只保留每个专辑的第一条记录
  const seenNames = new Set<string>();
  const listDeduped = list.filter((item) => {
    if (seenNames.has(item.albumName)) return false;
    seenNames.add(item.albumName);
    return true;
  });
  if (listDeduped.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--accent-light)]/50 bg-white/30 p-12 text-center">
        <span className="mb-4 text-6xl opacity-50">🎵</span>
        <p className="text-lg font-medium text-[var(--ink)]">还没有专辑</p>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          上传你的第一张专辑封面开始收藏
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="album-wall">
        {listDeduped.map((item, index) => (
          <div
            key={item.id}
            className="album-cover-wrapper group cursor-pointer"
            style={getItemStyle(index)}
            onClick={() => setSelectedAlbum(item)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setSelectedAlbum(item)}
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedAlbum(null)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-square w-full overflow-hidden rounded-t-2xl bg-[var(--paper-dark)]">
              <CoverImage src={selectedAlbum.imageUrl} alt={selectedAlbum.albumName} />
            </div>
            <div className="p-4">
              <p className="text-lg font-medium text-[var(--ink)]">
                {selectedAlbum.albumName}
              </p>
              {selectedAlbum.artistName && (
                <p className="mt-0.5 text-sm text-[var(--ink-muted)]">
                  {selectedAlbum.artistName}
                </p>
              )}
              <div className="mt-3 border-t border-[var(--paper-dark)] pt-3">
                <p className="text-xs text-[var(--ink-muted)]">导入时代表曲目</p>
                <p className="mt-0.5 text-sm text-[var(--ink)]">
                  {selectedAlbum.songName?.trim()
                    ? selectedAlbum.songName
                    : "未记录（手动上传或早期导入）"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedAlbum(null)}
              className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-white backdrop-blur-sm hover:bg-black/70"
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
