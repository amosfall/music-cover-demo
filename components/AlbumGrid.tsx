"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

type AlbumCover = {
  id: string;
  imageUrl: string;
  albumName: string;
  artistName: string | null;
  releaseYear: string | null;
  genre: string | null;
};

// 自动摆放：随机偏移与旋转，营造唱片墙效果
function getRandomStyle(index: number) {
  const rotations = [-3, -2, -1, 0, 1, 2, 3];
  const rotation = rotations[index % rotations.length];
  const yOffset = (index % 3 - 1) * 4;
  const xOffset = (index % 5 - 2) * 3;
  return {
    transform: `rotate(${rotation}deg) translate(${xOffset}px, ${yOffset}px)`,
    zIndex: index,
  };
}

export default function AlbumGrid() {
  const [items, setItems] = useState<AlbumCover[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/albums")
      .then((res) => res.json())
      .then((data) => {
        setItems(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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
  if (list.length === 0) {
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
      {list.map((item, index) => (
        <div
          key={item.id}
          className="album-cover-wrapper group"
          style={getRandomStyle(index)}
        >
          <div className="album-cover-inner">
            <div className="relative aspect-square overflow-hidden rounded-lg bg-[var(--paper-dark)] shadow-lg transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl group-hover:z-50">
              <Image
                src={item.imageUrl}
                alt={item.albumName}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 180px"
              />
            </div>
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
            <button
              onClick={(e) => handleDelete(item.id, e)}
              className="absolute -top-1 -right-1 rounded-full bg-red-500 px-2 py-0.5 text-xs text-white opacity-0 shadow transition-opacity hover:bg-red-600 group-hover:opacity-100"
            >
              删除
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
