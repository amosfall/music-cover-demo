"use client";

import { useRef, useEffect, useState } from "react";
import PolaroidPoster from "./PolaroidPoster";

type Props = { ratio: "1:1" | "4:3" };

const POSTER_W = 1080;
const POSTER_H_1_1 = 1080;
const POSTER_H_4_3 = 810;

export default function PolaroidPreview({ ratio }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const updateScale = () => {
      const parent = el.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      const posterW = POSTER_W;
      const posterH = ratio === "1:1" ? POSTER_H_1_1 : POSTER_H_4_3;
      const s = Math.min(1, w / posterW, h / posterH);
      setScale(Math.max(0.2, s));
    };

    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(el.parentElement!);
    return () => ro.disconnect();
  }, [ratio]);

  const posterH = ratio === "1:1" ? POSTER_H_1_1 : POSTER_H_4_3;

  return (
    <div
      ref={wrapperRef}
      className="flex min-h-0 flex-1 items-start justify-center overflow-hidden"
      style={{ alignSelf: "stretch" }}
    >
      <div
        style={{
          width: POSTER_W,
          height: posterH,
          transform: `scale(${scale})`,
          transformOrigin: "top center",
          flexShrink: 0,
        }}
      >
        <PolaroidPoster ratio={ratio} />
      </div>
    </div>
  );
}
