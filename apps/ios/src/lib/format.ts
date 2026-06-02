/**
 * Tiny display formatters that don't belong to business logic. `groupThousands`
 * exists because Hermes ships without full Intl, so `Number.toLocaleString`
 * doesn't insert grouping separators reliably on-device.
 */

/** "1234567" → "1,234,567" (rounded). No Intl dependency. */
export function groupThousands(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Firestore Timestamp-ish → "M/D" (local). Empty string when absent. */
export function monthDay(ts: { toMillis?: () => number } | undefined): string {
  const millis = ts?.toMillis?.() ?? 0;
  if (!millis) return "";
  const d = new Date(millis);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * Compact zh-TW relative time for feed/comment timestamps: 剛剛 / N分鐘前 /
 * N小時前 / N天前, falling back to "M/D" past a week. Tolerates a null/未落地
 * serverTimestamp (optimistic rows) by treating it as "剛剛".
 */
export function relativeTime(ts: { toMillis?: () => number } | undefined): string {
  const millis = ts?.toMillis?.() ?? Date.now();
  const diff = Date.now() - millis;
  if (diff < 60_000) return "剛剛";
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `${min}分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}小時前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}天前`;
  return monthDay(ts);
}
