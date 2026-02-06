import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "音乐浮墙 | 封面墙 & 歌词墙",
  description: "收藏专辑封面，记录打动你的歌词",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased journal-page paper-texture min-h-screen flex flex-col`}
      >
        <div className="flex-1">{children}</div>
        <footer className="py-6 text-center text-xs italic text-[var(--ink-muted)] opacity-50">
          Created by Aki
        </footer>
      </body>
    </html>
  );
}
