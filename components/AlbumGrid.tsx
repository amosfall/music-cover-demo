"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

const isExternalCover = (url: string) =>
  /^https?:\/\//.test(url) && (url.includes("music.126.net") || url.includes("blob.vercel-storage.com"));

function CoverImage({ src, alt }: { src: string; alt: string }) {
  const [err, setErr] = useState(false);
  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center text-4xl text-[var(--ink-muted)]">
        🎵
      </div>
    );
  }
  if (err) {
    return (
      <div className="flex h-full w-full items-center justify-center text-4xl text-[var(--ink-muted)]">
        🎵
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      className="object-cover"
      sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 180px"
      unoptimized={isExternalCover(src)}
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
    <div className="album-wall">
      {listDeduped.map((item, index) => (
        <div
          key={item.id}
          className="album-cover-wrapper group"
          style={getItemStyle(index)}
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
  );
}
