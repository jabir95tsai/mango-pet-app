"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useGuestUpgrade } from "@/components/auth/guest-upgrade";
import { listPersonalPets } from "@/lib/firebase/pets";

const DISMISS_KEY = "mango.guestNudgeDismissed";

/**
 * One-time, dismissible "bind your account so you don't lose your data"
 * banner for guests who have created at least one pet (a walk requires a
 * pet, so ≥1 pet also covers the "first walk" trigger). Mounted at the top
 * of the /app layout. Dismissal is stored in localStorage — fitting, since
 * a guest session is device-bound anyway. The permanent upgrade entry lives
 * in Settings regardless of this banner. Spec docs/features/guest-login.md §5.
 */
export function GuestUpgradeNudge() {
  const t = useTranslations("Guest.nudge");
  const { user, isGuest } = useAuth();
  const { openUpgrade } = useGuestUpgrade();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isGuest || !user) {
      setShow(false);
      return;
    }
    if (typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY)) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const pets = await listPersonalPets(user.uid);
        if (!cancelled && pets.length > 0) setShow(true);
      } catch {
        // Non-critical surface — stay hidden on read failure.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isGuest, user]);

  function dismiss() {
    if (typeof window !== "undefined") {
      localStorage.setItem(DISMISS_KEY, "1");
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-mango-brand/40 bg-mango-brand-tint/60 p-4 dark:border-mango-brand/30 dark:bg-mango-brand/10">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-mango-brand text-white">
        <Sparkles className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-mango-ink">{t("title")}</p>
        <p className="mt-0.5 text-sm text-mango-ink-2">{t("body")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openUpgrade}
            className="h-9 rounded-lg bg-mango-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-mango-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t("cta")}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="h-9 rounded-lg px-4 text-sm font-semibold text-mango-ink-2 transition-colors hover:bg-mango-bg-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
          >
            {t("dismiss")}
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("dismiss")}
        className="shrink-0 rounded-lg p-1 text-mango-ink-2 transition-colors hover:bg-mango-bg-alt"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
