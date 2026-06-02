// Leaderboard period keys — the subcollection id under leaderboards/ and
// dogLeaderboards/. iOS MUST compute the SAME key the Cloud Functions use to
// write entries, or it reads an empty/wrong period. Mirrors web
// apps/web/src/lib/scoring.ts isoWeekLabel/monthLabel byte-for-byte.
import type { LeaderboardPeriod } from "@mango/shared-types";

/** ISO-8601 week label, e.g. "weekly_2026-W23" (UTC-based, matches functions). */
export function isoWeekLabel(date: Date): string {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `weekly_${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** Month label, e.g. "monthly_2026-06". */
export function monthLabel(date: Date): string {
  return `monthly_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Subcollection key for a leaderboard period. */
export function periodKey(
  period: LeaderboardPeriod,
  when: Date = new Date(),
): string {
  switch (period) {
    case "weekly":
      return isoWeekLabel(when);
    case "monthly":
      return monthLabel(when);
    case "all_time":
      return "all_time";
  }
}
