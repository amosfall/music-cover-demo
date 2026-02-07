"use client";

import { useState, useEffect } from "react";
import { getProxyImageUrl } from "@/lib/proxy-image";
import CurvedLyrics from "./CurvedLyrics";
import AddLyricsModal from "./AddLyricsModal";

export type LyricsCardData = {
  id: string;
  lyrics: string;
  albumName: string;
  artistName: string | null;
  imageUrl: string;
};

export default function LyricsWall() {
  const [items, setItems] = useState<LyricsCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<LyricsCardData | null>(null);

  const fetchItems = () => {
    fetch("/api/lyrics")
      .then((res) => res.json())
      .then((data) => {
        setItems(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("确定删除这条歌词？")) return;
    const res = await fetch(`/api/lyrics/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleEditSuccess = () => {
    fetchItems();
    setEditingItem(null);
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
    <>
      <div className="lyrics-wall">
        {list.map((item) => (
          <div key={item.id} className="lyrics-card group">
            {/* 弧线歌词 - 视觉主体 */}
            <div className="px-1 py-2">
              <CurvedLyrics lyrics={item.lyrics} cardId={item.id} />
            </div>

            {/* 底部：封面 + 信息 + 操作按钮 */}
            <div className="flex items-center gap-3 border-t border-[var(--paper-dark)] pt-3">
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--paper-dark)] shadow-sm">
                <img
                  src={getProxyImageUrl(item.imageUrl)}
                  alt={item.albumName}
                  className="absolute inset-0 h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <p className="min-w-0 flex-1 truncate text-xs text-[var(--ink-muted)]">
                {[item.artistName, item.albumName].filter(Boolean).join(" · ")}
              </p>
              {/* 编辑 & 删除 */}
              <div className="flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => setEditingItem(item)}
                  className="rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-xs text-white shadow hover:bg-[var(--accent-light)]"
                >
                  编辑
                </button>
                <button
                  onClick={(e) => handleDelete(item.id, e)}
                  className="rounded-full bg-red-500 px-2.5 py-0.5 text-xs text-white shadow hover:bg-red-600"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 编辑弹窗 */}
      {editingItem && (
        <AddLyricsModal
          onClose={() => setEditingItem(null)}
          onSuccess={handleEditSuccess}
          editItem={editingItem}
        />
      )}
    </>
  );
}
