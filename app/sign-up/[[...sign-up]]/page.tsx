"use client";

import Link from "next/link";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="relative flex min-h-[60vh] items-center justify-center px-4 py-12">
      <Link
        href="/"
        className="fixed right-4 top-4 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[var(--ink-muted)] hover:bg-black/5 hover:text-[var(--ink)]"
        style={{ top: "max(1rem, env(safe-area-inset-top))" }}
        aria-label="关闭"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </Link>
      <SignUp afterSignUpUrl="/lyrics-wall" />
    </div>
  );
}
