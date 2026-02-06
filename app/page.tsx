"use client";

import { useState } from "react";
import AlbumGrid from "@/components/AlbumGrid";
import AlbumUploadModal from "@/components/AlbumUploadModal";
import TabNav from "@/components/TabNav";

export default function Home() {
  const [showUpload, setShowUpload] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [linkInput, setLinkInput] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const handleUploadSuccess = () => {
    setRefreshKey((k) => k + 1);
  };

  const handleParseLink = async () => {
    const url = linkInput.trim();
    if (!url) {
      setLinkError("请粘贴网易云音乐链接");
      return;
    }
    setLinkLoading(true);
    setLinkError(null);
    try {
      const res = await fetch("/api/parse-netease", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "解析失败");
      setLinkInput("");
      handleUploadSuccess();
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "解析失败");
    } finally {
      setLinkLoading(false);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-6 pb-24 sm:px-6 sm:py-8">
      {/* Header */}
      <header className="mb-10 text-center">
        <h1 className="font-song text-4xl font-bold tracking-tight text-[var(--ink)] sm:text-5xl">
          音乐浮墙
        </h1>
        <p className="font-song mt-3 text-[var(--ink-muted)]">
          「找到自由，就找到歌声」
        </p>
        <div className="mt-5 flex justify-center">
          <TabNav />
        </div>
      </header>

      {/* 网易云链接快捷添加 */}
      <section className="mb-8">
        <div className="scrapbook-card rounded-2xl p-4 sm:p-5">
          <p className="mb-3 text-sm font-medium text-[var(--ink)]">
            粘贴网易云链接，一键添加
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <input
              type="text"
              value={linkInput}
              onChange={(e) => {
                setLinkInput(e.target.value);
                setLinkError(null);
              }}
              onPaste={(e) => {
                setLinkInput(e.clipboardData.getData("text"));
                setLinkError(null);
              }}
              placeholder="https://music.163.com/song?id=..."
              className="flex-1 rounded-lg border border-[var(--paper-dark)] bg-white px-4 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)]"
            />
            <button
              onClick={handleParseLink}
              disabled={linkLoading}
              className="shrink-0 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:bg-[var(--accent-light)] disabled:opacity-60"
            >
              {linkLoading ? "解析中..." : "添加"}
            </button>
          </div>
          {linkError && (
            <p className="mt-2 text-sm text-red-500">{linkError}</p>
          )}
          <p className="mt-2 text-xs text-[var(--ink-muted)]">
            支持歌曲链接
          </p>
        </div>
      </section>

      {/* Upload & Grid */}
      <section>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-medium text-[var(--ink-muted)]">
            我的收藏
          </h2>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-light)]"
          >
            <span className="text-lg">+</span> 上传封面
          </button>
        </div>
        <AlbumGrid key={refreshKey} />
      </section>

      {/* FAB for mobile */}
      <button
        onClick={() => setShowUpload(true)}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-2xl text-white shadow-lg transition-transform hover:scale-105 sm:hidden"
        aria-label="添加专辑"
      >
        +
      </button>

      {showUpload && (
        <AlbumUploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
}
