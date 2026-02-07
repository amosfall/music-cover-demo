"use client";

import TabNav from "@/components/TabNav";
import LyricsPanel from "@/components/LyricsPanel";

export default function LyricsPage() {
  return (
    <LyricsPanel headerLeft={<TabNav />} />
  );
}
