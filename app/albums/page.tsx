"use client"; // <--- 必须加这一行在最顶部（useAuth 等 hook 需在客户端运行）

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@clerk/nextjs";
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

export default function AlbumsPage() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
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
  const skipCategoryBlurSaveRef = useRef(false);

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
      const posterW = 1080;
      const posterH = polaroidRatio === "1:1" ? 1080 : 810;
      if (w <= 0 || h <= 0) {
        setPolaroidScale(0.5);
        return;
      }
      setPolaroidScale(Math.max(0.2, Math.min(1, w / posterW, h / posterH)));
    };
    update();
    const raf = requestAnimationFrame(() => update());
    const ro = new ResizeObserver(update);
    ro.observe(container);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
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
    skipCategoryBlurSaveRef.current = true;
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
        const albums = items.map((t: { picUrl: string; albumName?: string; name: string; artistName: string; songId?: string }) => ({
          imageUrl: t.picUrl,
          albumName: t.albumName || t.name,
          artistName: t.artistName || null,
          songId: t.songId ?? null,
          songName: t.name ?? null,
        }));
        const batchRes = await fetch("/api/albums/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ albums, categoryId: activeCategoryId }),
        });
        const batchData = await batchRes.json();
        if (!batchRes.ok) {
          const msg = batchData.error || "批量保存失败";
          const hint = batchData.hint ? `\n${batchData.hint}` : "";
          throw new Error(msg + hint);
        }
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
    if (!node) {
      setExportError("未找到导出区域，请重试");
      return;
    }
    setExportError(null);
    const originalStyle = node.style.cssText;
    try {
      node.style.width = "1080px";
      node.style.height = polaroidRatio === "1:1" ? "1080px" : "810px";
      node.style.transform = "none";
      node.style.maxWidth = "none";
      node.style.maxHeight = "none";
      if (isTransparent) {
        node.style.backgroundColor = "transparent";
        node.style.backgroundImage = "none";
        node.style.backgroundSize = "";
        node.style.backgroundPosition = "";
      }
      await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 400));
      const { toPng } = await import("html-to-image");
      const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3C/svg%3E";
      const dataUrl = await toPng(node, {
        cacheBust: true,
        includeQueryParams: true,
        pixelRatio: 2,
        type: "image/png",
        backgroundColor: isTransparent ? undefined : "#dcd7c9",
        imagePlaceholder: PLACEHOLDER,
        skipFonts: true,
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
      console.error("Export polaroid failed:", msg, err);
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
    const imgs = Array.from(gridEl.querySelectorAll<HTMLImageElement>("img[src]"));
    const restores: { el: HTMLImageElement; src: string }[] = [];
    try {
      await Promise.race([
        document.fonts.ready,
        new Promise<void>((r) => setTimeout(r, 2500)),
      ]);
      await new Promise((r) => setTimeout(r, 300));
      for (const img of imgs) {
        const src = img.getAttribute("src");
        if (!src || src.startsWith("data:")) continue;
        try {
          const res = await fetch(src, { mode: "cors", credentials: "omit" });
          if (!res.ok) continue;
          const blob = await res.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          restores.push({ el: img, src });
          img.src = dataUrl;
        } catch {
          // 单张失败不阻断，保留原 src
        }
      }
      await new Promise((r) => setTimeout(r, 100));
      const { toPng } = await import("html-to-image");
      const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3C/svg%3E";
      const dataUrl = await Promise.race([
        toPng(gridEl, {
          pixelRatio: 2,
          backgroundColor: "#fafafa",
          cacheBust: true,
          imagePlaceholder: PLACEHOLDER,
          skipFonts: true,
          filter: (node) => {
            if (node instanceof HTMLElement && node.tagName === "BUTTON") return false;
            if (node instanceof HTMLElement && node.getAttribute?.("aria-label") === "添加专辑") return false;
            return true;
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("导出超时，请稍后重试")), 15000)
        ),
      ]);
      setExportPreviewUrl(dataUrl);
      const catName = categories.find((c) => c.id === activeCategoryId)?.name;
      setExportPreviewFilename(`音乐浮墙${catName ? `-${catName}` : ""}-${Date.now()}.png`);
      setShowExportPreview(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Export poster failed:", err);
      setExportError("导出失败，请稍后重试");
      alert(`导出失败：${msg || "未知错误"}`);
    } finally {
      for (const { el, src } of restores) {
        el.src = src;
      }
    }
  };

  const handleClearExceptFirst = async () => {
    if (!confirm("确定要清空所有专辑？此操作不可恢复。")) return;
    try {
      const res = await fetch("/api/albums/clear-except-first", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
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
    <div className="mx-auto min-h-screen max-w-6xl px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(7rem,env(safe-area-inset-bottom)+5rem)] sm:px-6 sm:py-8 sm:pb-28">
      <header className="mb-8 text-center sm:mb-12">
        <h1 className="hero-title text-3xl text-[var(--ink)] sm:text-5xl">
          音乐浮墙
        </h1>
        <p className="hero-subtitle mt-3 text-sm text-[var(--ink-muted)] sm:mt-4">
          「找到自由，就找到歌声」
        </p>
        <div className="mt-4 flex justify-center sm:mt-6">
          <TabNav />
        </div>
      </header>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
          <div className="relative flex items-center gap-2" ref={exportMenuRef}>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExportMenu((v) => !v)}
                className="min-h-[44px] rounded-full border border-[var(--paper-dark)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--paper-dark)]"
              >
                导出海报 ▾
              </button>
              {showExportMenu && (
                <div className="absolute right-0 bottom-full z-20 mb-1 min-w-[140px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg sm:bottom-auto sm:top-full sm:mb-0 sm:mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportMenu(false);
                      setExportError(null);
                      handleExportPoster();
                    }}
                    className="flex min-h-[44px] w-full items-center px-4 text-left text-sm text-[var(--ink)] hover:bg-slate-50"
                  >
                    默认
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportMenu(false);
                      setShowPolaroidModal(true);
                    }}
                    className="flex min-h-[44px] w-full items-center px-4 text-left text-sm text-[var(--ink)] hover:bg-slate-50"
                  >
                    宝丽来风格
                  </button>
                </div>
              )}
            </div>
            <Link
              href="/lyrics-wall?manage=1"
              className="min-h-[44px] shrink-0 rounded-full border border-[var(--paper-dark)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--paper-dark)]"
            >
              管理展示
            </Link>
            <button
              type="button"
              onClick={handleClearExceptFirst}
              className="min-h-[44px] rounded-full border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              <span className="sm:hidden">清空</span>
              <span className="hidden sm:inline">清空</span>
            </button>
            {exportError && <span className="text-sm text-red-500">{exportError}</span>}
          </div>
        </div>
        {categoriesFallback && (
          <p className="mb-2 text-xs text-amber-600">
            分类功能需同步生产数据库后可用，当前仅显示全部专辑。请在本地执行：<code className="rounded bg-amber-100 px-1">DATABASE_URL=&quot;你的生产连接串&quot; npx prisma db push</code>，详见 <a href="https://github.com/amosfall/music-cover-demo/blob/main/DEPLOYMENT.md" target="_blank" rel="noopener noreferrer" className="underline">DEPLOYMENT.md</a>
          </p>
        )}
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-2 overflow-x-auto scroll-touch pb-1">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className={`group flex shrink-0 items-center gap-0.5 rounded-full border transition-colors ${
                  activeCategoryId === cat.id && editingCategoryId !== cat.id
                    ? "border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.08)]"
                    : "border-[rgba(0,0,0,0.06)] bg-[rgba(0,0,0,0.04)]"
                } ${editingCategoryId === cat.id ? "p-1" : "py-0.5 pl-2.5 pr-0.5"}`}
              >
                {editingCategoryId === cat.id ? (
                  <input
                    type="text"
                    value={editingCategoryName}
                    onChange={(e) => setEditingCategoryName(e.target.value)}
                    onBlur={() => {
                      if (skipCategoryBlurSaveRef.current) {
                        skipCategoryBlurSaveRef.current = false;
                        return;
                      }
                      handleSaveEditCategory();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        (e.target as HTMLInputElement).blur();
                      }
                      if (e.key === "Escape") handleCancelEditCategory();
                    }}
                    className="min-w-[80px] max-w-[140px] rounded-full border-0 bg-transparent px-2.5 py-1 text-sm text-[var(--ink)] outline-none focus:ring-0"
                    autoFocus
                  />
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (activeCategoryId === cat.id && cat.name !== "Default") {
                          handleStartEditCategory(cat);
                        } else {
                          setActiveCategoryId(cat.id);
                        }
                      }}
                      className={`rounded-full px-2.5 py-1.5 text-left text-sm font-medium transition-colors ${
                        activeCategoryId === cat.id
                          ? "text-[var(--ink)] font-semibold"
                          : "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[rgba(0,0,0,0.03)]"
                      } ${cat.name !== "Default" ? "cursor-pointer" : ""}`}
                      title={cat.name !== "Default" ? "再次点击编辑名称" : undefined}
                    >
                      {cat.name}
                    </button>
                    {cat.name !== "Default" && editingCategoryId !== cat.id && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }}
                        className="flex min-h-[32px] min-w-[32px] items-center justify-center rounded-full p-1 text-[var(--ink-muted)] transition-colors hover:bg-black/5 hover:text-red-500"
                        aria-label={`删除 ${cat.name}`}
                      >
                        ×
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
            {!categoriesFallback &&
              (isAddingCategory ? (
                <div className="ml-1 shrink-0 inline-flex rounded-full border border-[rgba(0,0,0,0.06)] bg-[rgba(0,0,0,0.04)] p-1.5">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onBlur={() => {
                      if (newCategoryName.trim()) handleSubmitNewCategory();
                      else handleCancelNewCategory();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSubmitNewCategory();
                      if (e.key === "Escape") handleCancelNewCategory();
                    }}
                    placeholder="新歌单名字是："
                    className="min-w-[120px] max-w-[180px] rounded-full border-0 bg-transparent px-4 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] outline-none focus:ring-0"
                    autoFocus
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  className="ml-1 shrink-0 rounded-full border border-dashed border-[rgba(0,0,0,0.12)] bg-transparent px-3 py-1.5 text-sm font-medium text-[var(--ink-muted)] transition-colors hover:border-[rgba(0,0,0,0.2)] hover:bg-[rgba(0,0,0,0.04)] hover:text-[var(--ink)]"
                  aria-label="新建分类"
                >
                  +
                </button>
              ))}
          </div>
        </div>
        <div id="album-wall-export">
          <AlbumGrid
            key={`${refreshKey}-${activeCategoryId}`}
            categoryId={activeCategoryId ?? undefined}
          />
        </div>
      </section>

      <button
        type="button"
        onClick={() => {
          if (!isSignedIn) {
            alert("请先登录后再添加歌/专辑/歌单");
            router.push("/sign-in");
            return;
          }
          setShowSearchOverlay(true);
        }}
        className="search-trigger-capsule"
        aria-label="添加网易云链接"
      >
        这里
      </button>

      {showSearchOverlay && (
        <div
          className="search-overlay-backdrop"
          onClick={() => setShowSearchOverlay(false)}
          role="presentation"
        >
          <div
            className="search-overlay-panel search-overlay-panel-mobile"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="添加网易云链接"
          >
            <div className="mb-4 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowSearchOverlay(false)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-1.5 text-[var(--ink-muted)] hover:bg-[var(--paper-dark)] hover:text-[var(--ink)]"
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
                placeholder="歌/专辑/歌单"
                className="w-full rounded-xl border border-[var(--paper-dark)] bg-white px-4 py-3 text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              <motion.button
                type="button"
                onClick={handleAddLink}
                disabled={linkLoading}
                className="w-full rounded-xl border border-[var(--paper-dark)] bg-[var(--paper-dark)] px-4 py-3 text-sm font-medium text-[var(--ink)] disabled:opacity-60 hover:bg-black/5"
                whileHover={linkLoading ? undefined : { scale: 1.01 }}
                whileTap={linkLoading ? undefined : { scale: 0.99 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                {linkLoading ? "添加中..." : "GO!"}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="relative flex h-[85dvh] max-h-[90vh] w-full max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl bg-[var(--paper-dark)] shadow-xl sm:max-w-4xl sm:rounded-2xl">
            <button
              type="button"
              onClick={() => setShowPolaroidModal(false)}
              className="absolute right-3 top-3 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
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
                  className="flex min-h-[280px] min-w-0 flex-1 justify-center overflow-hidden"
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={() => { setShowExportPreview(false); setExportPreviewUrl(null); setExportPreviewFilename(""); }}>
          <div className="relative max-h-[85dvh] w-full max-w-[calc(100vw-2rem)] rounded-xl bg-white p-4 shadow-xl sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => { setShowExportPreview(false); setExportPreviewUrl(null); setExportPreviewFilename(""); }}
              className="absolute right-2 top-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
              aria-label="关闭"
            >
              ×
            </button>
            <img src={exportPreviewUrl} alt="导出预览" className="max-h-[70dvh] w-full object-contain rounded-lg" draggable={false} referrerPolicy="no-referrer" />
            <p className="mt-3 text-center text-sm text-[var(--ink-muted)]">长按图片可保存到相册</p>
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={handleDownloadFromPreview}
                className="min-h-[44px] rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-light)]"
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
