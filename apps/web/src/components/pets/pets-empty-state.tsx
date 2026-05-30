"use client";

import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";

/**
 * Hero empty state for /app/pets when the user has no pets. Ports
 * prototype `EmptyState` (line 596–639) — large radial-gradient disc
 * with a paw icon at its centre, big title, body copy, large gradient
 * CTA pill, and small hint underneath.
 *
 * NOT a port of the prototype's cartoon shiba SVG — per spec, we don't
 * ship illustrated pet faces (those felt wrong when users haven't
 * uploaded a real pet yet). The paw icon inside a brand-tint→bg-alt
 * radial reads as "your pet goes here" without committing to a species.
 */
type Props = {
  onAddPet: () => void;
};

export function PetsEmptyState({ onAddPet }: Props) {
  const tPP = useTranslations("PetsPage");

  return (
    <div className="flex flex-col items-center gap-3.5 pt-12 text-center">
      <div
        className="relative grid size-[140px] place-items-center rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 35%, var(--color-mango-brand-tint) 0%, var(--color-mango-bg-alt) 70%)",
        }}
      >
        <div
          className="grid size-[96px] place-items-center rounded-[34px] bg-mango-card text-mango-brand-deep shadow-card"
          style={{ transform: "rotate(-6deg)" }}
          aria-hidden="true"
        >
          <svg
            width={56}
            height={56}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <ellipse cx="6.5" cy="9" rx="1.8" ry="2.3" />
            <ellipse cx="17.5" cy="9" rx="1.8" ry="2.3" />
            <ellipse cx="9.5" cy="5.5" rx="1.6" ry="2.1" />
            <ellipse cx="14.5" cy="5.5" rx="1.6" ry="2.1" />
            <path d="M12 11c-3 0-5.5 2.5-5.5 5.2 0 2 1.5 3.3 3.3 3.3.9 0 1.5-.4 2.2-.4s1.3.4 2.2.4c1.8 0 3.3-1.3 3.3-3.3C17.5 13.5 15 11 12 11z" />
          </svg>
        </div>
        <div
          aria-hidden="true"
          className="absolute -right-0.5 top-1.5 grid size-[38px] place-items-center rounded-full border border-mango-hairline bg-mango-card text-mango-brand-deep shadow-[0_6px_14px_-6px_rgba(80,50,10,0.30)]"
        >
          <Plus className="size-5" strokeWidth={2.5} />
        </div>
      </div>

      <h2 className="mt-1 text-[22px] font-extrabold tracking-[-0.4px] text-mango-ink">
        {tPP("empty.title")}
      </h2>
      <p className="max-w-[280px] text-[13.5px] leading-relaxed font-medium text-mango-ink-2">
        {tPP("empty.body")}
      </p>

      <button
        type="button"
        onClick={onAddPet}
        className="mt-4 inline-flex h-[50px] items-center gap-2 rounded-full px-6 text-base font-extrabold tracking-[-0.2px] text-mango-ink transition-transform duration-200 hover:scale-[1.02] active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mango-brand-deep/40 motion-reduce:transition-none motion-reduce:hover:scale-100"
        style={{
          background: "linear-gradient(180deg, #f39800 0%, #d77b00 100%)",
          boxShadow:
            "0 16px 28px -10px rgba(243,152,0,0.55), 0 3px 8px -3px rgba(180,100,0,0.30)",
        }}
      >
        <Plus className="size-[18px]" strokeWidth={2.5} />
        {tPP("empty.cta")}
      </button>

      <p className="mt-6 text-xs text-mango-ink-3">{tPP("empty.hint")}</p>
    </div>
  );
}
