import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  className?: string;
  /**
   * Optional right-aligned slot next to the title — e.g. a mobile-only
   * overflow trigger. Subtitles still wrap underneath without pushing the
   * action off-screen.
   */
  action?: ReactNode;
};

/**
 * Typography aligned with the Phase 2 v2 mango family — PetsTopBar's
 * "我的寵物" and the walks page's "遛狗" both render as 26px extrabold
 * with -0.5px tracking on mango-ink. Updating this shared header
 * harmonizes every top-page topic (/app home, feed, leaderboard,
 * expenses, restaurants, friends, knowledge, settings) in one place so
 * the four-corner navigation reads at the same prominence.
 *
 * User feedback 2026-05-25: previous text-2xl/sm:text-3xl bold looked
 * smaller + thinner than the new pets v2 surface.
 *
 * dark:text-zinc-50 stays so dark-mode users don't lose contrast —
 * mango-ink (#231b14) would otherwise read as near-black on dark bg.
 */
export function RouteHeader({ title, subtitle, className, action }: Props) {
  return (
    <header className={className ?? "mb-6"}>
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-[26px] font-extrabold tracking-[-0.5px] text-mango-ink dark:text-zinc-50">
          {title}
        </h1>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {subtitle && (
        <p className="mt-1 max-w-2xl text-sm leading-6 text-mango-ink-2 dark:text-zinc-400">
          {subtitle}
        </p>
      )}
    </header>
  );
}
