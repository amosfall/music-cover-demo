"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "歌" },
  { href: "/lyrics", label: "词" },
  { href: "/lyrics-wall", label: "诗的歌" },
];

export default function TabNav() {
  const pathname = usePathname();

  return (
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
  );
}
