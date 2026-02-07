"use client";

import { useState, useRef } from "react";
import { getProxyImageUrl } from "@/lib/proxy-image";

type Props = {
  onClose: () => void;
  onSuccess: () => void;
};

export default function AlbumUploadModal({ onClose, onSuccess }: Props) {
  const [step, setStep] = useState<"upload" | "details">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [albumName, setAlbumName] = useState("");
  const [artistName, setArtistName] = useState("");
  const [releaseYear, setReleaseYear] = useState("");
  const [genre, setGenre] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f?.type.startsWith("image/")) {
      setError("请选择图片文件");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "上传失败");

      setImageUrl(data.imageUrl);
      setStep("details");
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!imageUrl || !albumName.trim()) {
      setError("请输入专辑名");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl,
          albumName: albumName.trim(),
          artistName: artistName.trim() || null,
          releaseYear: releaseYear.trim() || null,
          genre: genre.trim() || null,
        }),
      });

      if (!res.ok) throw new Error("保存失败");
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="scrapbook-card max-h-[90vh] w-full max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl p-6 shadow-xl sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[var(--ink)]">
            {step === "upload" ? "上传封面" : "专辑信息"}
          </h2>
          <button
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center text-2xl leading-none text-[var(--ink-muted)] hover:text-[var(--ink)]"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {step === "upload" ? (
          <>
            <div
              className="mb-4 flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--accent-light)] bg-[var(--paper-dark)]/50 transition-colors hover:border-[var(--accent)] hover:bg-[var(--paper-dark)]"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              {preview ? (
                <img
                  src={preview}
                  alt="预览"
                  className="h-full w-full rounded-lg object-cover"
                />
              ) : (
                <>
                  <span className="text-5xl text-[var(--accent)]">🎵</span>
                  <p className="mt-3 text-sm text-[var(--ink-muted)]">
                    点击选择专辑封面
                  </p>
                  <p className="mt-1 text-xs text-[var(--ink-muted)]">
                    支持 JPG、PNG 等格式
                  </p>
                </>
              )}
            </div>
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className="w-full rounded-xl bg-[var(--accent)] py-3 font-medium text-white transition-opacity hover:bg-[var(--accent-light)] disabled:opacity-50"
            >
              {loading ? "上传中..." : "上传并继续"}
            </button>
          </>
        ) : (
          <>
            {imageUrl && (
              <div className="mb-6 flex justify-center">
                <div className="relative h-28 w-28 overflow-hidden rounded-lg shadow-lg">
                  <img
                    src={getProxyImageUrl(imageUrl)}
                    alt="封面"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--ink)]">
                  专辑名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={albumName}
                  onChange={(e) => setAlbumName(e.target.value)}
                  placeholder="如：Midnights"
                  className="w-full rounded-lg border border-[var(--paper-dark)] bg-white px-3 py-2 text-[var(--ink)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--ink)]">
                  艺术家（可选）
                </label>
                <input
                  type="text"
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  placeholder="如：Taylor Swift"
                  className="w-full rounded-lg border border-[var(--paper-dark)] bg-white px-3 py-2 text-[var(--ink)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--ink)]">
                    发行年份（可选）
                  </label>
                  <input
                    type="text"
                    value={releaseYear}
                    onChange={(e) => setReleaseYear(e.target.value)}
                    placeholder="2024"
                    className="w-full rounded-lg border border-[var(--paper-dark)] bg-white px-3 py-2 text-[var(--ink)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--ink)]">
                    风格（可选）
                  </label>
                  <input
                    type="text"
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    placeholder="Pop, Rock..."
                    className="w-full rounded-lg border border-[var(--paper-dark)] bg-white px-3 py-2 text-[var(--ink)]"
                  />
                </div>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setStep("upload")}
                className="flex-1 rounded-xl border border-[var(--accent)] py-3 font-medium text-[var(--accent)]"
              >
                返回
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !albumName.trim()}
                className="flex-1 rounded-xl bg-[var(--accent)] py-3 font-medium text-white transition-opacity hover:bg-[var(--accent-light)] disabled:opacity-50"
              >
                {loading ? "保存中..." : "保存"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
