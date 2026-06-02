/**
 * Date helpers — PURE, cross-platform (web + ios). Single source for the
 * pet overview / expenses / reminders month math + the local-date <input>
 * string codec (avoids the YYYY-MM-DD UTC drift you get from
 * `toISOString().slice(0,10)` near midnight).
 *
 * Timestamps are accepted as the structural `{ toMillis(): number }` shape so
 * BOTH the firebase-JS Timestamp (web) and the @react-native-firebase
 * Timestamp (ios) satisfy them without an SDK-specific dependency — same
 * pattern as `scoring.ts` `ScorablePet`.
 *
 * ⚠️ `formatAge` / `dayDiffFromNow` return hard-coded zh-TW unit strings
 * (歲 / 個月 / 天前 / 小時後 / 天後), copied VERBATIM from the web originals so
 * web behaviour is byte-identical after the import re-point. Localising these
 * micro-units is tracked as a P2 polish item; the bulk of UI copy goes through
 * @mango/shared-i18n.
 */

/** Structural timestamp — satisfied by both firebase SDKs' `Timestamp`. */
export type MillisTimestamp = { toMillis(): number };

/** First instant of the current month, in local time. */
export function startOfMonth(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * Relative-time chip data for a reminder trigger. Past → "-N 天前"; <24h →
 * "N 小時後"; else "N 天後". zh-TW units (see file header). `nowMs` is
 * injectable for testing / deterministic rendering.
 */
export function dayDiffFromNow(
  t: MillisTimestamp,
  nowMs: number = Date.now(),
): { value: string; unit: string } {
  const ms = t.toMillis() - nowMs;
  if (ms < 0) {
    const days = Math.ceil(-ms / 86_400_000);
    return { value: `-${days}`, unit: "天前" };
  }
  const hours = ms / 3_600_000;
  if (hours < 24) {
    return { value: `${Math.max(1, Math.round(hours))}`, unit: "小時後" };
  }
  return { value: `${Math.ceil(ms / 86_400_000)}`, unit: "天後" };
}

/**
 * Human pet age from `birthday`. `≥1 年 → "N 歲"`, else `"N 個月"` (min 1).
 * Returns null when there's no birthday. zh-TW units (see file header).
 */
export function formatAge(
  birthday: MillisTimestamp | null | undefined,
  nowMs: number = Date.now(),
): string | null {
  if (!birthday) return null;
  const birthMs = birthday.toMillis();
  const years = Math.floor((nowMs - birthMs) / (365.25 * 24 * 3600 * 1000));
  if (years >= 1) return `${years} 歲`;
  const months = Math.floor((nowMs - birthMs) / (30 * 24 * 3600 * 1000));
  return `${Math.max(months, 1)} 個月`;
}

/** `YYYY-MM-DD` for the LOCAL day. Empty string for null/undefined. */
export function toLocalDateInput(date: Date | undefined | null): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** `YYYY-MM-DDTHH:mm` for a `datetime-local` input (web). */
export function toLocalDatetimeInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

/** Parse a `YYYY-MM-DD` string back to a local-midnight `Date`. */
export function fromLocalDateInput(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Today as `YYYY-MM-DD` (local). */
export function todayLocalISO(): string {
  return toLocalDateInput(new Date());
}
