"use client";

import { useTranslations } from "next-intl";
import { PenSquare } from "lucide-react";

/**
 * Edge case from spec — user has ≥1 pet but no posts yet. Shown
 * underneath FeedSectionHeader to point them at the YourStoryAvatar
 * (+) entry rather than the now-default-public visibility chips.
 * Cream tinted card so the empty space doesn't read as a layout bug.
 */
type Props = {
  onCompose: () => void;
};

export function NoPostsHint({ onCompose }: Props) {
  const tH = useTranslations("Home");
  return (
    <button
      type="button"
      onClick={onCompose}
      className="mt-1 flex w-full items-center gap-3 rounded-[18px] border border-mango-hairline bg-mango-card-soft px-4 py-4 text-left shadow-card transition-colors hover:bg-mango-bg-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-mango-brand-tint text-mango-brand-deep">
        <PenSquare className="size-5" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-extrabold tracking-[-0.1px] text-mango-ink">
          {tH("feed.emptyTitle")}
        </div>
        <div className="mt-0.5 text-[12.5px] font-medium text-mango-ink-2">
          {tH("feed.emptyHint")}
        </div>
      </div>
    </button>
  );
}
