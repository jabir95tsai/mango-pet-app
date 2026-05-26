"use client";

import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useAuth } from "@/components/auth/auth-provider";

/**
 * Stories-bar slot 1 — user's "Your Story" avatar with a brand `+`
 * overlay disc bottom-right. Tap opens the post composer (IG mode per
 * user D2 override of the PM default). Sits next to the dashed brand
 * border so it visually anchors the bar's left edge.
 *
 * 64px avatar matches PetStoryAvatar so the row reads as one band
 * regardless of pet count.
 */
type Props = {
  onTap: () => void;
};

export function YourStoryAvatar({ onTap }: Props) {
  const tH = useTranslations("Home");
  const { user } = useAuth();

  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={tH("stories.yourStory")}
      className="group flex w-[68px] shrink-0 flex-col items-center gap-1.5 rounded-lg pt-0.5 pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
    >
      <div className="relative size-16">
        {/* Dashed brand border ring — distinguishes "your story" slot
            from the pet status rings so users don't read it as a pet
            with a missing walk. */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: "1.5px dashed var(--color-mango-brand)",
            background: "var(--color-mango-bg-alt)",
          }}
          aria-hidden="true"
        />
        <div className="absolute inset-[3px] overflow-hidden rounded-full">
          <Avatar
            src={user?.photoURL}
            name={user?.displayName ?? "You"}
            size={58}
          />
        </div>
        {/* Bottom-right + overlay — 22×22 brand disc with white plus,
            mirrors IG's add-story affordance. White ring around the
            disc cuts cleanly through the dashed border. */}
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -bottom-0.5 grid size-[22px] place-items-center rounded-full bg-mango-brand text-white ring-[2px] ring-mango-bg transition-transform group-hover:scale-[1.06] group-active:scale-95 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        >
          <Plus className="size-3.5" strokeWidth={2.6} />
        </span>
      </div>
      <span className="max-w-[68px] truncate text-[11px] font-bold tracking-[-0.1px] text-mango-ink-2 group-hover:text-mango-ink">
        {tH("stories.yourStory")}
      </span>
    </button>
  );
}
