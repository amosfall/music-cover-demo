"use client";

import { useState, useEffect, useMemo, memo, useCallback } from "react";
import Image from "next/image";
import { getProxyImageUrl } from "@/lib/proxy-image";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

const isExternalUrl = (url: string) => /^https?:\/\//.test(url);
const isDataUrl = (url: string) => /^data:/.test(url);
/** 识别占位图 URL：不发起请求，直接用内联 SVG 渲染，避免外网/墙导致不显示。music.126.net 为真实封面，不走此分支 */
const isPlaceholderUrl = (url: string) =>
  !url ||
  url.startsWith("data:image/svg") ||
  url.includes("placehold.co") ||
  url.includes("placehold.it");

/** 内联占位图：灰底 + ♪，完全不依赖外网 */
const PlaceholderCover = memo(function PlaceholderCover() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#e5e5e5] text-[var(--ink-muted)]" aria-hidden>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" className="opacity-60">
        <text x="12" y="16" textAnchor="middle" fontSize="18" fontFamily="sans-serif">♪</text>
      </svg>
    </div>
  );
});

/** 封面加载失败时的占位：灰色底 + 专辑名首字或 🎵 */
const CoverFallback = memo(function CoverFallback({ name }: { name: string }) {
  const char = name?.trim()[0] || "♪";
  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--paper-dark)] text-4xl font-medium text-[var(--ink-muted)]">
      {char}
    </div>
  );
});

