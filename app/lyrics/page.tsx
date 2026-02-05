"use client";

import { useState, useEffect, useCallback } from "react";
import FloatingLyrics from "@/components/FloatingLyrics";
import AlbumStrip from "@/components/AlbumStrip";
import AddLyricsModal from "@/components/AddLyricsModal";
import TabNav from "@/components/TabNav";
import type { LyricsCardData } from "@/components/LyricsWall";

export default function LyricsPage() {
  const [items, setItems] = useState<LyricsCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [editingItem, setEditingItem] = useState<LyricsCardData | null>(null);

  const fetchItems = useCallback(() => {
    fetch("/api/lyrics")
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setItems(list);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const activeItem = items[activeIndex] ?? null;

  const handleSelect = (item: { id: string }) => {
    const idx = items.findIndex((i) => i.id === item.id);
    if (idx >= 0) setActiveIndex(idx);
  };

  const handleDelete = async () => {
    if (!activeItem) return;
    if (!confirm("确定删除这条歌词？")) return;
    const res = await fetch(`/api/lyrics/${activeItem.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      const next = items.filter((i) => i.id !== activeItem.id);
      setItems(next);
      if (activeIndex >= next.length) setActiveIndex(Math.max(0, next.length - 1));
    }
  };

  const handleAddSuccess = () => {
    fetchItems();
  };

  const handleEditSuccess = () => {
    fetchItems();
    setEditingItem(null);
  };

  // ─── 加载态 ───
  if (loading) {
    return (
      <div className="lyrics-gallery">
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
        </div>
      </div>
    );
  }

  // ─── 空态 ───
  if (items.length === 0) {
    return (
      <div className="lyrics-gallery">
        {/* 顶部导航 */}
        <header className="flex items-center justify-between px-6 pt-6 sm:px-10 sm:pt-8">
          <TabNav />
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-full bg-gray-800 px-5 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-gray-700"
          >
            + 添加
          </button>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-5xl opacity-20">&#x270D;</p>
          <p className="text-lg font-light text-gray-400">还没有歌词</p>
          <p className="text-sm text-gray-400/60">
            添加一句歌词，开始你的音乐画廊
          </p>
        </div>

        {showAdd && (
          <AddLyricsModal
            onClose={() => setShowAdd(false)}
            onSuccess={handleAddSuccess}
          />
        )}
      </div>
    );
  }

  // ─── 正常态：画廊视图 ───
  return (
    <div className="lyrics-gallery">
      {/* 顶部栏 */}
      <header className="flex items-center justify-between px-6 pt-5 sm:px-10 sm:pt-7">
        <TabNav />
        <div className="flex items-center gap-2">
          {activeItem && (
            <>
              <button
                onClick={() => setEditingItem(activeItem)}
                className="rounded-full px-4 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                编辑
              </button>
              <button
                onClick={handleDelete}
                className="rounded-full px-4 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
              >
                删除
              </button>
            </>
          )}
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-full bg-gray-800 px-5 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-gray-700"
          >
            + 添加
          </button>
        </div>
      </header>

      {/* 中央漂浮歌词 */}
      <main className="flex flex-1 items-center justify-center pb-28">
        {activeItem && (
          <FloatingLyrics
            lyrics={activeItem.lyrics}
            artistName={activeItem.artistName}
            albumName={activeItem.albumName}
            itemKey={activeItem.id}
          />
        )}
      </main>

      {/* 底部专辑封面栏 */}
      <AlbumStrip
        items={items}
        activeId={activeItem?.id ?? null}
        onSelect={handleSelect}
      />

      {/* 弹窗 */}
      {showAdd && (
        <AddLyricsModal
          onClose={() => setShowAdd(false)}
          onSuccess={handleAddSuccess}
        />
      )}
      {editingItem && (
        <AddLyricsModal
          onClose={() => setEditingItem(null)}
          onSuccess={handleEditSuccess}
          editItem={editingItem}
        />
      )}
    </div>
  );
}
