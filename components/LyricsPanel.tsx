"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@clerk/nextjs";
import FloatingLyrics from "@/components/FloatingLyrics";
import AlbumStrip from "@/components/AlbumStrip";
import AddLyricsModal from "@/components/AddLyricsModal";
import { getProxyImageUrl } from "@/lib/proxy-image";
import type { LyricsCardData } from "@/components/LyricsWall";

type Props = {
  /** 头部左侧内容：TabNav 或关闭按钮等 */
  headerLeft?: React.ReactNode;
};

export default function LyricsPanel({ headerLeft }: Props) {
  const { isSignedIn } = useAuth();
  const router = useRouter();
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
  const mainRef = useRef<HTMLDivElement>(null);

  const handleSelect = (item: { id: string }) => {
    const idx = items.findIndex((i) => i.id === item.id);
    if (idx >= 0) setActiveIndex(idx);
  };

  const handleDelete = async () => {
    if (!activeItem) return;
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }
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

  if (loading) {
    return (
      <div className="lyrics-gallery">
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="lyrics-gallery">
        <header className="flex items-center justify-between px-4 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-10 sm:pt-8">
          {headerLeft}
          <button
            onClick={() => {
              if (!isSignedIn) {
                router.push("/sign-in");
                return;
              }
              setShowAdd(true);
            }}
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

  return (
    <div className="lyrics-gallery">
      <header className="flex items-center justify-between px-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-10 sm:pt-7">
        {headerLeft}
        <div className="flex items-center gap-2">
          {activeItem && (
            <>
              <button
                onClick={() => {
                  if (!isSignedIn) {
                    router.push("/sign-in");
                    return;
                  }
                  setEditingItem(activeItem);
                }}
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
            onClick={() => {
              if (!isSignedIn) {
                router.push("/sign-in");
                return;
              }
              setShowAdd(true);
            }}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-black p-0 transition-colors hover:bg-black/80"
            aria-label="添加"
          >
            <svg className="h-5 w-5 shrink-0 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </header>

      <main className="flex min-h-[50vh] flex-1 items-center justify-center px-4 pb-[max(5.5rem,env(safe-area-inset-bottom)+4rem)] md:min-h-[55vh] md:px-6 md:pb-24">
        <div
          ref={mainRef}
          className="relative flex w-full max-w-4xl flex-col items-center justify-center gap-8 md:flex-row md:items-center md:gap-[4.5rem]"
        >
          {activeItem && (
            <div className="flex flex-1 items-center justify-center md:max-w-[48%]">
              <FloatingLyrics
                lyrics={activeItem.lyrics}
                artistName={activeItem.artistName}
                albumName={activeItem.albumName}
                songName={activeItem.songName}
                itemKey={activeItem.id}
              />
            </div>
          )}
          {activeItem && (
            <motion.div
              drag
              dragConstraints={mainRef}
              dragElastic={0}
              dragMomentum={false}
              className="flex shrink-0 cursor-grab active:cursor-grabbing items-center justify-center touch-none w-[min(45vw,180px)] md:w-[min(24vw,200px)]"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[var(--paper-dark)] shadow-lg select-none pointer-events-none">
                <img
                  src={getProxyImageUrl(activeItem.imageUrl)}
                  alt={activeItem.albumName}
                  className="absolute inset-0 h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                  draggable={false}
                />
              </div>
            </motion.div>
          )}
        </div>
      </main>

      <AlbumStrip
        items={items}
        activeId={activeItem?.id ?? null}
        onSelect={handleSelect}
      />

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
