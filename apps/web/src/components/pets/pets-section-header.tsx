"use client";

import Link from "next/link";

/**
 * Section header strip used inside tab bodies — small bold title on the
 * left, optional "全部 →" link on the right. Ports prototype
 * `SectionHeader` (line 423–437).
 */
type Props = {
  title: string;
  actionLabel?: string;
  actionHref?: string;
};

export function PetsSectionHeader({ title, actionLabel, actionHref }: Props) {
  return (
    <div className="flex items-baseline justify-between gap-2 pt-5 pb-2">
      <span className="text-sm font-bold tracking-[-0.1px] text-mango-ink">
        {title}
      </span>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="text-[12.5px] font-semibold text-mango-brand-deep hover:underline"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
