"use client";

import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { getProxyImageUrl } from "@/lib/proxy-image";

export type StripItem = {
  id: string;
  imageUrl: string;
  albumName: string;
  artistName: string | null;
};

type Props = {
  items: StripItem[];
  activeId: string | null;
  onSelect: (item: StripItem) => void;
  /** 传入时显示删除按钮 */
  onDelete?: (item: StripItem) => void;
};

export default function AlbumStrip({ items, activeId, onSelect, onDelete }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 选中项自动滚动到可视区
  useEffect(() => {
    if (!activeId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(
      `[data-strip-id="${activeId}"]`
    ) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [activeId]);

  if (items.length === 0) return null;

  return (
    <div className="album-strip">
      <div
        ref={scrollRef}
        className="flex items-center gap-3 overflow-x-auto px-6 py-3 sm:gap-4 sm:px-8"
      >
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <div key={item.id} className="group relative shrink-0">
              <motion.button
                data-strip-id={item.id}
                onClick={() => onSelect(item)}
                className={`relative overflow-hidden rounded-xl transition-shadow focus:outline-none ${
                  isActive
                    ? "ring-2 ring-gray-800/40 shadow-lg"
                    : "ring-1 ring-black/5 shadow-md hover:shadow-lg"
                }`}
                animate={{ scale: isActive ? 1.12 : 1 }}
                whileHover={{ scale: isActive ? 1.12 : 1.06 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
              >
                <div className="relative h-16 w-16 sm:h-20 sm:w-20">
                  <img
                    src={getProxyImageUrl(item.imageUrl)}
                    alt={item.albumName}
                    className="absolute inset-0 h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                {/* 选中指示点 */}
                {isActive && (
                  <motion.div
                    className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-gray-700"
                    layoutId="strip-dot"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
              </motion.button>

              {/* 删除按钮 - 右上角半透明 */}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item);
                  }}
                  className="absolute -top-1.5 -right-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/40 text-[10px] leading-none text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/60 group-hover:opacity-100"
                  aria-label={`删除 ${item.albumName}`}
                >
                  &times;
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
