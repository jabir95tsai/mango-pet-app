"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Users } from "lucide-react";
import type { Pet } from "@/lib/types";

/**
 * Personal-mode upsell — shown between StoriesBar and Feed when the
 * user has ≥1 pet but no family. Tap routes to /onboarding which
 * hosts the create-or-join family wizard (the same surface used at
 * sign-up). We deliberately don't inline a share-invite affordance
 * here because personal-mode users don't have an invite code yet —
 * they need to create the family first.
 */
type Props = {
  /** Optional pet to personalize the body copy. Falls back to a
   *  generic message if undefined. */
  pet?: Pet;
};

export function InviteFamilyCard({ pet }: Props) {
  const tH = useTranslations("Home");

  return (
    <Link
      href="/onboarding"
      className="flex items-center gap-3 rounded-[18px] border border-mango-hairline px-4 py-3.5 shadow-card transition-transform hover:scale-[1.005] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep motion-reduce:transition-none motion-reduce:hover:scale-100"
      style={{
        background:
          "linear-gradient(135deg, var(--color-mango-brand-tint) 0%, var(--color-mango-card-soft) 100%)",
      }}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-mango-card text-mango-brand-deep shadow-card">
        <Users className="size-5" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-extrabold tracking-[-0.1px] text-mango-ink">
          {tH("inviteFamily.title")}
        </div>
        <div className="mt-0.5 text-[12.5px] font-medium text-mango-ink-2">
          {pet
            ? tH("inviteFamily.body", { petName: pet.name })
            : tH("inviteFamily.bodyGeneric")}
        </div>
      </div>
      <span className="grid h-9 shrink-0 items-center rounded-full bg-mango-brand-deep px-3.5 text-[13px] font-extrabold text-white shadow-[0_8px_18px_-8px_rgba(215,123,0,0.5)]">
        {tH("inviteFamily.cta")}
      </span>
    </Link>
  );
}
