"use client";

import { motion, AnimatePresence } from "framer-motion";

type Props = {
  lyrics: string;
  artistName: string | null;
  albumName: string;
  /** 用于触发 AnimatePresence 切换动画 */
  itemKey: string;
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.13 },
  },
  exit: {
    transition: { staggerChildren: 0.06, staggerDirection: -1 },
  },
};

const lineEnter = {
  hidden: { opacity: 0, y: 28, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  },
  exit: {
    opacity: 0,
    y: -18,
    filter: "blur(6px)",
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  },
};


export default function FloatingLyrics({
  lyrics,
  artistName,
  albumName,
  itemKey,
}: Props) {
  const lines = lyrics
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={itemKey}
        className="flex flex-col items-center gap-3 px-6 sm:gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 5, ease: "easeOut" }}
      >
        <motion.div
          className="flex flex-col items-center gap-3 sm:gap-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {lines.map((line, i) => (
            <motion.div key={`${itemKey}-line-${i}`} variants={lineEnter}>
              <p className="floating-line">{line}</p>
            </motion.div>
          ))}

          {/* 歌手 · 专辑 */}
          <motion.p
            className="mt-10 text-sm tracking-widest text-gray-400/80 sm:mt-12 sm:text-base"
            variants={lineEnter}
          >
            {[artistName, albumName].filter(Boolean).join("  ·  ")}
          </motion.p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
