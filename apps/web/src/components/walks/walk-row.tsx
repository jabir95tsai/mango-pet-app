"use client";

import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { enUS, zhTW } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { Clock, Hand, Route, Star, Trash2 } from "lucide-react";
import type { Timestamp } from "firebase/firestore";
import type { Walk } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { PhotoLightbox } from "@/components/ui/photo-lightbox";
import { cn } from "@/lib/utils";

/**
 * Compact row for the recent-walks list on `/app/walks` (Phase 1 v2).
 * Replaces the heavier `WalkCard` for this surface — same data, but
 * a single inline line (icon · pet name · timestamp · km · min ·
 * score · delete) so we can fit 3-5 rows without crowding the dial
 * + week strip above. WalkCard stays available for the future
 * full-history page where the extra detail makes sense.
 *
 * Visual notes:
 *   - Avatar: brand-tint warm circle for GPS-tracked walks, bg-alt
 *     muted circle for manual entries — same convention as WalkCard.
 *   - Score gets `text-mango-brand-deep` to match the brand-deep
 *     accent already used for stat cards & "more →" links.
 *   - Delete button hover stays red — destructive intent (Q19).
 */
type Props = {
  walk: Walk;
  onDelete: () => void;
};

export function WalkRow({ walk, onDelete }: Props) {
  const locale = useLocale();
  const tC = useTranslations("Common");
  const tP = useTranslations("Walks.page");
  const tPL = useTranslations("PhotoLightbox");
  const dateLocale = locale === "zh-TW" ? zhTW : enUS;

  // Optional photo strip — adds a 36px thumbnail before the delete
  // button if the walk has any photos. Tap → opens the shared
  // PhotoLightbox at the first photo; carousel handles the rest.
  const photos = walk.photoURLs ?? [];
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const ts = walk.startedAt as Timestamp | undefined;
  const start = ts ? new Date(ts.toMillis()) : new Date();
  const rel = formatDistanceToNow(start, {
    addSuffix: true,
    locale: dateLocale,
  });
  // Detailed timestamp for the title attribute — hover/long-press
  // reveals the exact moment without taking row space.
  const exact = format(start, "yyyy-MM-dd HH:mm", { locale: dateLocale });
  const walkerName = walk.walkerName?.trim() || null;

  return (
    <article
      className="flex items-center gap-3 rounded-2xl border border-mango-hairline bg-mango-card px-3.5 py-3"
      style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.02)" }}
    >
      {/* Icon disc — paw for GPS, hand for manual */}
      <div
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full",
          walk.isManual
            ? "bg-mango-bg-alt text-mango-ink-2"
            : "bg-mango-brand-tint text-mango-brand-deep",
        )}
        aria-hidden="true"
      >
        {walk.isManual ? <Hand className="size-[18px]" /> : <PawIcon size={18} />}
      </div>

      {/* Middle column: pet name + relative time, then km / min / score */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-semibold text-mango-ink">
            {walk.petName ?? "🐾"}
          </span>
          <span
            className="shrink-0 text-xs text-mango-ink-3"
            title={exact}
          >
            {rel}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-mango-ink-2">
          <span className="inline-flex items-center gap-1">
            <Route className="size-[13px] text-mango-ink-3" />
            <span className="tabular-nums">
              {walk.distanceKm.toFixed(2)} km
            </span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-[13px] text-mango-ink-3" />
            <span className="tabular-nums">
              {walk.durationMin.toFixed(0)} min
            </span>
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-mango-brand-deep">
            <Star className="size-3" />
            <span className="tabular-nums">{walk.score.toFixed(1)}</span>
          </span>
        </div>
        {walkerName && (
          <div className="mt-1.5 inline-flex max-w-full items-center gap-1.5 text-[11.5px] font-medium text-mango-ink-3">
            <Avatar
              src={walk.walkerPhotoURL}
              name={walkerName}
              size={18}
              className="ring-1 ring-mango-hairline"
            />
            <span className="truncate">
              {tP("walkedBy", { name: walkerName })}
            </span>
          </div>
        )}
      </div>

      {/* Photo thumbnail — only renders when the walk has photos.
          Tapping opens the lightbox at the first photo; the carousel
          inside handles the rest. */}
      {photos.length > 0 && (
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          aria-label={tPL("counter", {
            current: 1,
            total: photos.length,
          })}
          className="relative size-9 shrink-0 overflow-hidden rounded-lg border border-mango-hairline bg-mango-bg-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[0]}
            alt=""
            className="size-full object-cover"
            draggable={false}
          />
          {photos.length > 1 && (
            <span
              aria-hidden="true"
              className="absolute right-0 bottom-0 grid h-4 min-w-4 place-items-center rounded-tl-md bg-black/70 px-1 text-[10px] font-bold tabular-nums text-white"
            >
              {photos.length}
            </span>
          )}
        </button>
      )}

      {/* Delete — kept tertiary; reveals red on hover/focus */}
      <button
        type="button"
        onClick={onDelete}
        aria-label={tC("delete")}
        className="grid size-8 shrink-0 place-items-center rounded-lg text-mango-ink-3 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep dark:hover:bg-red-950"
      >
        <Trash2 className="size-4" />
      </button>

      <PhotoLightbox
        photos={photos}
        initialIdx={0}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </article>
  );
}

/** Inline paw SVG matching the dial / week-strip family. Sized via
 *  `size` prop because the lucide PawPrint is more chunky than the
 *  inline ellipse-based paw used elsewhere in this redesign. */
function PawIcon({ size = 18 }: { size?: number }) {
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
