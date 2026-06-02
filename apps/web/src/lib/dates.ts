/**
 * Local-date helpers now live in @mango/shared-business (cross-platform
 * single source of truth — web + ios). Re-exported here so existing
 * `@/lib/dates` imports keep working unchanged.
 */
export {
  startOfMonth,
  dayDiffFromNow,
  formatAge,
  toLocalDateInput,
  toLocalDatetimeInput,
  fromLocalDateInput,
  todayLocalISO,
} from "@mango/shared-business";
export type { MillisTimestamp } from "@mango/shared-business";
