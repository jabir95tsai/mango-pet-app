"use client";

import type { Pet } from "@/lib/types";
import { YourStoryAvatar } from "./your-story-avatar";
import { PetStoryAvatar } from "./pet-story-avatar";
import { useTodayWalkStatus } from "./use-today-walk-status";

/**
 * Horizontal Instagram-style stories bar — your story slot first
 * (composer entry), then one avatar per pet with a today-walk-status
 * ring. Self-fetches today's walks via useTodayWalkStatus so the home
 * page doesn't have to thread walks state through.
 *
 * Horizontal overflow scrolls naturally; -mx pull breaks out of the
 * page-level horizontal padding so the bar bleeds edge-to-edge while
 * the first/last items sit flush with the rest of the home content.
 */
type Props = {
  pets: Pet[];
  onComposerOpen: () => void;
};

export function StoriesBar({ pets, onComposerOpen }: Props) {
  const { status } = useTodayWalkStatus(pets);

  return (
    <div
      role="region"
      aria-label="Pets stories"
      className="-mx-4 sm:-mx-6 lg:-mx-8"
    >
      <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-1 pl-4 pr-2 [scrollbar-width:none] sm:pl-6 lg:pl-8 [&::-webkit-scrollbar]:hidden">
        <YourStoryAvatar onTap={onComposerOpen} />
        {pets.map((p) => (
          <PetStoryAvatar
            key={p.petId}
            pet={p}
            status={status.get(p.petId) ?? "pending"}
          />
        ))}
      </div>
    </div>
  );
}
