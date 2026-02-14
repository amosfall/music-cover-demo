import type { Metadata } from "next";
import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";
import {
  ClerkProvider, // 👈 1. 引入这个
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import { Geist, Geist_Mono, Noto_Serif_SC } from "next/font/google";
import "./globals.css";

const DEBUG_LOG_DIR = join(process.cwd(), ".cursor");
const DEBUG_LOG_PATH = join(DEBUG_LOG_DIR, "debug.log");

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSerifSC = Noto_Serif_SC({
  variable: "--font-noto-serif-sc",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "poeticsongs",
  description: "收藏专辑封面，记录打动你的歌词",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

const publishableKey =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ||
  "pk_test_placeholder";

// #region agent log
function _logLayout() {
  try {
    mkdirSync(DEBUG_LOG_DIR, { recursive: true });
    const line = JSON.stringify({ location: "layout.tsx:RootLayout", message: "root layout render", data: { keyIsPlaceholder: publishableKey === "pk_test_placeholder", hypothesisId: "C" }, timestamp: Date.now() }) + "\n";
    appendFileSync(DEBUG_LOG_PATH, line);
  } catch {}
}
// #endregion

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // #region agent log
  _logLayout();
  // #endregion
  return (
    // 👇 2. 用 ClerkProvider 包裹住整个 html 或 body
    <ClerkProvider publishableKey={publishableKey}>
      <html lang="zh-CN">
        <head>
          <meta name="referrer" content="no-referrer" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@200;300;400;600;700&display=swap"
            rel="stylesheet"
          />
        </head>
        <body
          className={`${geistSans.variable} ${geistMono.variable} ${notoSerifSC.variable} antialiased journal-page paper-texture min-h-screen flex flex-col safe-area-padding`}
        >
          <header className="flex justify-end items-center shrink-0 gap-3 px-4 py-2 min-h-[2.5rem]">
            <SignedOut>
              <SignInButton mode="redirect">
                <button
                  type="button"
                  className="rounded-md border border-[var(--paper-dark)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--ink)] hover:bg-[var(--paper-dark)]/30"
                >
                  登录
                </button>
              </SignInButton>
              <SignUpButton mode="redirect">
                <button
                  type="button"
                  className="rounded-md border border-[var(--paper-dark)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--ink)] hover:bg-[var(--paper-dark)]/30"
                >
                  注册
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: { avatarBox: "h-8 w-8 sm:h-9 sm:w-9" },
                }}
              />
            </SignedIn>
          </header>
          <div className="flex-1 min-h-0">{children}</div>
          <footer className="py-6 text-center text-xs italic text-[var(--ink-muted)] opacity-50 safe-area-bottom">
            Created by Aki
          </footer>
        </body>
      </html>
    </ClerkProvider>
  );
}
