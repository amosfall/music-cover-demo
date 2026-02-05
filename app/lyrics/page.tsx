"use client";

import { useState } from "react";
import LyricsWall from "@/components/LyricsWall";
import AddLyricsModal from "@/components/AddLyricsModal";
import TabNav from "@/components/TabNav";

export default function LyricsPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSuccess = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-6 pb-24 sm:px-6 sm:py-8">
      {/* Header */}
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-[var(--ink)] sm:text-5xl">
          🎵 音乐收藏
        </h1>
        <p className="mt-3 text-[var(--ink-muted)]">
          记录打动你的旋律与词句
        </p>
        <div className="mt-5 flex justify-center">
          <TabNav />
        </div>
      </header>

      {/* 歌词列表 */}
      <section>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-medium text-[var(--ink-muted)]">
            我的歌词
          </h2>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-light)]"
          >
            <span className="text-lg">+</span> 添加歌词
          </button>
        </div>
        <LyricsWall key={refreshKey} />
      </section>

      {/* FAB for mobile */}
      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-2xl text-white shadow-lg transition-transform hover:scale-105 sm:hidden"
        aria-label="添加歌词"
      >
        +
      </button>

      {showAdd && (
        <AddLyricsModal
          onClose={() => setShowAdd(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
