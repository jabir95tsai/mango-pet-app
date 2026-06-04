"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { getAppUser, updateWalkAutoPhotoShare } from "@/lib/firebase/users";
import { cn } from "@/lib/utils";

/**
 * Settings → "遛狗自動拍照" section. Single toggle that controls
 * whether the walk-start + walk-end photo prompts (docs/features/
 * walks-auto-photo-share.md) fire. Default ON for every user (absent
 * walkPrefs / absent autoPhotoShare both treated as ON), so the
 * toggle ONLY ever ships an explicit `false` when the user opts out.
 *
 * Visual parity with EngagementPushSection's toggle so the Settings
 * page reads as one consistent surface. No new dep — same hand-rolled
 * Tailwind switch.
 */
export function WalkAutoPhotoSection() {
  const t = useTranslations("Settings.walkAutoPhoto");
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const u = await getAppUser(user.uid);
        if (!cancelled) {
          // Absent walkPrefs / absent autoPhotoShare → ON. Only
          // explicit `false` flips the toggle off.
          setEnabled(u?.walkPrefs?.autoPhotoShare !== false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleToggle = useCallback(async () => {
    if (!user || pending) return;
    const next = !enabled;
    setEnabled(next);
    setPending(true);
    setError(null);
    try {
      await updateWalkAutoPhotoShare(user.uid, next);
    } catch (err) {
      // Roll back AND surface — silent revert would feel like the
      // toggle "won't stay off" (matches EngagementPushSection).
      setEnabled(!next);
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setPending(false);
    }
  }, [user, enabled, pending]);

  const disabled = loading || pending;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-md)] bg-mango-brand-tint text-mango-brand-deep">
          <Camera className="size-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{t("title")}</p>
          <p className="mt-0.5 text-xs text-mango-ink-2">
            {t("body")}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={t("title")}
          disabled={disabled}
          onClick={handleToggle}
          className={cn(
            "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            enabled ? "bg-mango-brand" : "bg-mango-hairline",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          <span
            className={cn(
              "inline-block size-5 rounded-full bg-white shadow-sm transition-transform",
              enabled ? "translate-x-5" : "translate-x-0.5",
            )}
          />
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
