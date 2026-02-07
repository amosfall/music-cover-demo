"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion } from "framer-motion";

export type LyricFragment = {
  text: string;
  sourceId: string; // WallItem.id，用于按歌分组
  albumKey: string; // 专辑维度合并：albumName||imageUrl
  albumName: string;
  artistName: string | null;
  songName: string | null; // 歌曲名，居中块按歌排版用
};

type Props = {
  fragments: LyricFragment[];
  highlightId: string | null; // 当前高亮的专辑 albumKey，选中时展示该专辑下多首歌
  /** 居中界面内显示哪首歌：null = 全部，否则只显示该 sourceId 的歌词 */
  centerSongId?: string | null;
  /** 切换「全部 / 单曲」时调用 */
  onCenterSongChange?: (sourceId: string | null) => void;
  /** 点击某行散落歌词时选中对应专辑，唤起居中展示 */
  onFragmentClick?: (albumKey: string) => void;
  /** 居中界面显示时，点击界面外（遮罩）时调用，用于退出居中 */
  onRequestClose?: () => void;
  /** 双击某行歌词时编辑，保存后调用 */
  onEditLyric?: (sourceId: string, oldText: string, newText: string) => void | Promise<void>;
};

/**
 * 伪随机数生成器（seed-based），保证同一 seed 同一序列，
 * 避免 SSR/CSR hydration 不一致。
 */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

type FragmentStyle = {
  top: string;
  left: string;
  fontSize: string;
  baseOpacity: number;
};

const COL_GAP_PCT = 5;

/** 网格排布，整齐不倾斜；小屏用 fewer 列、略大字号；整体向上偏移保持视觉居中 */
const VERTICAL_OFFSET_PCT = 4; // 整体上移 4%，补偿底部专辑栏视觉重心

function generateLayout(
  count: number,
  cols: number,
  minFontRem: number = 0.9
): FragmentStyle[] {
  const rand = seededRandom(42);
  const styles: FragmentStyle[] = [];
  const paddingTop = 3;
  const paddingBottom = 7;
  const padding = 5;
  const usableW = 100 - padding * 2;
  const usableH = 100 - paddingTop - paddingBottom;
  const numRows = Math.ceil(count / cols) || 1;
  const rowStep = usableH / numRows;
  const colWidth = (usableW - (cols - 1) * COL_GAP_PCT) / cols;
  let row = 0;
  let col = 0;
  for (let i = 0; i < count; i++) {
    const cellCenterX = padding + col * (colWidth + COL_GAP_PCT) + colWidth / 2;
    const cellCenterY = paddingTop + row * rowStep + rowStep / 2 - VERTICAL_OFFSET_PCT;
    const jitterX = (rand() - 0.5) * (colWidth * 0.15);
    const jitterY = (rand() - 0.5) * (rowStep * 0.2);
    styles.push({
      top: `${cellCenterY + jitterY}%`,
      left: `${cellCenterX + jitterX}%`,
      fontSize: `${minFontRem + rand() * 0.25}rem`,
      baseOpacity: 0.35 + rand() * 0.45,
    });
    col += 1;
    if (col >= cols) {
      col = 0;
      row += 1;
    }
  }
  return styles;
}

/** 可双击编辑的歌词行 */
function EditableLyricLine({
  text,
  sourceId,
  onEdit,
  onBeforeEdit,
  className,
  style,
}: {
  text: string;
  sourceId: string;
  onEdit?: (sourceId: string, oldText: string, newText: string) => void | Promise<void>;
  /** 进入编辑前调用，用于取消父级单击选择等 */
  onBeforeEdit?: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(text);
  const editRef = useRef<HTMLSpanElement | null>(null);

  const commitEdit = useCallback(() => {
    const raw = editRef.current?.innerText ?? value;
    const trimmed = raw.trim();
    if (trimmed && trimmed !== text && onEdit) {
      onEdit(sourceId, text, trimmed);
    }
    setEditing(false);
    setValue(text);
  }, [value, text, sourceId, onEdit]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setValue(text);
  }, [text]);

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.innerText = value;
      requestAnimationFrame(() => {
        editRef.current?.focus();
        const sel = window.getSelection();
        if (sel) {
          sel.selectAllChildren(editRef.current!);
          sel.collapseToEnd();
        }
      });
    }
  }, [editing]);

  if (editing) {
    return (
      <span
        ref={(r) => { editRef.current = r; }}
        contentEditable
        suppressContentEditableWarning
        className={`${className ?? ""} editable-lyric-line`}
        style={{
          ...style,
          outline: "none",
          border: "none",
          background: "transparent",
        }}
        onBlur={commitEdit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitEdit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            cancelEdit();
          }
        }}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      className={className}
      style={style}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onEdit) {
          onBeforeEdit?.();
          setValue(text);
          setEditing(true);
        }
      }}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && onEdit) {
          e.preventDefault();
          setValue(text);
          setEditing(true);
        }
      }}
      title={onEdit ? "双击编辑" : undefined}
    >
      {text}
    </span>
  );
}

