"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TabNav from "@/components/TabNav";

type Batch = { id: string; fullText: string };

/** 按逗号、句号、问号拆成短句 */
function parseSegments(str: string): string[] {
  if (!str.trim()) return [];
  return str
    .split(/[，。？；,.;;!！、?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const FONT_STYLE: React.CSSProperties = {
  fontFamily: 'Georgia, "Noto Serif SC", "Source Han Serif SC", serif',
};

const MOOD_BOARD_STORAGE_KEY = "mood-board-data";

function loadMoodBoardData(): Batch[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MOOD_BOARD_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.batches)) return null;
    return parsed.batches.filter(
      (b: unknown) => b && typeof b === "object" && "id" in b && "fullText" in b && typeof (b as Batch).fullText === "string"
    );
  } catch { return null; }
}

function saveMoodBoardData(batches: Batch[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MOOD_BOARD_STORAGE_KEY, JSON.stringify({ batches }));
  } catch {}
}

export default function MoodBoardPage() {
  const [text, setText] = useState("");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [showInput, setShowInput] = useState(true);
  const [selectedFullText, setSelectedFullText] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadMoodBoardData();
    if (saved && saved.length > 0) {
      setBatches(saved);
      setShowInput(false);
    }
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    saveMoodBoardData(batches);
  }, [hasHydrated, batches]);

  const hasContent = text.trim().length > 0;

  const handleAdd = () => {
    if (!hasContent) return;
    const paragraphs = text.split(/\n/).map((p) => p.trim()).filter(Boolean);
    if (paragraphs.length === 0) return;
    const newBatches = paragraphs.map((fullText) => ({
      id: crypto.randomUUID(),
      fullText,
    }));
    setBatches((prev) => [...prev, ...newBatches]);
    setText("");
    setShowInput(false);
  };

  const currentIndex = selectedFullText != null
    ? batches.findIndex((b) => b.fullText === selectedFullText)
    : -1;

  useEffect(() => {
    if (selectedFullText == null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedFullText(null);
        return;
      }
      if (e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        const next = currentIndex >= 0 && currentIndex < batches.length - 1 ? batches[currentIndex + 1] : null;
        if (next) setSelectedFullText(next.fullText);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prev = currentIndex > 0 ? batches[currentIndex - 1] : null;
        if (prev) setSelectedFullText(prev.fullText);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedFullText, currentIndex, batches]);

  return (
    <div className="mood-board-page flex min-h-screen flex-col bg-[#fafafa]">
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2 sm:px-10 sm:pt-7">
        <TabNav />
      </header>

      <main className="relative flex flex-1 flex-col items-center px-4 py-6 sm:py-8">
        <AnimatePresence mode="wait">
          {showInput ? (
            <motion.div
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-2xl"
            >
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="输入文字，换行即分段…"
                className="min-h-[200px] w-full resize-y rounded-xl border border-[var(--paper-dark)] bg-white px-4 py-3 text-[1.1rem] leading-relaxed text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                style={FONT_STYLE}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
              />
              <div className="mt-4 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!hasContent}
                  className="rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-white shadow-sm opacity-90 hover:opacity-100 disabled:opacity-50"
                >
                  添加
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="article"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`w-full max-w-2xl flex-1 overflow-y-auto transition-opacity ${selectedFullText != null ? "opacity-40" : ""}`}
            >
              <article
                className="space-y-6 text-[var(--ink)] leading-relaxed"
                style={FONT_STYLE}
              >
                {batches.map((b) => {
                  const segments = parseSegments(b.fullText);
                  const hasSegments = segments.length > 0;
                  return (
                    <p key={b.id} className="whitespace-pre-wrap">
                      {hasSegments
                        ? segments.map((seg, i) => (
                            <span key={`${b.id}-${i}`}>
                              <span
                                role="button"
                                tabIndex={0}
                                className="cursor-pointer no-underline"
                                onClick={() => setSelectedFullText(b.fullText)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setSelectedFullText(b.fullText);
                                  }
                                }}
                              >
                                {seg}
                              </span>
                              {i < segments.length - 1 ? "，" : ""}
                            </span>
                          ))
                        : b.fullText}
                    </p>
                  );
                })}
              </article>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedFullText != null && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div
                className="absolute inset-0 bg-[var(--ink)]/55"
                aria-hidden
                onClick={() => setSelectedFullText(null)}
              />
              <div
                className="relative z-10 max-w-[85%] max-h-[70%] overflow-y-auto overflow-x-hidden rounded-xl bg-white/80 px-6 py-8 text-base text-[var(--ink)] shadow-lg sm:text-lg leading-relaxed whitespace-pre-wrap backdrop-blur-md"
                style={FONT_STYLE}
                onClick={(e) => e.stopPropagation()}
              >
                {selectedFullText}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
