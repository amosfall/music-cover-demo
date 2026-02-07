"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import FloatingLyrics from "@/components/FloatingLyrics";
import AlbumStrip from "@/components/AlbumStrip";
import AddLyricsModal from "@/components/AddLyricsModal";
import TabNav from "@/components/TabNav";
import { getProxyImageUrl } from "@/lib/proxy-image";
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
        <header className="flex items-center justify-between px-4 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-10 sm:pt-8">
          <TabNav />
          <button
            onClick={() => setShowAdd(true)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-black p-0 transition-colors hover:bg-black/80"
            aria-label="添加"
          >
            <svg className="h-5 w-5 shrink-0 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center overflow-hidden text-center">
          <motion.p
            className="font-song font-normal text-black text-2xl tracking-[0.4em]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 2, ease: "easeOut" }}
          >
            「與　你　握　手」
          </motion.p>
          <p className="mt-6 text-sm text-[var(--ink-muted)]" style={{ fontFamily: "Times New Roman, serif" }}>
            By Aki，2026 春
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
      <header className="flex items-center justify-between px-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-10 sm:pt-7">
        <TabNav />
        <div className="flex items-center gap-2">
          {activeItem && (
            <>
              <button
                onClick={() => setEditingItem(activeItem)}
                className="min-h-[44px] rounded-full px-4 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                编辑
              </button>
              <button
                onClick={handleDelete}
                className="min-h-[44px] rounded-full px-4 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
              >
                删除
              </button>
            </>
          )}
          <button
            onClick={() => setShowAdd(true)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-black p-0 transition-colors hover:bg-black/80"
            aria-label="添加"
          >
            <svg className="h-5 w-5 shrink-0 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </header>

      {/* 左侧歌词 + 右侧专辑封面，整体居中 */}
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-[max(7rem,env(safe-area-inset-bottom)+5rem)] md:flex-row md:gap-12 md:px-8 md:pb-28">
        <div className="flex min-h-0 items-center justify-center md:max-w-[50%]">
          {activeItem && (
            <FloatingLyrics
              lyrics={activeItem.lyrics}
              artistName={activeItem.artistName}
              albumName={activeItem.albumName}
              itemKey={activeItem.id}
            />
          )}
        </div>
        {activeItem && (
          <div className="flex shrink-0 items-center justify-center md:w-[min(32vw,280px)]">
            <div className="relative aspect-square w-full max-w-[200px] overflow-hidden rounded-2xl bg-[var(--paper-dark)] shadow-lg md:max-w-none">
              <img
                src={getProxyImageUrl(activeItem.imageUrl)}
                alt={activeItem.albumName}
                className="absolute inset-0 h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
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