const CLICK_DELAY_MS = 280; // 延迟单击，双击时取消选择

export default function ScatteredLyrics({ fragments, highlightId, centerSongId = null, onCenterSongChange, onFragmentClick, onRequestClose, onEditLyric }: Props) {
  const [cols, setCols] = useState(5);
  const [minFontRem, setMinFontRem] = useState(0.9);
  const pendingSelectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingSelect = useCallback(() => {
    if (pendingSelectRef.current) {
      clearTimeout(pendingSelectRef.current);
      pendingSelectRef.current = null;
    }
  }, []);

  const highlightedFragments = useMemo(
    () => (highlightId ? fragments.filter((f) => f.albumKey === highlightId) : []),
    [fragments, highlightId]
  );
  const dimmedFragments = useMemo(
    () => (highlightId ? fragments.filter((f) => f.albumKey !== highlightId) : fragments),
    [fragments, highlightId]
  );

  useEffect(
    () => () => {
      if (pendingSelectRef.current) clearTimeout(pendingSelectRef.current);
    },
    []
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => {
      if (mq.matches) {
        setCols(3);
        setMinFontRem(1);
      } else {
        setCols(5);
        setMinFontRem(0.9);
      }
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const layout = useMemo(
    () => generateLayout(dimmedFragments.length, cols, minFontRem),
    [dimmedFragments.length, cols, minFontRem]
  );

  const hasCenterBlock = highlightId != null && highlightedFragments.length > 0;

  const multiSong = useMemo(() => {
    if (highlightedFragments.length === 0) return false;
    const ids = new Set(highlightedFragments.map((f) => f.sourceId));
    return ids.size > 1;
  }, [highlightedFragments]);

  /** 当前是否在展示多首歌（多块内容）：仅此时顶部对齐；只展示一首时与其他居中界面一致、垂直居中 */
  const displayingMultiple = multiSong && centerSongId == null;

  return (
    <div className="lyrics-wall-container">
      {/* 底层：未选中的散落歌词（有选中时弱化，无选中时全部） */}
      {dimmedFragments.map((frag, i) => {
        const s = layout[i];
        if (!s) return null;
        const opacity = highlightId ? 0.08 : s.baseOpacity;
        const clickable = Boolean(onFragmentClick);
        return (
          <motion.div
            key={`dimmed-${frag.sourceId}-${i}`}
            className={`scattered-fragment ${clickable ? "scattered-fragment-clickable" : ""}`}
            style={{
              position: "absolute",
              top: s.top,
              left: s.left,
              fontSize: s.fontSize,
              opacity,
              willChange: "transform",
              textAlign: "center",
            }}
            initial={{ transform: `translate(-50%, -50%) scale(1)` }}
            animate={{ transform: `translate(-50%, -50%) scale(1)` }}
            transition={{
              transform: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
            }}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={
              clickable
                ? (e) => {
                    e.stopPropagation();
                    clearPendingSelect();
                    pendingSelectRef.current = setTimeout(() => {
                      pendingSelectRef.current = null;
                      onFragmentClick?.(frag.albumKey);
                    }, CLICK_DELAY_MS);
                  }
                : undefined
            }
            onDoubleClick={(e) => e.stopPropagation()}
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      onFragmentClick?.(frag.albumKey);
                    }
                  }
                : undefined
            }
          >
            <EditableLyricLine
              text={frag.text}
              sourceId={frag.sourceId}
              onEdit={onEditLyric}
              onBeforeEdit={clearPendingSelect}
              style={{ display: "inline" }}
            />
          </motion.div>
        );
      })}

      {/* 上层：选中时居中按「专辑内多首歌」分组排版；点击遮罩退出，点击内容不退出 */}
      {hasCenterBlock && (
        <motion.div
          className={`absolute inset-0 flex ${displayingMultiple ? "items-start justify-center" : "items-center justify-center"}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* 遮罩：点击界面外优先退出居中 */}
          {onRequestClose && (
            <div
              className="absolute inset-0"
              aria-hidden
              onClick={(e) => {
                e.stopPropagation();
                onRequestClose();
              }}
            />
          )}
          <div
            className={`lyrics-wall-center-block relative z-10 max-h-[70%] max-w-[85%] overflow-y-auto overflow-x-hidden px-4 py-6 ${displayingMultiple ? "lyrics-wall-center-block-multi" : ""}`}
            style={{ fontFamily: 'Georgia, "Noto Serif SC", "Source Han Serif SC", serif' }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const bySong = new Map<string, LyricFragment[]>();
              for (const f of highlightedFragments) {
                const list = bySong.get(f.sourceId) ?? [];
                list.push(f);
                bySong.set(f.sourceId, list);
              }
              const allSongGroups = Array.from(bySong.entries());
              const effectiveSongId = centerSongId ?? allSongGroups[0]?.[0] ?? null;
              const filteredFragments =
                effectiveSongId != null
                  ? highlightedFragments.filter((f) => f.sourceId === effectiveSongId)
                  : highlightedFragments;
              const bySongFiltered = new Map<string, LyricFragment[]>();
              for (const f of filteredFragments) {
                const list = bySongFiltered.get(f.sourceId) ?? [];
                list.push(f);
                bySongFiltered.set(f.sourceId, list);
              }
              const songGroups = Array.from(bySongFiltered.entries());
              return (
                <>
                  <div className={multiSong || songGroups.length > 1 ? "text-left" : "text-center"}>
                  {songGroups.map(([sourceId, lines]) => {
                    const songName = lines[0]?.songName?.trim();
                    const isMulti = songGroups.length > 1;
                    return (
                    <div
                      key={sourceId}
                      className={isMulti ? "mb-8 pt-6 first:pt-0 first:mt-0 border-t border-[var(--paper-dark)] first:border-t-0" : "mb-6 last:mb-0"}
                    >
                      {isMulti && songName && (
                        <div className="mb-3 text-sm font-medium text-[var(--ink-muted)]">
                          {songName}
                        </div>
                      )}
                      {lines.map((frag, i) => (
                        <div
                          key={`${frag.sourceId}-${i}`}
                          className="scattered-fragment scattered-fragment-editable text-[var(--ink)] text-xl sm:text-2xl leading-loose cursor-text"
                          style={{
                            whiteSpace: "normal",
                            maxWidth: "none",
                            opacity: 1,
                            mixBlendMode: "multiply",
                          }}
                        >
                          <EditableLyricLine
                            text={frag.text}
                            sourceId={frag.sourceId}
                            onEdit={onEditLyric}
                            className="inline-block min-w-[1em] rounded hover:bg-black/5"
                          />
                        </div>
                      ))}
                    </div>
                    );
                  })}
                  {highlightedFragments.length > 0 && (() => {
                    const first = highlightedFragments[0];
                    const artistName = first.artistName?.trim();
                    const albumName = first.albumName?.trim();
                    const currentSongName = songGroups.length === 1 ? songGroups[0][1][0]?.songName?.trim() : null;
                    if (!artistName && !albumName && !currentSongName) return null;
                    return (
                      <div className="lyrics-wall-center-credit mt-4 text-base text-[var(--ink-muted)] space-y-1">
                        <div>
                          {[artistName, albumName].filter(Boolean).join(" - ")}
                        </div>
                        {currentSongName && <div>{currentSongName}</div>}
                      </div>
                    );
                  })()}
                  </div>
                </>
              );
            })()}
          </div>
        </motion.div>
      )}
    </div>
  );
}
