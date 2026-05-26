"use client";

import { Bell, Home as HomeIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Compact home top bar — leaves room for the stories rail + feed
 * below. Left cluster is "🥭 Mango" + family pill (or user name in
 * personal mode); right is the notification bell. Per spec, the bell's
 * unread count is **NOT wired** in v3 — there's no notifications
 * collection yet, so the badge is suppressed when `notifyCount === 0`.
 *
 * The pill is presentational only — future plan is family switcher
 * dropdown; this v3 keeps it static to match the rest of the page's
 * mango v2 chip family.
 */
type Props = {
  familyName?: string | null;
  userDisplayName?: string | null;
  notifyCount?: number;
};

export function HomeTopBar({
  familyName,
  userDisplayName,
  notifyCount = 0,
}: Props) {
  const label = familyName ?? userDisplayName ?? null;

  return (
    <div className="flex items-center gap-2.5 pb-1 pt-1.5">
      <div
        className="text-[26px] font-extrabold leading-none tracking-[-0.6px] text-mango-ink"
        aria-hidden="true"
      >
        🥭 <span className="ml-0.5">Mango</span>
      </div>
      {label && (
        <span className="inline-flex items-center gap-1 rounded-full border border-mango-hairline bg-mango-card px-2.5 py-1 text-[12.5px] font-bold text-mango-ink-2 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
          <HomeIcon
            className="size-[11px] text-mango-brand-deep"
            strokeWidth={2.4}
          />
          <span className="max-w-[140px] truncate">{label}</span>
        </span>
      )}
      <div className="flex-1" />
      <button
        type="button"
        aria-label="Notifications"
        title="Notifications"
        className="relative grid size-10 place-items-center rounded-full border border-mango-hairline bg-mango-card text-mango-ink-2 transition-colors hover:bg-mango-bg-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
      >
        <Bell className="size-[18px]" strokeWidth={1.8} />
        {notifyCount > 0 && (
          <span
            className={cn(
              "absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-mango-brand px-1 text-[10px] font-extrabold text-white",
              "ring-2 ring-mango-card",
            )}
            aria-label={`${notifyCount} unread`}
          >
            {notifyCount > 99 ? "99+" : notifyCount}
          </span>
        )}
      </button>
    </div>
  );
}
