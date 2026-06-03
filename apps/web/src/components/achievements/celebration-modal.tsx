"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import type { Achievement } from "@/lib/types";
import { ConfettiCanvas } from "@/components/ui/confetti-canvas";
import { cn } from "@/lib/utils";

/** The unlock celebration overlay (spec §H / §H.1). Pixel values track the
 *  user's Claude Design hand-off; motion lives in globals.css so the global
 *  prefers-reduced-motion rule + the `.celebrate-*` hard-stops collapse it to
 *  design variant C (static medal, no confetti — the canvas is simply not
 *  rendered for that audience).
 *
 *  Three layouts by batch size:
 *   - 1 badge      → single medal + name/desc/category chip.
 *   - 2…6 badges   → variant B: medal features one, a thumbnail strip + dots
 *                    swap which.
 *   - >6 badges    → summary: a stacked coin pile + "you earned N" headline
 *                    (§H.1 — keeps a backfill flood readable).
 */

const SUMMARY_THRESHOLD = 6; // batches larger than this collapse to a summary.
const STACK_SHOWN = 5; // medals drawn in the summary pile before "+N".

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function CelebrationModal({
  badges,
  onClose,
}: {
  badges: Achievement[];
  onClose: () => void;
}) {
  const t = useTranslations("Achievements");
  const router = useRouter();
  const [active, setActive] = useState(0);
  const [reduced] = useState(prefersReducedMotion);
  const modalRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const count = badges.length;
  const summary = count > SUMMARY_THRESHOLD;
  const multi = count > 1 && !summary;
  const badge = badges[Math.min(active, count - 1)] ?? badges[0];

  // Esc to close + lock body scroll + move focus into the modal, restoring it
  // when the modal closes.
  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    primaryRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const name = t(`${badge.id}.title`);
  const desc = t(`${badge.id}.desc`);
  const category = t(`categories.${badge.category}`);
  const dialogLabel = summary
    ? t("celebrate.summaryTitle", { count })
    : t("celebrate.ariaLabel", { name });

  // Minimal focus trap: keep Tab / Shift-Tab inside the modal.
  const onTrapKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const nodes = modalRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    );
    if (!nodes || nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const goToAchievements = () => {
    onClose();
    router.push("/app/achievements");
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="presentation"
      onClick={onClose}
    >
      <div className="celebrate-scrim absolute inset-0" aria-hidden="true" />

      {/* Shared canvas confetti, behind the card (zIndex 1 > scrim, < card).
          Omitted entirely under reduced motion — design variant C. */}
      {!reduced && (
        <ConfettiCanvas mode="paper" portal={false} zIndex={1} />
      )}

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={dialogLabel}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onTrapKeyDown}
        className="celebrate-modal relative z-10 w-full max-w-[330px] rounded-[24px] border border-mango-hairline bg-mango-card-soft px-[22px] pb-[22px] pt-[18px] text-center shadow-[0_24px_60px_-20px_rgba(70,42,8,0.45)]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("celebrate.close")}
          className="absolute right-2.5 top-2.5 grid size-9 place-items-center rounded-full text-mango-ink-3 transition-colors hover:bg-mango-bg-alt hover:text-mango-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-mango-brand-deep/50"
        >
          <X className="size-5" />
        </button>

        {summary ? (
          /* ── Summary (N > 6) ───────────────────────────────────────── */
          <>
            {/* Stacked coin pile — first STACK_SHOWN badges as overlapping
                gold medals, then a +N chip. */}
            <div className="relative mx-auto mt-3 flex items-center justify-center">
              <div
                className="celebrate-glow pointer-events-none absolute inset-0 -m-4 rounded-full"
                aria-hidden="true"
              />
              {badges.slice(0, STACK_SHOWN).map((b, i) => (
                <span
                  key={b.id}
                  aria-hidden="true"
                  className={cn(
                    "celebrate-medal grid size-[64px] place-items-center rounded-full text-[30px] ring-4 ring-mango-card-soft",
                    i > 0 && "-ml-6",
                  )}
                  style={{ zIndex: STACK_SHOWN - i }}
                >
                  {b.emoji}
                </span>
              ))}
              {count > STACK_SHOWN && (
                <span className="z-10 -ml-3 grid size-[64px] place-items-center rounded-full bg-mango-brand-tint text-base font-extrabold text-mango-brand-deep ring-4 ring-mango-card-soft">
                  +{count - STACK_SHOWN}
                </span>
              )}
            </div>

            <p className="mt-5 text-sm font-bold text-mango-brand-deep">
              {t("celebrate.kicker")}
            </p>
            <h2 className="mt-1 text-[24px] font-extrabold leading-tight tracking-[-0.4px] text-mango-ink">
              {t("celebrate.summaryTitle", { count })}
            </h2>
            <p className="mx-auto mt-1.5 max-w-[260px] text-[14px] font-medium leading-snug text-mango-ink-2">
              {t("celebrate.summaryBody")}
            </p>
          </>
        ) : (
          /* ── Single (1) / Variant B (2…6) ──────────────────────────── */
          <>
            {multi && (
              <p className="text-xs font-bold tracking-wide text-mango-brand-deep">
                {t("celebrate.multiTitle", { count })}
              </p>
            )}

            {/* Mango gold medal. Keyed by badge id so swapping replays pop. */}
            <div
              key={badge.id}
              className="relative mx-auto mt-2 grid size-[148px] place-items-center"
            >
              <div
                className="celebrate-rays pointer-events-none absolute inset-[-16px] rounded-full"
                aria-hidden="true"
              />
              <div
                className="celebrate-glow pointer-events-none absolute inset-[-8px] rounded-full"
                aria-hidden="true"
              />
              <div className="celebrate-medal relative grid size-[148px] place-items-center rounded-full">
                <div
                  className="grid size-[112px] place-items-center rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 40%, #fffdf7 0%, #fff1d4 72%, #ffe6b6 100%)",
                  }}
                >
                  <span className="text-[62px] leading-none" aria-hidden="true">
                    {badge.emoji}
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-4 text-sm font-bold text-mango-brand-deep">
              {t("celebrate.kicker")}
            </p>
            <h2 className="mt-1 text-[25px] font-extrabold leading-tight tracking-[-0.5px] text-mango-ink">
              {name}
            </h2>
            <p className="mx-auto mt-1.5 max-w-[260px] text-[14.5px] font-medium leading-snug text-mango-ink-2">
              {desc}
            </p>
            <span className="mt-3 inline-block rounded-full bg-mango-brand-tint px-3 py-1 text-xs font-bold text-mango-brand-deep">
              {t("celebrate.categoryChip", { category })}
            </span>

            {multi && (
              <div className="mt-4">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {badges.map((b, i) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setActive(i)}
                      aria-label={t("celebrate.goTo", { index: i + 1 })}
                      aria-current={i === active}
                      className={cn(
                        "grid size-10 place-items-center rounded-xl text-xl transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-mango-brand-deep/50",
                        i === active
                          ? "badge-disc-earned scale-105"
                          : "bg-mango-bg-alt opacity-70 hover:opacity-100",
                      )}
                    >
                      <span aria-hidden="true">{b.emoji}</span>
                    </button>
                  ))}
                </div>
                <div
                  className="mt-2 flex items-center justify-center gap-1.5"
                  aria-hidden="true"
                >
                  {badges.map((b, i) => (
                    <span
                      key={b.id}
                      className={cn(
                        "size-1.5 rounded-full transition-colors",
                        i === active
                          ? "bg-mango-brand-deep"
                          : "bg-mango-hairline",
                      )}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            ref={primaryRef}
            type="button"
            onClick={onClose}
            style={{
              backgroundImage:
                "linear-gradient(180deg, var(--color-mango-brand), var(--color-mango-brand-deep))",
              boxShadow: "0 12px 24px -10px rgba(243,152,0,0.6)",
            }}
            className="inline-flex h-[52px] items-center justify-center rounded-full text-base font-extrabold tracking-[-0.2px] text-white transition-[filter,transform] hover:brightness-[0.97] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-mango-brand-deep/60 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {t("celebrate.primary")}
          </button>
          <button
            type="button"
            onClick={goToAchievements}
            className="inline-flex h-11 items-center justify-center rounded-full text-sm font-bold text-mango-ink-2 transition-colors hover:bg-mango-bg-alt focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-mango-brand-deep/50"
          >
            {t("celebrate.secondary")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
