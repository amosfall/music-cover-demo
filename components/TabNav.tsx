"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import LyricsModal from "@/components/LyricsModal";

function TabNavContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const [showLyricsModal, setShowLyricsModal] = useState(false);

  // 判断激活状态的辅助函数
  const isActive = (href: string) => {
    if (href === "/albums") {
      // "评论" (公共) 只有在路径是 /albums 且没有 view 参数时激活，或者 view=public
      return pathname === "/albums" && (!view || view === "public");
    }
    if (href === "/albums?view=personal") {
      // "歌" (我的) 在路径是 /albums 且 view=personal 时激活
      return pathname === "/albums" && view === "personal";
    }
    return pathname === href;
  };

  const tabs = [
    { href: "/albums", label: "评论" },
    { href: "/albums?view=personal", label: "歌" },
    { href: "/lyrics-wall", label: "诗的歌" },
    { href: "/mood-board", label: "说明" },
  ];

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <nav className="tab-nav">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={isActive(tab.href) ? "active" : ""}
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

export default function TabNav() {
  return (
    <Suspense fallback={<div className="h-10 w-full animate-pulse bg-gray-100/50 rounded-lg"></div>}>
      <TabNavContent />
    </Suspense>
  );
}
