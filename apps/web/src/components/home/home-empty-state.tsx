"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { PawPrint, Plus, Users } from "lucide-react";

/**
 * Home variant D1 — first-run hero shown when the user has zero pets.
 * Same paw-icon disc treatment as PetsEmptyState (no cartoon shiba —
 * we don't ship illustrated stand-ins for users who haven't uploaded
 * a real photo yet) plus a 3-step strip explaining the onboarding
 * flow so users see what they're working toward.
 *
 * Primary CTA → /app/pets (user creates their first pet there);
 * secondary "join family" CTA → /onboarding which already hosts the
 * create-or-join flow.
 */
export function HomeEmptyState() {
  const tH = useTranslations("Home");

  return (
    <div className="flex flex-col items-center gap-3 pt-6 text-center">
      <div
        className="relative grid size-[168px] place-items-center rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 35%, var(--color-mango-brand-tint) 0%, var(--color-mango-bg-alt) 70%, transparent 100%)",
        }}
      >
        <div className="grid size-[120px] place-items-center rounded-[36px] bg-mango-card text-mango-brand-deep shadow-card">
          <PawPrint className="size-[64px]" strokeWidth={1.6} />
        </div>
        {/* Decorative confetti — small mango / leaf / peach bits to
            soften the "empty" feeling without committing to a species. */}
        <span
          aria-hidden="true"
          className="absolute left-[18px] top-2 size-2 rounded-[2px] bg-mango-brand"
          style={{ transform: "rotate(20deg)" }}
        />
        <span
          aria-hidden="true"
          className="absolute right-[14px] bottom-[18px] h-3 w-1.5 rounded-[2px] bg-mango-leaf"
          style={{ transform: "rotate(-15deg)" }}
        />
        <span
          aria-hidden="true"
          className="absolute right-1.5 top-[30px] size-1.5 rounded-full bg-mango-peach"
        />
      </div>

      <h2 className="mt-1 text-[24px] font-extrabold tracking-[-0.5px] text-mango-ink">
        {tH("empty.title")}
      </h2>
      <p className="max-w-[290px] text-sm font-medium leading-relaxed text-mango-ink-2">
        {tH("empty.body")}
      </p>

      <div className="mt-3 flex w-full max-w-[280px] flex-col gap-2.5">
        <Link
          href="/app/pets"
          className="btn-mango inline-flex h-[52px] items-center justify-center gap-2 rounded-full text-base font-extrabold tracking-[-0.2px] text-white transition-transform hover:scale-[1.02] active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mango-brand-deep/40 motion-reduce:transition-none motion-reduce:hover:scale-100"
        >
          <Plus className="size-[18px]" strokeWidth={2.5} />
          {tH("empty.cta")}
        </Link>
        <Link
          href="/onboarding"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full border-[1.5px] border-mango-hairline bg-transparent text-[14.5px] font-bold tracking-[-0.1px] text-mango-ink transition-colors hover:bg-mango-bg-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
        >
          <Users className="size-3.5" strokeWidth={2} />
          {tH("empty.joinFamily")}
        </Link>
      </div>

      {/* 3-step how-it-works strip — gives users a concrete map of
          what's behind the CTA. Matches the pets v2 empty hint card
          family. */}
      <div className="mt-5 grid w-full grid-cols-3 gap-2 text-left">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="flex flex-col gap-1 rounded-[14px] border border-mango-hairline bg-mango-card p-2.5"
          >
            <span className="grid size-[22px] place-items-center rounded-full bg-mango-brand-tint text-[12px] font-extrabold text-mango-brand-deep">
              {n}
            </span>
            <span className="text-[12.5px] font-extrabold tracking-[-0.1px] text-mango-ink">
              {tH(`empty.step${n}.title`)}
            </span>
            <span className="text-[10.5px] font-semibold tracking-[0.2px] text-mango-ink-3">
              {tH(`empty.step${n}.sub`)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
