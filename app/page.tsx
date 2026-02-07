"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import AlbumGrid from "@/components/AlbumGrid";
import PolaroidPoster from "@/components/PolaroidPoster";
import TabNav from "@/components/TabNav";

/** 从粘贴文本中提取网易云链接（支持分享文案中含 URL） */
function extractNeteaseUrl(text: string): string {
  const trimmed = text.trim();
  const urlMatch = trimmed.match(/https?:\/\/[^\s]+music\.163\.com[^\s]*/i);
  if (urlMatch) {
    return urlMatch[0].replace(/[)\]\s]+$/, "").trim();
  }
  return trimmed;
}

type Category = { id: string; name: string; sortOrder: number };

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [showPolaroidModal, setShowPolaroidModal] = useState(false);
  const [polaroidRatio, setPolaroidRatio] = useState<"1:1" | "4:3">("1:1");
  const [addTitleTrigger, setAddTitleTrigger] = useState(0);
  const [addDateTrigger, setAddDateTrigger] = useState(0);
  const [addSloganTrigger, setAddSloganTrigger] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [linkInput, setLinkInput] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const polaroidPreviewRef = useRef<HTMLDivElement>(null);
  const [polaroidScale, setPolaroidScale] = useState(1);
  const [isTransparent, setIsTransparent] = useState(false);
  const [exportPreviewUrl, setExportPreviewUrl] = useState<string | null>(null);
  const [exportPreviewFilename, setExportPreviewFilename] = useState<string>("");
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [categoriesFallback, setCategoriesFallback] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const searchOverlayInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showExportMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showExportMenu]);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data)
          ? data
          : (data?.fallback && Array.isArray(data?.list) ? data.list : []);
        setCategories(list);
        setCategoriesFallback(!!data?.fallback);
        if (list.length > 0 && !activeCategoryId) {
          setActiveCategoryId(list[0].id);
        }
      })
      .catch(() => {
        setCategories([{ id: "all", name: "全部", sortOrder: 0 }]);
        setActiveCategoryId("all");
        setCategoriesFallback(true);
      });
  }, []);

  useEffect(() => {
    if (!showPolaroidModal) return;
    const container = polaroidPreviewRef.current;
    if (!container) return;
    const update = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;
      const posterW = 1080;
      const posterH = polaroidRatio === "1:1" ? 1080 : 810;
      setPolaroidScale(Math.max(0.2, Math.min(1, w / posterW, h / posterH)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(container);
    return () => ro.disconnect();
  }, [showPolaroidModal, polaroidRatio]);

  const handleUploadSuccess = () => {
    setRefreshKey((k) => k + 1);
  };

  const fetchCategories = () => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setCategories(list);
        if (list.length > 0 && !list.some((c: Category) => c.id === activeCategoryId)) {
          setActiveCategoryId(list[0].id);
        }
      });
  };

  const handleCreateCategory = () => {
    setIsAddingCategory(true);
  };

  const handleSubmitNewCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "创建失败");
      const newCat = data as Category;
      setCategories((prev) => [...prev, newCat].sort((a, b) => a.sortOrder - b.sortOrder));
      setNewCategoryName("");
      setIsAddingCategory(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "创建分类失败");
    }
  };

  const handleCancelNewCategory = () => {
    setIsAddingCategory(false);
    setNewCategoryName("");
  };

  const handleStartEditCategory = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setEditingCategoryName(cat.name);
  };

  const handleSaveEditCategory = async () => {
    if (!editingCategoryId || !editingCategoryName.trim()) {
      setEditingCategoryId(null);
      return;
    }
    try {
      const res = await fetch(`/api/categories/${editingCategoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingCategoryName.trim() }),
      });
      if (!res.ok) throw new Error("重命名失败");
      setCategories((prev) =>
        prev.map((c) =>
          c.id === editingCategoryId ? { ...c, name: editingCategoryName.trim() } : c
        )
      );
      setEditingCategoryId(null);
      setEditingCategoryName("");
    } catch {
      alert("重命名失败");
    }
  };

  const handleCancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditingCategoryName("");
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("确定删除此分类？该分类下的专辑将移至 Default。")) return;
    try {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      setCategories((prev) => prev.filter((c) => c.id !== id));
      if (activeCategoryId === id) {
        const remaining = categories.filter((c) => c.id !== id);
        setActiveCategoryId(remaining[0]?.id ?? null);
      }
    } catch {
      alert("删除分类失败");
    }
  };

  const isPlaylistUrl = (u: string) =>
    /playlist[\?\/]|playlist\.id=/i.test(u) || /music\.163\.com[^/]*\/playlist/i.test(u);

  const handleAddLink = async () => {
    const url = extractNeteaseUrl(linkInput) || linkInput.trim();
    if (!url) {
      setLinkError("请粘贴网易云音乐链接");
      return;
    }
    setLinkLoading(true);
    setLinkError(null);
    try {
      if (isPlaylistUrl(url)) {
        const playlistRes = await fetch("/api/playlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const playlistData = await playlistRes.json();
        if (!playlistRes.ok) throw new Error(playlistData.error || "获取歌单失败");
        const items = playlistData?.items ?? [];
        if (items.length === 0) {
          setLinkError("歌单内暂无曲目");
          return;
        }
        const albums = items.map((t: { picUrl: string; albumName?: string; name: string; artistName: string }) => ({
          imageUrl: t.picUrl,
          albumName: t.albumName || t.name,
          artistName: t.artistName || null,
        }));
        const batchRes = await fetch("/api/albums/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ albums, categoryId: activeCategoryId }),
        });
        const batchData = await batchRes.json();
        if (!batchRes.ok) throw new Error(batchData.error || "批量保存失败");
        setLinkInput("");
        setShowSearchOverlay(false);
        handleUploadSuccess();
      } else {
        const res = await fetch("/api/parse-netease", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, categoryId: activeCategoryId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "解析失败");
        setLinkInput("");
        setShowSearchOverlay(false);
        handleUploadSuccess();
      }
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "添加失败");
    } finally {
      setLinkLoading(false);
    }
  };

  const handleExportPolaroid = async () => {
    (document.activeElement as HTMLElement)?.blur();
    const node = document.getElementById("polaroid-export-container") as HTMLElement | null;
    if (!node) return;
    setExportError(null);
    const originalStyle = node.style.cssText;
    try {
      node.style.width = "1080px";
      node.style.height = polaroidRatio === "1:1" ? "1080px" : "810px";
      node.style.transform = "none";
      if (isTransparent) {
        node.style.backgroundColor = "transparent";
        node.style.backgroundImage = "none";
        node.style.backgroundSize = "";
        node.style.backgroundPosition = "";
      }
      await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 500));
      const { toPng } = await import("html-to-image");
      const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3C/svg%3E";
      const dataUrl = await toPng(node, {
        cacheBust: true,
        includeQueryParams: true,
        pixelRatio: 2,
        type: "image/png",
        backgroundColor: isTransparent ? undefined : "#dcd7c9",
        imagePlaceholder: PLACEHOLDER,
        filter: (n) => !(n instanceof HTMLElement && n.getAttribute?.("data-hide-on-export") != null),
      });
      setExportPreviewUrl(dataUrl);
      setExportPreviewFilename(`音乐浮墙-宝丽来-${polaroidRatio.replace(":", "x")}-${Date.now()}.png`);
      setShowExportPreview(true);
      const link = document.createElement("a");
      link.download = `音乐浮墙-宝丽来-${polaroidRatio.replace(":", "x")}-${Date.now()}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const detail = err instanceof Error ? err.stack ?? msg : msg;
      console.error("Export polaroid failed:", msg, err);
      if (detail) console.error("Detail:", detail);
      setExportError("导出失败，请稍后重试");
      alert(`导出失败：${msg || "未知错误"}。若使用网易云图片，请确保网络正常。`);
    } finally {
      node.style.cssText = originalStyle;
    }
  };

  const handleExportPoster = async () => {
    const wrapper = document.getElementById("album-wall-export");
    if (!wrapper) return;
    const gridEl = wrapper.querySelector(".album-wall") as HTMLElement | null;
    if (!gridEl) {
      setExportError("请先添加专辑后再导出");
      return;
    }
    setExportError(null);
    try {
      await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 300));
      const { toPng } = await import("html-to-image");
      const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3C/svg%3E";
      const dataUrl = await toPng(gridEl, {
        pixelRatio: 2,
        backgroundColor: "#fafafa",
        cacheBust: true,
        imagePlaceholder: PLACEHOLDER,
        filter: (node) => {
          if (node instanceof HTMLElement && node.tagName === "BUTTON") return false;
          if (node instanceof HTMLElement && node.getAttribute?.("aria-label") === "添加专辑") return false;
          return true;
        },
      });
      setExportPreviewUrl(dataUrl);
      const catName = categories.find((c) => c.id === activeCategoryId)?.name;
      setExportPreviewFilename(`音乐浮墙${catName ? `-${catName}` : ""}-${Date.now()}.png`);
      setShowExportPreview(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Export poster failed:", err);
      setExportError("导出失败，请稍后重试");
      alert(`导出失败：${msg || "未知错误"}`);
    }
  };

  const handleClearExceptFirst = async () => {
    if (!confirm("确定保留最早添加的 4 张专辑，其余全部删除？此操作不可恢复。")) return;
    try {
      const res = await fetch("/api/albums/clear-except-first", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keep: 4 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "清除失败");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "一键清除失败");
    }
  };

  const handleDownloadFromPreview = () => {
    if (!exportPreviewUrl || !exportPreviewFilename) return;
    const link = document.createElement("a");
    link.download = exportPreviewFilename;
    link.href = exportPreviewUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    if (showSearchOverlay) {
      searchOverlayInputRef.current?.focus();
    }
  }, [showSearchOverlay]);

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-6 pb-28 sm:px-6 sm:py-8">
      {/* Header：Noto Serif SC + 字间距，极简艺术感 */}
      <header className="mb-12 text-center">
        <h1 className="hero-title text-4xl text-[var(--ink)] sm:text-5xl">
          音乐浮墙
        </h1>
        <p className="hero-subtitle mt-4 text-sm text-[var(--ink-muted)]">
          「找到自由，就找到歌声」
        </p>
        <div className="mt-6 flex justify-center">
          <TabNav />
        </div>
      </header>

      {/* Upload & Grid */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium text-[var(--ink-muted)]">
            我的收藏
          </h2>
          <div className="relative flex items-center gap-2" ref={exportMenuRef}>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExportMenu((v) => !v)}
                className="rounded-full border border-[var(--paper-dark)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--paper-dark)]"
              >
                导出海报 ▾
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportMenu(false);
                      setExportError(null);
                      handleExportPoster();
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-[var(--ink)] hover:bg-slate-50"
                  >
                    默认
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportMenu(false);
                      setShowPolaroidModal(true);
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-[var(--ink)] hover:bg-slate-50"
                  >
                    宝丽来风格
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleClearExceptFirst}
              className="rounded-full border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              一键清除
            </button>
            {exportError && <span className="text-sm text-red-500">{exportError}</span>}
          </div>
        </div>
        {categoriesFallback && (
          <p className="mb-2 text-xs text-amber-600">
            分类功能需执行 <code className="rounded bg-amber-100 px-1">npx prisma db push</code> 后完整可用，当前仅显示全部专辑
          </p>
        )}
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <div key={cat.id} className="group flex shrink-0 items-center gap-1">
                {editingCategoryId === cat.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editingCategoryName}
                      onChange={(e) => setEditingCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEditCategory();
                        if (e.key === "Escape") handleCancelEditCategory();
                      }}
                      className="min-w-[80px] max-w-[140px] rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-900 outline-none focus:border-[var(--accent)]"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSaveEditCategory}
                      className="rounded px-2 py-0.5 text-xs text-white bg-[var(--accent)] hover:bg-[var(--accent-light)]"
                    >
                      确定
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEditCategory}
                      className="rounded px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveCategoryId(cat.id)}
                    onDoubleClick={() => cat.name !== "Default" && handleStartEditCategory(cat)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      activeCategoryId === cat.id
                        ? "bg-slate-100 text-slate-900 font-semibold"
                        : "bg-transparent text-slate-500 hover:text-slate-700"
                    } ${cat.name !== "Default" ? "cursor-pointer" : ""}`}
                    title={cat.name !== "Default" ? "双击编辑名称" : undefined}
                  >
                    {cat.name}
                  </button>
                )}
                {cat.name !== "Default" && editingCategoryId !== cat.id && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleStartEditCategory(cat); }}
                      className="rounded p-0.5 text-slate-400 opacity-0 transition-opacity hover:text-slate-600 group-hover:opacity-100"
                      aria-label={`编辑 ${cat.name}`}
                      title="编辑"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }}
                      className="rounded p-0.5 text-slate-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                      aria-label={`删除 ${cat.name}`}
                    >
                      ×
                    </button>
                  </>
                )}
              </div>
            ))}
            {!categoriesFallback && (
              <button
                type="button"
                onClick={handleCreateCategory}
                className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="新建分类"
              >
                +
              </button>
            )}
          </div>
          {!categoriesFallback && isAddingCategory && (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmitNewCategory();
                  if (e.key === "Escape") handleCancelNewCategory();
                }}
                placeholder="输入分类名称"
                className="flex-1 max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSubmitNewCategory}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-light)]"
              >
                添加
              </button>
              <button
                type="button"
                onClick={handleCancelNewCategory}
                className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                取消
              </button>
            </div>
          )}
        </div>
        <div id="album-wall-export">
          <AlbumGrid
            key={`${refreshKey}-${activeCategoryId}`}
            categoryId={activeCategoryId ?? undefined}
          />
        </div>
      </section>

      {/* 底部浮动搜索触发器：毛玻璃胶囊 */}
      <button
        type="button"
        onClick={() => setShowSearchOverlay(true)}
        className="search-trigger-capsule"
        aria-label="添加网易云链接"
      >
        <span className="opacity-80">🔗</span>
        <span>粘贴链接，添加歌曲 / 专辑 / 歌单</span>
      </button>

      {/* 全屏搜索 Overlay：高斯模糊 */}
      {showSearchOverlay && (
        <div
          className="search-overlay-backdrop"
          onClick={() => setShowSearchOverlay(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white/80 p-5 shadow-xl backdrop-blur-md border border-white/90"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="添加网易云链接"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--ink-muted)]">添加收藏</span>
              <button
                type="button"
                onClick={() => setShowSearchOverlay(false)}
                className="rounded-full p-1.5 text-[var(--ink-muted)] hover:bg-black/5 hover:text-[var(--ink)]"
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <input
                ref={searchOverlayInputRef}
                type="text"
                value={linkInput}
                onChange={(e) => { setLinkInput(e.target.value); setLinkError(null); }}
                onPaste={(e) => {
                  const raw = e.clipboardData.getData("text");
                  const extracted = extractNeteaseUrl(raw);
                  if (extracted) setLinkInput(extracted);
                  else setLinkInput(raw);
                  setLinkError(null);
                }}
                placeholder="粘贴网易云链接或分享文案"
                className="w-full rounded-xl border border-black/10 bg-white/90 px-4 py-3 text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              <motion.button
                type="button"
                onClick={handleAddLink}
                disabled={linkLoading}
                className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                whileHover={linkLoading ? undefined : { scale: 1.02 }}
                whileTap={linkLoading ? undefined : { scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                {linkLoading ? "添加中..." : "抓取"}
              </motion.button>
            </div>
            {linkError && (
              <p className="mt-3 text-sm text-red-500">
                {linkError}
                {linkError.includes("网易云 API") && (
                  <a
                    href="/api/check-netease"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-xs underline hover:text-red-700"
                  >
                    诊断连接
                  </a>
                )}
              </p>
            )}
          </div>
        </div>
      )}

      {showPolaroidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative flex h-[90vh] max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-[var(--paper-dark)] shadow-xl">
            <button
              type="button"
              onClick={() => setShowPolaroidModal(false)}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
              aria-label="关闭"
            >
              ×
            </button>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
              <div className="mb-3 flex shrink-0 justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setPolaroidRatio("1:1")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${polaroidRatio === "1:1" ? "bg-[var(--accent)] text-white" : "bg-[var(--paper-dark)] text-[var(--ink-muted)]"}`}
                >
                  1:1 正方形
                </button>
                <button
                  type="button"
                  onClick={() => setPolaroidRatio("4:3")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${polaroidRatio === "4:3" ? "bg-[var(--accent)] text-white" : "bg-[var(--paper-dark)] text-[var(--ink-muted)]"}`}
                >
                  4:3
                </button>
              </div>
              <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
                <div
                  ref={polaroidPreviewRef}
                  className="flex min-h-0 flex-1 justify-center overflow-hidden"
                >
                  <div
                    style={{
                      width: 1080,
                      height: polaroidRatio === "1:1" ? 1080 : 810,
                      transform: `scale(${polaroidScale})`,
                      transformOrigin: "top center",
                      flexShrink: 0,
                    }}
                  >
                    <PolaroidPoster ratio={polaroidRatio} isTransparent={isTransparent} addTitleTrigger={addTitleTrigger} addDateTrigger={addDateTrigger} addSloganTrigger={addSloganTrigger} categoryId={activeCategoryId} />
                  </div>
                </div>
                <div className="flex w-32 shrink-0 flex-col gap-3 border-l border-[var(--paper-dark)] pl-4">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-medium text-[var(--ink-muted)]">背景选择</span>
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsTransparent(false)}
                        className={`rounded-lg px-3 py-2 text-sm font-medium ${!isTransparent ? "bg-[var(--accent)] text-white" : "border border-[var(--paper-dark)] bg-white text-[var(--ink-muted)] hover:bg-[var(--paper-dark)]/50"}`}
                      >
                        经典米色
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsTransparent(true)}
                        className={`rounded-lg px-3 py-2 text-sm font-medium ${isTransparent ? "bg-[var(--accent)] text-white" : "border border-[var(--paper-dark)] bg-white text-[var(--ink-muted)] hover:bg-[var(--paper-dark)]/50"}`}
                      >
                        透明背景
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-medium text-[var(--ink-muted)]">添加元素</span>
                  <button
                    type="button"
                    onClick={() => setAddTitleTrigger((n) => n + 1)}
                    className="rounded-lg border border-[var(--paper-dark)] bg-white px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--paper-dark)]/50"
                  >
                    标题
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddDateTrigger((n) => n + 1)}
                    className="rounded-lg border border-[var(--paper-dark)] bg-white px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--paper-dark)]/50"
                  >
                    日期
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddSloganTrigger((n) => n + 1)}
                    className="rounded-lg border border-[var(--paper-dark)] bg-white px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--paper-dark)]/50"
                  >
                    Slogan
                  </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 flex justify-center gap-2 border-t border-[var(--paper-dark)] bg-white/95 p-4">
              <button
                type="button"
                onClick={() => { setExportError(null); handleExportPolaroid(); }}
                className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-light)]"
              >
                导出图片
              </button>
              <button
                type="button"
                onClick={() => setShowPolaroidModal(false)}
                className="rounded-full border border-[var(--paper-dark)] px-5 py-2.5 text-sm font-medium text-[var(--ink)]"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {showExportPreview && exportPreviewUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={() => { setShowExportPreview(false); setExportPreviewUrl(null); setExportPreviewFilename(""); }}>
          <div className="relative max-h-[90vh] max-w-lg rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => { setShowExportPreview(false); setExportPreviewUrl(null); setExportPreviewFilename(""); }}
              className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
              aria-label="关闭"
            >
              ×
            </button>
            <img src={exportPreviewUrl} alt="导出预览" className="max-h-[80vh] w-full object-contain rounded-lg" draggable={false} />
            <p className="mt-3 text-center text-sm text-[var(--ink-muted)]">长按图片可保存到相册</p>
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={handleDownloadFromPreview}
                className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-light)]"
              >
                导出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
