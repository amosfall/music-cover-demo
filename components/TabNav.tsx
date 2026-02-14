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
        
        {/* 在评论页面（Top Albums）增加引导按钮 */}
        {isActive("/albums") && (
          <Link
            href="/albums?view=personal"
            className="ml-auto hidden sm:inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-medium text-white transition-transform hover:scale-105 active:scale-95 shadow-sm"
          >
            <span>✨ 快来添加专辑吧！</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        )}
        
        {/* 移动端版本，只显示加号图标以节省空间 */}
        {isActive("/albums") && (
          <Link
            href="/albums?view=personal"
            className="ml-auto sm:hidden inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--accent)] text-white shadow-sm"
            aria-label="添加专辑"
          >
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </Link>
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
