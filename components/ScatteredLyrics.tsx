"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

export type LyricFragment = {
  text: string;
  sourceId: string; // WallItem.id，用于高亮匹配
  albumName: string;
  artistName: string | null;
};

type Props = {
  fragments: LyricFragment[];
  highlightId: string | null; // 当前高亮的 sourceId
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
  amplitude: number;
  duration: number;
  delay: number;
  rotate: number;
};

const COLS = 2;

function generateLayout(count: number): FragmentStyle[] {
  const rand = seededRandom(42);
  const rows = Math.max(12, Math.ceil(count / COLS));
  const slots: { col: number; row: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < COLS; c++) slots.push({ col: c, row: r });
  }
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  const cellW = 100 / COLS;
  const cellH = 68 / rows;
  const styles: FragmentStyle[] = [];
  for (let i = 0; i < count; i++) {
    const slot = slots[i];
    if (!slot) continue;
    const baseLeft = (slot.col + 0.5) * cellW;
    const baseTop = 8 + (slot.row + 0.5) * cellH;
    const jitterX = (rand() - 0.5) * cellW * 0.4;
    const jitterY = (rand() - 0.5) * cellH * 0.5;
    styles.push({
      top: `${Math.max(5, Math.min(80, baseTop + jitterY))}%`,
      left: `${Math.max(8, Math.min(92, baseLeft + jitterX))}%`,
      fontSize: `${0.8 + rand() * 1.1}rem`,
      baseOpacity: 0.25 + rand() * 0.6,
      amplitude: (rand() > 0.5 ? 1 : -1) * (4 + rand() * 8),
      duration: 3 + rand() * 6,
      delay: rand() * 4,
      rotate: (rand() - 0.5) * 12,
    });
  }
  return styles;
}

export default function ScatteredLyrics({ fragments, highlightId }: Props) {
  const layout = useMemo(
    () => generateLayout(fragments.length),
    [fragments.length]
  );

  return (
    <div className="lyrics-wall-container">
      {fragments.map((frag, i) => {
        const s = layout[i];
        if (!s) return null;

        const isHighlighted = highlightId
          ? frag.sourceId === highlightId
          : false;
        const isDimmed = highlightId ? !isHighlighted : false;

        return (
          <motion.div
            key={`${frag.sourceId}-${i}`}
            className="scattered-fragment"
            style={{
              position: "absolute",
              top: s.top,
              left: s.left,
              fontSize: s.fontSize,
              opacity: isDimmed ? 0.08 : isHighlighted ? 1 : s.baseOpacity,
              willChange: "transform",
              textAlign: "center",
            }}
            initial={{ transform: `translateX(-50%) rotate(${s.rotate}deg) scale(1)` }}
            animate={{
              transform: `translateX(-50%) rotate(${s.rotate}deg) scale(${isHighlighted ? 1.15 : 1})`,
            }}
            transition={{
              transform: {
                duration: 0.5,
                ease: [0.22, 1, 0.36, 1],
              },
            }}
          >
            {frag.text}
          </motion.div>
        );
      })}
    </div>
  );
}
