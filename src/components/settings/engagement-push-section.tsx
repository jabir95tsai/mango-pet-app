"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/components/family/family-provider";
import { getAppUser, updateEngagementOptOut } from "@/lib/firebase/users";
import { ENGAGEMENT_PUSH_TYPES, type EngagementPushType } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Settings → "Engagement push" section. Surfaces the four first-wave
 *  push types from docs/features/engagement-push-notifications.md and
 *  lets the user opt OUT of any of them. Ships BEFORE the actual cron
 *  functions go live so users always have a working off-switch the
 *  moment a push lands in their tray.
 *
 *  Opt-out state lives in `user.pushPrefs.engagementOptOut` as a string
 *  array of push-type ids. ON = id absent; OFF = id present. We read
 *  the user doc once on mount and update via the
 *  `updateEngagementOptOut` lib helper (arrayUnion/arrayRemove so two
 *  tabs flipping different toggles don't clobber each other). */
export function EngagementPushSection() {
  const t = useTranslations("Settings.engagementPush");
  const { user } = useAuth();
  const { family } = useFamily();
  const [optOut, setOptOut] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<EngagementPushType | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const u = await getAppUser(user.uid);
        if (!cancelled) {
          setOptOut(u?.pushPrefs?.engagementOptOut ?? []);
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

  const handleToggle = useCallback(
    async (type: EngagementPushType, isOn: boolean) => {
      if (!user) return;
      // Optimistic update — flip locally first so the toggle feels
      // instant, then write to Firestore. On error we roll back AND
      // surface the failure (a silent revert would feel like the
      // toggle "won't turn off").
      const next = isOn
        ? optOut.filter((s) => s !== type)
        : [...optOut, type];
      setOptOut(next);
      setPending(type);
      setError(null);
      try {
        await updateEngagementOptOut(user.uid, type, !isOn);
      } catch (err) {
        setOptOut(optOut);
        setError(err instanceof Error ? err.message : "Failed to save");
      } finally {
        setPending(null);
      }
    },
    [user, optOut],
  );

  // Spec: B2 family-milestone is disabled in personal mode (no other
  // family members to notify). The toggle still renders so users
  // discover the feature, but it's greyed out + non-interactive until
  // they join a family.
  const isPersonalMode = !family;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{t("title")}</p>
          <p className="text-xs text-zinc-500">{t("subtitle")}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-zinc-500">{t("loading")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
          {ENGAGEMENT_PUSH_TYPES.map((type) => {
            const isOn = !optOut.includes(type);
            const disabled =
              pending === type ||
              (type === "family-milestone" && isPersonalMode);
            return (
              <li
                key={type}
                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
              >
                <Bell
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    disabled
                      ? "text-zinc-300 dark:text-zinc-700"
                      : "text-zinc-500 dark:text-zinc-400",
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      disabled && "text-zinc-400 dark:text-zinc-600",
                    )}
                  >
                    {t(`${type}.label`)}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {type === "family-milestone" && isPersonalMode
                      ? t("familyOnlyHint")
                      : t(`${type}.hint`)}
                  </p>
                </div>
                {/* Tailwind-only switch — same vibe as PushToggle but
                    self-contained so we don't pull a new dep. */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={isOn}
                  aria-label={t(`${type}.label`)}
                  disabled={disabled}
                  onClick={() => handleToggle(type, isOn)}
                  className={cn(
                    "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isOn
                      ? "bg-amber-500"
                      : "bg-zinc-300 dark:bg-zinc-700",
                    disabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block size-5 rounded-full bg-white shadow-sm transition-transform",
                      isOn ? "translate-x-5" : "translate-x-0.5",
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
