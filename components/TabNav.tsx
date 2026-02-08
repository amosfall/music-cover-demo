"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LyricsModal from "@/components/LyricsModal";

const tabs = [
  { href: "/albums", label: "歌" },
  { href: "/lyrics-wall", label: "诗的歌" },
];

export default function TabNav() {
  const pathname = usePathname();
  const [showLyricsModal, setShowLyricsModal] = useState(false);

  return (
    <>
      <div className="flex items-center gap-3">
        <nav className="tab-nav">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={pathname === tab.href ? "active" : ""}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        {pathname === "/lyrics-wall" && (
          <button
            type="button"
            onClick={() => setShowLyricsModal(true)}
            className={`tab-nav-lyrics ${showLyricsModal ? "active" : ""}`}
          >
            词
          </button>
        )}
      </div>
      {showLyricsModal && (
        <LyricsModal onClose={() => setShowLyricsModal(false)} />
      )}
    </>
  );
}
