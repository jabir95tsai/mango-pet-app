"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Feed section header — "最新動態 · 家人 · 朋友" on the left, "查看更多 →"
 * brand-deep link on the right that routes to /app/feed for the full
 * timeline.
 */
export function FeedSectionHeader() {
  const tH = useTranslations("Home");

  return (
    <div className="flex items-baseline justify-between gap-3 pt-2 pb-2.5">
      <div className="min-w-0">
        <span className="text-[15px] font-extrabold tracking-[-0.1px] text-mango-ink">
          {tH("feed.title")}
        </span>
        <span className="ml-2 text-xs text-mango-ink-3">
          {tH("feed.subtitle")}
        </span>
      </div>
      <Link
        href="/app/feed"
        className="inline-flex shrink-0 items-center gap-0.5 text-[12.5px] font-bold text-mango-brand-deep hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
      >
        {tH("feed.viewAll")}
        <ChevronRight className="size-3" strokeWidth={2.4} />
      </Link>
    </div>
  );
}
