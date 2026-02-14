"use client";

import TabNav from "@/components/TabNav";

const FONT_STYLE: React.CSSProperties = {
  fontFamily: 'Georgia, "Noto Serif SC", "Source Han Serif SC", serif',
};

/** 说明页固定展示的使用说明，所有用户（登没登录）打开都能看到 */
const FIXED_INSTRUCTION_LINES = [
  "登录之后点清空,然后复制歌单链接,就可以形成自己的专辑/文字墙",
  "复制歌单的链接到「歌」底部的「这里」,稍等片刻就可以识别成功喔",
  "在诗的歌,点击任意一行歌词即可查看",
  "建议歌单里10首歌左右效果为最佳",
  "联系邮箱：amosfallcheng@gmail.com",
  "小红书@陪我一起冒险",
];

export default function MoodBoardPage() {
  return (
    <div className="mood-board-page flex min-h-screen flex-col bg-[#fafafa]">
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2 sm:px-10 sm:pt-7">
        <TabNav />
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-6 sm:py-8">
        <section
          className="w-full max-w-2xl text-center text-sm leading-relaxed text-[var(--ink-muted)]"
          style={FONT_STYLE}
          aria-label="使用说明"
        >
          {FIXED_INSTRUCTION_LINES.map((line, i) => (
            <p key={i} className="mb-2 last:mb-0">
              {line}
            </p>
          ))}
        </section>
      </main>
    </div>
  );
}
