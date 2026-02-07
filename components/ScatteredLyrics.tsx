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
};

/** 网格排布，整齐不倾斜 */
const COLS = 5;
const COL_GAP_PCT = 5;

function generateLayout(count: number): FragmentStyle[] {
  const rand = seededRandom(42);
  const styles: FragmentStyle[] = [];
  const padding = 5;
  const usableW = 100 - padding * 2;
  const usableH = 100 - padding * 2;
  const numRows = Math.ceil(count / COLS) || 1;
  const rowStep = usableH / numRows;
  const colWidth = (usableW - (COLS - 1) * COL_GAP_PCT) / COLS;
  let row = 0;
  let col = 0;
  for (let i = 0; i < count; i++) {
    const cellCenterX = padding + col * (colWidth + COL_GAP_PCT) + colWidth / 2;
    const cellCenterY = padding + row * rowStep + rowStep / 2;
    const jitterX = (rand() - 0.5) * (colWidth * 0.15);
    const jitterY = (rand() - 0.5) * (rowStep * 0.2);
    styles.push({
      top: `${cellCenterY + jitterY}%`,
      left: `${cellCenterX + jitterX}%`,
      fontSize: `${0.9 + rand() * 0.25}rem`,
      baseOpacity: 0.35 + rand() * 0.45,
    });
    col += 1;
    if (col >= COLS) {
      col = 0;
      row += 1;
    }
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
            initial={{ transform: `translate(-50%, -50%) scale(1)` }}
            animate={{
              transform: `translate(-50%, -50%) scale(${isHighlighted ? 1.12 : 1})`,
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
