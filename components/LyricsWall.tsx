"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

type LyricsCard = {
  id: string;
  lyrics: string;
  albumName: string;
  artistName: string | null;
  imageUrl: string;
};

export default function LyricsWall() {
  const [items, setItems] = useState<LyricsCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/lyrics")
      .then((res) => res.json())
      .then((data) => {
        setItems(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("确定删除这条歌词？")) return;
    const res = await fetch(`/api/lyrics/${id}`, { method: "DELETE" });
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
        <span className="mb-4 text-6xl opacity-50">&#x270D;</span>
        <p className="text-lg font-medium text-[var(--ink)]">还没有歌词</p>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          添加一句歌词，搭配专辑封面
        </p>
      </div>
    );
  }

  return (
    <div className="lyrics-wall">
      {list.map((item) => (
        <div key={item.id} className="lyrics-card group">
          {/* 封面缩略图 */}
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-[var(--paper-dark)] shadow-sm">
            <Image
              src={item.imageUrl}
              alt={item.albumName}
              fill
              className="object-cover"
              sizes="80px"
            />
          </div>

          {/* 歌词 + 信息 */}
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <p className="lyrics-text">{item.lyrics}</p>
            <p className="mt-2 truncate text-xs text-[var(--ink-muted)]">
              {[item.artistName, item.albumName].filter(Boolean).join(" · ")}
            </p>
          </div>

          {/* 删除按钮 */}
          <button
            onClick={(e) => handleDelete(item.id, e)}
            className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500 px-2 py-0.5 text-xs text-white opacity-0 shadow transition-opacity hover:bg-red-600 group-hover:opacity-100"
          >
            删除
          </button>
        </div>
      ))}
    </div>
  );
}
