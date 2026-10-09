/**
 * Tiny display formatters that don't belong to business logic. `groupThousands`
 * exists because Hermes ships without full Intl, so `Number.toLocaleString`
 * doesn't insert grouping separators reliably on-device (and Hermes has no
 * Intl.RelativeTimeFormat at all — relative times go through the shared
 * catalog instead, see `relativeTime`).
 */
import { t } from "@/lib/i18n";

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

type TimestampLike = { toMillis?: () => number } | null | undefined;

const MINUTES_IN_DAY = 1440;
const MINUTES_IN_ALMOST_TWO_DAYS = 2520;
const MINUTES_IN_MONTH = 43200;

/** Calendar-month difference (date-fns differenceInMonths, whole months only). */
function differenceInMonths(later: Date, earlier: Date): number {
  let months =
    (later.getFullYear() - earlier.getFullYear()) * 12 + (later.getMonth() - earlier.getMonth());
  // Not a full month yet when the later date's day/time is before the earlier's.
  const anchor = new Date(earlier.getTime());
  anchor.setMonth(anchor.getMonth() + months);
  if (anchor.getTime() > later.getTime()) months -= 1;
  return Math.max(0, months);
}

/**
 * Locale-aware distance between two instants, WITHOUT a suffix — the same
 * buckets and wording as date-fns `formatDistance` (web post-card /
 * comment-section / walk-row / reminder-card use `formatDistanceToNow` with
 * the zh-TW / en-US locales), rendered through the shared catalog
 * (`Common.time.*`) because Hermes has no Intl.RelativeTimeFormat.
 *
 *   < 1 min      少於 1 分鐘 / less than a minute
 *   1–44 min     N 分鐘 / N minutes
 *   45–89 min    大約 1 小時 / about 1 hour
 *   1.5–24 h     大約 N 小時 / about N hours
 *   …days, about-months, months, about/over/almost-years (date-fns buckets)
 */
export function formatDistance(fromMs: number, toMs: number = Date.now()): string {
  const later = Math.max(fromMs, toMs);
  const earlier = Math.min(fromMs, toMs);
  const seconds = Math.trunc((later - earlier) / 1000);
  const minutes = Math.round(seconds / 60);

  if (minutes < 2) {
    return minutes === 0 ? t("Common.time.lessThanMinute") : t("Common.time.minute");
  }
  if (minutes < 45) return t("Common.time.minutes", { n: minutes });
  if (minutes < 90) return t("Common.time.aboutHour");
  if (minutes < MINUTES_IN_DAY) {
    return t("Common.time.aboutHours", { n: Math.round(minutes / 60) });
  }
  if (minutes < MINUTES_IN_ALMOST_TWO_DAYS) return t("Common.time.day");
  if (minutes < MINUTES_IN_MONTH) {
    return t("Common.time.days", { n: Math.round(minutes / MINUTES_IN_DAY) });
  }
  if (minutes < MINUTES_IN_MONTH * 2) {
    const n = Math.round(minutes / MINUTES_IN_MONTH);
    return n === 1 ? t("Common.time.aboutMonth") : t("Common.time.aboutMonths", { n });
  }
  const months = differenceInMonths(new Date(later), new Date(earlier));
  if (months < 12) {
    return t("Common.time.months", { n: Math.round(minutes / MINUTES_IN_MONTH) });
  }
  const monthsSinceStartOfYear = months % 12;
  const years = Math.trunc(months / 12);
  if (monthsSinceStartOfYear < 3) {
    return years === 1 ? t("Common.time.aboutYear") : t("Common.time.aboutYears", { n: years });
  }
  if (monthsSinceStartOfYear < 9) {
    return years === 1 ? t("Common.time.overYear") : t("Common.time.overYears", { n: years });
  }
  return t("Common.time.almostYears", { n: years + 1 });
}

/**
 * date-fns `formatDistanceToNow(date, { addSuffix: true })` equivalent for
 * any instant (past → "5 分鐘前" / "5 minutes ago", future → "3 天內" /
 * "in 3 days"). `nowMs` is injectable for tests.
 */
export function relativeTimeFromMillis(ms: number, nowMs: number = Date.now()): string {
  const distance = formatDistance(ms, nowMs);
  return ms > nowMs
    ? t("Common.time.inFuture", { time: distance })
    : t("Common.time.inPast", { time: distance });
}

/**
 * Feed / comment / walk timestamps — a Firestore Timestamp-ish → localized
 * relative time, matching the web (date-fns formatDistanceToNow + addSuffix):
 * "少於 1 分鐘前" / "less than a minute ago", "大約 3 小時前" / "about 3 hours
 * ago", "2 天前" / "2 days ago", … Tolerates a null / not-yet-landed
 * serverTimestamp (optimistic rows) by treating it as "now", like web.
 * Signature unchanged from the old zh-only helper.
 */
export function relativeTime(ts: TimestampLike): string {
  const millis = ts?.toMillis?.() ?? Date.now();
  return relativeTimeFromMillis(millis);
}
