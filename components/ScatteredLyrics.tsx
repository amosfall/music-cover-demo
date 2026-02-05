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

function generateLayout(count: number): FragmentStyle[] {
  const rand = seededRandom(42);
  const styles: FragmentStyle[] = [];

  for (let i = 0; i < count; i++) {
    styles.push({
      top: `${4 + rand() * 72}%`, // 4% ~ 76%，避开底部 dock
      left: `${2 + rand() * 88}%`, // 2% ~ 90%
      fontSize: `${0.85 + rand() * 0.95}rem`, // 0.85rem ~ 1.8rem
      baseOpacity: 0.3 + rand() * 0.55, // 0.3 ~ 0.85
      amplitude: (rand() > 0.5 ? 1 : -1) * (3 + rand() * 6), // +/- 3~9px
      duration: 4 + rand() * 5, // 4~9s
      delay: rand() * 3, // 0~3s
      rotate: (rand() - 0.5) * 6, // -3° ~ 3°
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
              transform: `rotate(${s.rotate}deg)`,
              willChange: "transform",
              maxWidth: "45vw",
            }}
            animate={{
              scale: isHighlighted ? 1.15 : 1,
            }}
            transition={{
              scale: {
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
