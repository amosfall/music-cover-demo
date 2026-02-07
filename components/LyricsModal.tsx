"use client";

import { createPortal } from "react-dom";
import LyricsPanel from "@/components/LyricsPanel";

type Props = {
  onClose: () => void;
};

export default function LyricsModal({ onClose }: Props) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex flex-col bg-[var(--paper)]"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <LyricsPanel
          headerLeft={
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[var(--ink-muted)] hover:bg-[var(--paper-dark)] hover:text-[var(--ink)]"
              aria-label="关闭"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          }
        />
      </div>
    </div>,
    document.body
  );
}
