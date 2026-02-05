"use client";

import { useMemo } from "react";

type Props = {
  lyrics: string;
  /** 每个卡片用唯一 id 防止 SVG path id 冲突 */
  cardId: string;
};

const SVG_WIDTH = 500;
const LINE_HEIGHT = 42;
const CURVE_AMOUNT = 20;
const FONT_SIZE = 17;
const PADDING_TOP = 30;

const TEXT_STYLE: React.CSSProperties = {
  fontFamily: 'Georgia, "Noto Serif SC", "Source Han Serif SC", serif',
  fontStyle: "italic",
};

export default function CurvedLyrics({ lyrics, cardId }: Props) {
  const lines = useMemo(() => {
    const raw = lyrics.split(/\n/).filter((l) => l.trim());
    return raw.length > 0 ? raw : [lyrics];
  }, [lyrics]);

  const svgHeight = PADDING_TOP + lines.length * LINE_HEIGHT + 12;

  return (
    <svg
      viewBox={`0 0 ${SVG_WIDTH} ${svgHeight}`}
      width="100%"
      height="auto"
      style={{ display: "block", overflow: "visible" }}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={lyrics}
    >
      <defs>
        {lines.map((_, i) => {
          const y = PADDING_TOP + i * LINE_HEIGHT;
          const curve = i % 2 === 0 ? -CURVE_AMOUNT : CURVE_AMOUNT;
          return (
            <path
              key={`path-${cardId}-${i}`}
              id={`curve-${cardId}-${i}`}
              d={`M 10 ${y} Q ${SVG_WIDTH / 2} ${y + curve} ${SVG_WIDTH - 10} ${y}`}
              fill="none"
            />
          );
        })}
      </defs>
      {lines.map((line, i) => (
        <text
          key={`text-${cardId}-${i}`}
          fill="#2c2c2c"
          fontSize={FONT_SIZE}
          textAnchor="middle"
          style={TEXT_STYLE}
        >
          <textPath
            href={`#curve-${cardId}-${i}`}
            startOffset="50%"
          >
            {line}
          </textPath>
        </text>
      ))}
    </svg>
  );
}
