"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import LyricsModal from "@/components/LyricsModal";

const tabs = [
  { href: "/albums", label: "歌" },
  { href: "/lyrics-wall", label: "诗的歌" },
];

const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function TabNav() {
  const pathname = usePathname();
  const [showLyricsModal, setShowLyricsModal] = useState(false);

  return (
    <>
      <div className="flex items-center gap-3">
        {hasClerk && (
          <>
            <SignedIn>
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "h-8 w-8 sm:h-9 sm:w-9",
                  },
                }}
              />
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="min-h-[36px] rounded-full border border-[var(--paper-dark)] px-4 py-1.5 text-sm font-medium text-[var(--ink-muted)] hover:bg-[var(--paper-dark)]/30 hover:text-[var(--ink)]"
                >
                  登录
                </button>
              </SignInButton>
            </SignedOut>
          </>
        )}
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
