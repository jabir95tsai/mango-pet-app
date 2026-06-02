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
