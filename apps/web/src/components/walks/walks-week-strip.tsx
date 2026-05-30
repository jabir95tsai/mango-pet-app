"use client";

import { useLocale } from "next-intl";
import { enUS, zhTW } from "date-fns/locale";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";

/**
 * Seven-day strip — one column per day Mon-Sun. Each cell renders:
 *
 *   - A narrow weekday label (一 / M) coloured by today/non-today.
 *   - A 34px circle:
 *       done       → solid `mango.brand` fill, white paw icon
 *       done+today → solid `mango.leaf` fill + leaf-tint halo ring
 *                    (signals "you did it today")
 *       today      → `mango.brand-tint` fill, dashed brand border, dot
 *       other      → transparent, dashed hairline border
 *
 * Data shape is intentionally pre-computed by the parent — the strip
 * just renders; the "how do we know Tuesday was a 30-min walk?"
 * decision lives on the page where the walks query result is already
 * in scope.
 */
type Props = {
  /** Length 7, Monday-first. true = met the daily goal on that day. */
  days: boolean[];
  /** 0–6, Monday-first. -1 (e.g., week boundary) collapses today
   *  styling everywhere. */
  todayIdx: number;
  /** Used to decide if today's cell paints leaf (today's goal already
   *  met) vs brand-tint (today still in progress). */
  complete: boolean;
  /** Anchor date for the week — used to derive locale-aware narrow
   *  weekday labels via date-fns. Defaults to today; tests can pin. */
  weekStart?: Date;
};

/** Paw icon — inlined as SVG so it can use currentColor and we don't
 *  drag in another lucide-react import for one place. */
function Paw({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <ellipse cx="6.5" cy="9" rx="1.8" ry="2.3" />
      <ellipse cx="17.5" cy="9" rx="1.8" ry="2.3" />
      <ellipse cx="9.5" cy="5.5" rx="1.6" ry="2.1" />
      <ellipse cx="14.5" cy="5.5" rx="1.6" ry="2.1" />
      <path d="M12 11c-3 0-5.5 2.5-5.5 5.2 0 2 1.5 3.3 3.3 3.3.9 0 1.5-.4 2.2-.4s1.3.4 2.2.4c1.8 0 3.3-1.3 3.3-3.3C17.5 13.5 15 11 12 11z" />
    </svg>
  );
}

export function WalksWeekStrip({
  days,
  todayIdx,
  complete,
  weekStart,
}: Props) {
  const locale = useLocale();
  const dateLocale = locale === "zh-TW" ? zhTW : enUS;

  // Anchor for label generation: caller passes a Monday Date; we add
  // 0..6 days off it. Default = compute from today.
  const monday =
    weekStart ?? (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      // JS getDay(): 0=Sun..6=Sat; normalize so Monday = 0.
      const daysFromMonday = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - daysFromMonday);
      return d;
    })();

  return (
    <div
      className="grid grid-cols-7 gap-1.5 rounded-2xl border border-mango-hairline bg-mango-card px-3 py-3.5 shadow-card"
      role="list"
      aria-label="Week progress"
    >
      {Array.from({ length: 7 }, (_, i) => {
        const done = !!days[i];
        const isToday = i === todayIdx;
        const todayDone = isToday && complete;
        // Narrow weekday: zh-TW gives 一二三四五六日, en gives M T W T F S S.
        const label = format(addDays(monday, i), "EEEEE", {
          locale: dateLocale,
        });
        return (
          <div
            key={i}
            role="listitem"
            className="flex flex-col items-center gap-1.5"
          >
            <span
              className={cn(
                "text-[11px] font-semibold tracking-wide",
                isToday ? "text-mango-brand-deep" : "text-mango-ink-3",
              )}
            >
              {label}
            </span>
            <div
              className={cn(
                "grid h-[34px] w-[34px] place-items-center rounded-full",
                done
                  ? todayDone
                    ? "bg-mango-leaf text-white"
                    : "bg-mango-brand text-white"
                  : isToday
                    ? "border-[1.5px] border-solid border-mango-brand bg-mango-brand-tint text-mango-brand-deep"
                    : "border-[1.5px] border-dashed border-mango-hairline text-mango-ink-3",
              )}
              style={
                todayDone
                  ? { boxShadow: "0 0 0 3px #e7f2dc" }
                  : undefined
              }
            >
              {done ? (
                <Paw size={16} />
              ) : isToday ? (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-mango-brand"
                  aria-hidden="true"
                />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
