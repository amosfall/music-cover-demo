"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "封面墙" },
  { href: "/lyrics", label: "歌词墙" },
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
