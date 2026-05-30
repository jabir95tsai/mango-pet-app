"use client";

import { useTranslations } from "next-intl";
import type { Pet } from "@/lib/types";
import { PetAvatar } from "@/components/pets/pet-avatar";
import { cn } from "@/lib/utils";
import type { WalkStatus } from "./use-today-walk-status";

/**
 * Stories-bar slot 2..N — pet avatar with a ring colour encoding
 * today's walk status:
 *   - 'done'     → brand → leafDeep conic gradient ring
 *   - 'pending'  → hairline grey ring
 *   - 'tracking' → brand pulsing ring (reduced-motion safe — pulse
 *                   collapsed via globals.css media query)
 *
 * Tap is intentionally a no-op for v3 — the future plan is "filter
 * feed by this pet" but the listFeedPosts helper doesn't yet support
 * petId scoping. We still render an aria-label so screen readers
 * announce the status, and we use a real <button> so keyboard tab
 * order stays correct.
 */
type Props = {
  pet: Pet;
  status: WalkStatus;
};

export function PetStoryAvatar({ pet, status }: Props) {
  const tH = useTranslations("Home");

  const statusLabel =
    status === "done"
      ? tH("stories.doneWalk")
      : status === "tracking"
      ? tH("stories.tracking")
      : tH("stories.pendingWalk");

  const ringStyle: React.CSSProperties =
    status === "done"
      ? {
          background:
            "conic-gradient(from 200deg, var(--color-mango-brand), var(--color-mango-leaf), var(--color-mango-leaf-tint), var(--color-mango-brand))",
        }
      : status === "tracking"
      ? {
          background:
            "conic-gradient(from 200deg, var(--color-mango-brand), var(--color-mango-cookie), var(--color-mango-brand))",
        }
      : {
          background: "var(--color-mango-hairline)",
        };

  return (
    <button
      type="button"
      onClick={() => {
        /* future: filter feed by pet — spec D1 future no-op */
      }}
      aria-label={`${pet.name} · ${statusLabel} — ${tH("stories.filterFutureHint")}`}
      title={`${pet.name} · ${statusLabel}`}
      className="group flex w-[68px] shrink-0 flex-col items-center gap-1.5 rounded-lg pt-0.5 pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
    >
      {/* Three-layer IG-style ring: gradient outer → cream pad → avatar
          inner. The middle pad uses bg (cream) so the ring "floats"
          against the page background even when the bar sits on a
          card. */}
      <div
        className={cn(
          "relative size-16 rounded-full p-[2.5px]",
          status === "tracking" &&
            "animate-pulse motion-reduce:animate-none",
        )}
        style={ringStyle}
        aria-hidden="true"
      >
        <div className="size-full rounded-full bg-mango-bg p-[2px]">
          <div className="size-full overflow-hidden rounded-full">
            <PetAvatar
              photoURL={pet.photoURL}
              name={pet.name}
              size={54}
            />
          </div>
        </div>
      </div>
      <span
        className={cn(
          "max-w-[68px] truncate text-[11.5px] tracking-[-0.1px]",
          status === "done"
            ? "font-semibold text-mango-ink-2"
            : "font-bold text-mango-ink",
        )}
      >
        {pet.name}
      </span>
    </button>
  );
}
