"use client";

import { useEffect } from "react";
import WelcomeScreen from "@/components/WelcomeScreen";

export default function WelcomePage() {
  // #region agent log
  useEffect(() => {
    fetch("/api/debug-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "app/page.tsx:WelcomePage",
        message: "client WelcomePage mounted",
        data: { hypothesisId: "D" },
      }),
    }).catch(() => {});
  }, []);
  // #endregion
  return <WelcomeScreen enterHref="/albums" />;
}
