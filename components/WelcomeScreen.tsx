"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

type Props = {
  /** 2.5 秒后淡出并自动调用，不传则用 enterHref 做跳转 */
  onEnter?: () => void;
  /** 自动跳转链接，不传且无 onEnter 则跳转到 /albums */
  enterHref?: string;
};

const TOTAL_DURATION_MS = 2000;
const FADEOUT_DURATION_MS = 400;

export default function WelcomeScreen({ onEnter, enterHref = "/albums" }: Props) {
  const router = useRouter();
  const [fadingOut, setFadingOut] = useState(false);

  const doEnter = useCallback(() => {
    if (onEnter) {
      onEnter();
    } else {
      router.push(enterHref);
    }
  }, [onEnter, enterHref, router]);

  useEffect(() => {
    const startFade = setTimeout(() => setFadingOut(true), TOTAL_DURATION_MS - FADEOUT_DURATION_MS);
    const enter = setTimeout(() => doEnter(), TOTAL_DURATION_MS);
    return () => {
      clearTimeout(startFade);
      clearTimeout(enter);
    };
  }, [doEnter]);

  return (
    <motion.div
      className="flex min-h-screen flex-col items-center justify-center bg-[var(--paper)] px-4"
      initial={{ opacity: 1 }}
      animate={{ opacity: fadingOut ? 0 : 1 }}
      transition={{ duration: FADEOUT_DURATION_MS / 1000, ease: "easeOut" }}
    >
      <motion.p
        className="font-song text-center text-2xl font-normal tracking-[0.4em] text-[var(--ink)] sm:text-3xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      >
        「與　你　握　手」
      </motion.p>
      <motion.p
        className="mt-6 text-center text-sm text-[var(--ink-muted)]"
        style={{ fontFamily: "Times New Roman, serif" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }}
      >
        By Aki，2026 春
      </motion.p>
    </motion.div>
  );
}