const CoverImage = memo(function CoverImage({ src, alt }: { src: string; alt: string }) {
  const [err, setErr] = useState(false);
  if (!src || isPlaceholderUrl(src)) {
    return <PlaceholderCover />;
  }
  if (err) {
    return <CoverFallback name={alt} />;
  }
  const displaySrc = getProxyImageUrl(src);
  const isProxy = displaySrc.startsWith("/api/proxy-image");
  const useImg = isProxy || isExternalUrl(displaySrc) || isDataUrl(displaySrc);
  if (useImg) {
    return (
      <img
        src={displaySrc}
        alt={alt}
        className="h-full w-full object-cover"
        loading="lazy"
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <Image
      src={displaySrc}
      alt={alt}
      fill
      className="object-cover"
      sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 180px"
      unoptimized
      referrerPolicy="no-referrer"
      onError={() => setErr(true)}
    />
  );
});

type AlbumCover = {
  id: string;
  imageUrl: string;
  albumName: string;
  artistName: string | null;
  releaseYear: string | null;
  genre: string | null;
  /** 导入时代表的曲目（歌单/专辑链接对应的那首歌） */
  songName: string | null;
  songId: string | null;
  // 仅在 public 模式下有
  pickCount?: number;
  avgRating?: number;
  reviewCount?: number;
};

function getItemStyle(index: number) {
  return { zIndex: index };
}

type AlbumGridProps = {
  categoryId?: string | null;
  scope?: "personal" | "public";
  readOnly?: boolean;
  layout?: "grid" | "list";
};

export default function AlbumGrid({ categoryId, scope = "personal", readOnly = false, layout = "grid" }: AlbumGridProps) {
  const { isSignedIn, user } = useUser();
  const router = useRouter();
  const [items, setItems] = useState<AlbumCover[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumCover | null>(null);

  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [newRating, setNewRating] = useState(0);
  const [newComment, setNewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("_", String(Date.now()));

    if (scope === "public") {
      const endpoint = layout === "list" ? "/api/albums/public/all" : "/api/albums/public/top";
      fetch(`${endpoint}?${params.toString()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" }
      })
        .then((res) => res.json())
        .then((data) => {
          // 适配 TopAlbum 结构到 AlbumCover
          const adapted = (Array.isArray(data) ? data : []).map((item: any, idx: number) => ({
            id: item.id || `public-${idx}`, // 使用后端 ID 或生成虚拟 ID
            imageUrl: item.imageUrl,
            albumName: item.albumName,
            artistName: item.artistName,
            releaseYear: null,
            genre: null,
            songName: null,
            songId: null,
            // 额外字段
            pickCount: item.pickCount,
            avgRating: item.avgRating,
            reviewCount: item.reviewCount,
          }));
          setItems(adapted);
          setLoading(false);
        })
        .catch(() => setLoading(false));
      return;
    }

    if (scope === "personal" && categoryId) {
      params.set("categoryId", categoryId);
    }
    if (scope) {
      params.set("scope", scope);
    }
    
    fetch(`/api/albums?${params.toString()}`, { 
      cache: "no-store", 
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" } 
    })
      .then((res) => res.json())
      .then((data) => {
        setItems(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [categoryId, scope, layout]);

  const fetchReviews = useCallback((albumName: string, artistName: string | null) => {
    setReviewsLoading(true);
    const params = new URLSearchParams();
    params.set("albumName", albumName);
    if (artistName) params.set("artistName", artistName);
    
    fetch(`/api/reviews?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        setReviews(Array.isArray(data) ? data : []);
      })
      .finally(() => setReviewsLoading(false));
  }, []);

  const handleSelectAlbum = useCallback((item: AlbumCover) => {
    // If multiple songs from same album, we want to show all of them in the modal
    // But currently the modal only shows one item (selectedAlbum)
    // We need to find all items that belong to this album
    
    // For now, let's just select the clicked item.
    // If the user wants to see all songs in the album, we might need a different UI
    // like a list of songs inside the modal.
    
    // Actually, based on user request: "点开一张专辑，里面可以看到导入的多首歌"
    // We need to fetch/filter all songs for this album.
    
    // Let's pass the album info to the state, and render a list in the modal.
    setSelectedAlbum(item);
    
    if (scope === "public") {
      fetchReviews(item.albumName, item.artistName);
      setNewRating(0);
      setNewComment("");
    }
  }, [scope, fetchReviews]);

  const handleLikeReview = async (reviewId: string) => {
    if (!isSignedIn) {
      alert("请先登录后点赞");
      return;
    }
    
    // 乐观更新
    setReviews(prev => prev.map(r => {
      if (r.id === reviewId) {
        return {
          ...r,
          isLiked: !r.isLiked,
          likes: r.isLiked ? r.likes - 1 : r.likes + 1
        };
      }
      return r;
    }));

    try {
      const res = await fetch(`/api/reviews/${reviewId}/like`, { method: "POST" });
      if (!res.ok) throw new Error();
    } catch {
      // 回滚
      setReviews(prev => prev.map(r => {
        if (r.id === reviewId) {
          return {
            ...r,
            isLiked: !r.isLiked,
            likes: r.isLiked ? r.likes - 1 : r.likes + 1
          };
        }
        return r;
      }));
      alert("点赞失败");
    }
  };

  const handleSubmitReview = useCallback(async () => {
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }
    if (!selectedAlbum || !newRating) return;
    setSubmittingReview(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          albumName: selectedAlbum.albumName,
          artistName: selectedAlbum.artistName,
          rating: newRating,
          content: newComment,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      
      // 重新获取评论列表以确保信息完整（包括用户信息）
      fetchReviews(selectedAlbum.albumName, selectedAlbum.artistName);
      
      setNewRating(0);
      setNewComment("");
      alert("评价成功！");
    } catch {
      alert("评价失败，请稍后重试");
    } finally {
      setSubmittingReview(false);
    }
  }, [selectedAlbum, newRating, newComment, isSignedIn, router, fetchReviews]);

  const list = Array.isArray(items) ? items : [];
  const listDeduped = useMemo(() => {
    // 公共区域不需要去重，因为后端已经聚合了
    if (scope === "public") return list;
    
    // Personal scope: deduplicate by albumName so we only show one cover per album
    // The user wants to click one album cover and see all songs inside
    const seen = new Set<string>();
    return list.filter((item) => {
      // 統一使用 albumName 作為唯一鍵
      // 為了更嚴謹，可以用 `${item.albumName}||${item.artistName || ""}` 作為唯一標識
      const key = `${item.albumName}||${item.artistName || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [items, scope]);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("确定删除这张专辑？")) return;
    const res = await fetch(`/api/albums/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }
  if (listDeduped.length === 0) {
    return null;
  }

  return (
    <>
      {layout === "list" ? (
        <div className="flex flex-col gap-2 pb-8">
          {listDeduped.map((item) => (
            <div
              key={item.id}
              className="group flex cursor-pointer items-center justify-between rounded-lg border border-transparent bg-white px-4 py-3 shadow-sm transition-all hover:border-[var(--paper-dark)] hover:shadow-md"
              onClick={() => handleSelectAlbum(item)}
            >
              <div className="flex flex-col">
                <span className="font-medium text-[var(--ink)]">{item.albumName}</span>
                {item.artistName && (
                  <span className="text-xs text-[var(--ink-muted)]">{item.artistName}</span>
                )}
              </div>
              <span className="text-xs text-[var(--ink-muted)] opacity-0 transition-opacity group-hover:opacity-100">
                查看详情 ›
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="album-wall">
          {listDeduped.map((item, index) => (
            <div
              key={item.id}
              className="album-cover-wrapper group cursor-pointer"
              style={getItemStyle(index)}
              onClick={() => handleSelectAlbum(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && handleSelectAlbum(item)}
            >
              <div className="album-cover-inner relative">
                <div className="relative aspect-square overflow-hidden rounded-lg bg-[var(--paper-dark)] shadow-lg transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl">
                  <CoverImage src={item.imageUrl} alt={item.albumName} />
                </div>
                {!readOnly && (
                  <button
                    onClick={(e) => handleDelete(item.id, e)}
                    className="absolute top-1 right-1 z-10 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white opacity-0 shadow backdrop-blur-sm transition-opacity hover:bg-red-600 group-hover:opacity-100"
                  >
                    删除
                  </button>
                )}
                {scope === "public" && typeof item.pickCount === "number" && (
                  <div className="absolute top-1 left-1 z-10 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white shadow backdrop-blur-sm">
                    🔥 {item.pickCount}
                  </div>
                )}
                {scope === "public" && typeof item.avgRating === "number" && item.avgRating > 0 && (
                  <div className="absolute top-1 right-1 z-10 rounded-full bg-black/50 px-2 py-0.5 text-xs text-amber-400 shadow backdrop-blur-sm">
                    ★ {item.avgRating.toFixed(1)}
                  </div>
                )}
                <div className="mt-2 text-center">
                  <p className="truncate text-sm font-medium text-[var(--ink)]" title={item.albumName}>
                    {item.albumName}
                  </p>
                  {(item.artistName || item.releaseYear) && (
                    <p className="truncate text-xs text-[var(--ink-muted)]">
                      {[item.artistName, item.releaseYear].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 专辑详情：当时导入的是哪一首歌 */}
      {selectedAlbum && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
          onClick={() => setSelectedAlbum(null)}
        >
          <div
            className="relative flex flex-col max-h-[85dvh] w-full max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl bg-white shadow-xl sm:max-h-[90vh] sm:max-w-sm sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="relative aspect-square w-full overflow-hidden bg-[var(--paper-dark)]">
                <CoverImage src={selectedAlbum.imageUrl} alt={selectedAlbum.albumName} />
              </div>
              <div className="p-4">
                <p className="text-lg font-medium text-[var(--ink)]">
                  {selectedAlbum.albumName}
                </p>
                {(selectedAlbum.artistName || selectedAlbum.releaseYear?.trim()) && (
                  <p className="mt-0.5 text-sm text-[var(--ink-muted)]">
                    {[selectedAlbum.artistName, selectedAlbum.releaseYear?.trim()]
                      .filter(Boolean)
                      .join(" / ")}
                  </p>
                )}
                
                {/* 列出该专辑下所有已导入的歌曲 */}
                {scope === "personal" && (
                  <div className="mt-4 border-t border-[var(--paper-dark)] pt-3">
                    <p className="mb-2 text-xs font-medium text-[var(--ink-muted)]">包含曲目 ({items.filter(i => i.albumName === selectedAlbum.albumName && (i.artistName || "") === (selectedAlbum.artistName || "")).length})</p>
                    <ul className="space-y-1 max-h-40 overflow-y-auto">
                      {items
                        .filter(i => i.albumName === selectedAlbum.albumName && (i.artistName || "") === (selectedAlbum.artistName || ""))
                        .map(song => (
                          <li key={song.id} className="text-sm text-[var(--ink)] flex items-center gap-2">
                             <span className="text-[var(--ink-muted)] text-xs">♪</span>
                             <span>{song.songName || "未知曲目"}</span>
                          </li>
                        ))
                      }
                    </ul>
                  </div>
                )}
                
                {scope === "public" && (
                  <div className="mt-4 border-t border-[var(--paper-dark)] pt-4">
                    <h3 className="mb-2 text-sm font-medium">评论与评分 ({reviews.length})</h3>
                    <div className="max-h-40 overflow-y-auto space-y-3 mb-3">
                      {reviewsLoading ? (
                        <p className="text-xs text-[var(--ink-muted)]">加载中...</p>
                      ) : reviews.length === 0 ? (
                        <p className="text-xs text-[var(--ink-muted)]">暂无评论，来发一条吧</p>
                      ) : (
                        reviews.map((r) => (
                          <div key={r.id} className="text-xs border-b border-[var(--paper-dark)] pb-2 last:border-0">
                            <div className="flex items-start gap-2">
                              <div className="shrink-0 h-8 w-8 rounded-full bg-gray-200 overflow-hidden relative">
                                {r.user?.imageUrl ? (
                                  <Image src={r.user.imageUrl} alt={r.user.username} fill className="object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-gray-400 text-[10px]">
                                    {r.user?.username?.[0]?.toUpperCase() || "?"}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-0.5">
                                  <span className="font-medium text-[var(--ink)] truncate">
                                    {r.user?.username || "未知用户"}
                                  </span>
                                  <span className="text-[10px] text-[var(--ink-muted)]">
                                    {new Date(r.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-amber-500 text-[10px]">{"★".repeat(r.rating)}</span>
                                </div>
                                {r.content && <p className="text-[var(--ink)] leading-relaxed break-words">{r.content}</p>}
                                <div className="mt-1.5 flex items-center justify-end">
                                  <button
                                    onClick={() => handleLikeReview(r.id)}
                                    className={`flex items-center gap-1 text-[10px] transition-colors ${
                                      r.isLiked ? "text-red-500" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                                    }`}
                                  >
                                    <svg className={`w-3.5 h-3.5 ${r.isLiked ? "fill-current" : "stroke-current fill-none"}`} viewBox="0 0 24 24" strokeWidth="2">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                    </svg>
                                    <span>{r.likes || 0}</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {isSignedIn ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setNewRating(star)}
                              className={`text-lg ${star <= newRating ? "text-amber-500" : "text-gray-300"}`}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                        <textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="写下你的想法..."
                          className="w-full rounded border border-[var(--paper-dark)] p-2 text-xs focus:outline-none focus:border-[var(--accent)]"
                          rows={2}
                        />
                        <button
                          type="button"
                          onClick={handleSubmitReview}
                          disabled={submittingReview || !newRating}
                          className="rounded bg-[var(--accent)] py-1.5 text-xs text-white disabled:opacity-50"
                        >
                          {submittingReview ? "提交中..." : "发布评论"}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4 text-center">
                        <button
                          onClick={() => router.push("/sign-in")}
                          className="text-sm text-[var(--accent)] hover:underline"
                        >
                          登录后发表评论
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedAlbum(null)}
              className="absolute top-2 right-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-black/50 p-1.5 text-white backdrop-blur-sm hover:bg-black/70"
              aria-label="关闭"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
