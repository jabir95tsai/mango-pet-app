"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Camera } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bottom sheet asking "拍張開始/結束照?" with [拍照] / [跳過]. Mounted
 * by the walks page (phase: 'start') and walk-tracking-view (phase:
 * 'end') around the existing Mango walk flow. Spec docs/features/
 * walks-auto-photo-share.md flows A + B.
 *
 * Slide-up animation under default motion settings; the
 * `prefers-reduced-motion` rule already in globals.css collapses the
 * transition globally, so reduced-motion users get a snap-appear with
 * no extra branching here.
 *
 * Backdrop click + Esc both treat as Skip (== `onSkip()`), matching
 * the spec edge case "User 在開始 prompt 點背景關 → 等同 [跳過]".
 */
type Props = {
  open: boolean;
  /** Skip path — backdrop click, Esc, or [跳過] button. Closes the
   *  sheet without surfacing the camera or composer. */
  onSkip: () => void;
  /** [拍照] path — caller is responsible for opening the camera
   *  picker / composer next. The sheet does NOT close itself on
   *  take; the caller closes when it has a file in hand (or the
   *  user cancels the camera). */
  onTake: () => void;
  /** Pet name interpolated into the body copy ("分享 {pet} 出發
   *  的瞬間給家人"). Defaults to "Mango" fallback when no pet is
   *  active — walks page already short-circuits on zero pets so
   *  this branch is mostly defensive. */
  petName: string;
  /** Which copy variant — start vs end of walk. */
  phase: "start" | "end";
  /** Minutes walked — interpolated into the END phase body
   *  ("{pet} 今天走了 {min} 分..."). Ignored on phase === 'start'. */
  walkMinutes?: number;
};

export function PhotoPromptSheet({
  open,
  onSkip,
  onTake,
  petName,
  phase,
  walkMinutes,
}: Props) {
  const t = useTranslations("WalksPhotoPrompt");

  // Esc closes (== skip).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onSkip();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onSkip]);

  if (!open) return null;

  const title =
    phase === "start" ? t("start.title") : t("end.title");
  const body =
    phase === "start"
      ? t("start.body", { pet: petName })
      : t("end.body", { pet: petName, min: walkMinutes ?? 0 });

  return (
    <div
      // z-index 60 sits above the walk-tracking-view's `fixed inset-0`
      // (40) AND the confetti's relative-positioned overlay so the
      // sheet is always pickable from the done screen.
      className="fixed inset-0 z-[60] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-prompt-title"
    >
      {/* Backdrop — click counts as Skip. Separate element so the
          sheet itself stays interactive. */}
      <button
        type="button"
        aria-label={t("skip")}
        onClick={onSkip}
        className="absolute inset-0 bg-black/40 transition-opacity"
      />
      <div
        className={cn(
          "relative z-10 w-full max-w-md rounded-t-3xl border border-b-0 border-mango-hairline bg-mango-card-soft px-6 pt-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-elevated",
          // Slide-up; collapses to snap-appear under
          // prefers-reduced-motion via the global rule in globals.css.
          "animate-[photoPromptSlideUp_220ms_ease-out]",
        )}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-mango-hairline" />
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-2xl bg-mango-brand-tint text-2xl"
          >
            📸
          </span>
          <div className="flex-1 min-w-0">
            <h2
              id="photo-prompt-title"
              className="text-lg font-bold leading-tight text-mango-ink"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-mango-ink-2">{body}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onTake}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-mango-brand text-base font-bold text-white shadow-mango transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Camera className="size-5" />
            {t("take")}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="h-11 w-full rounded-full text-sm font-semibold text-mango-ink-2 transition-colors hover:bg-mango-bg-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
          >
            {t("skip")}
          </button>
        </div>
      </div>
    </div>
  );
}
