"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Globe, Lock, Trophy, Users, type LucideIcon } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { getAppUser, updateLeaderboardVisibility } from "@/lib/firebase/users";
import type { LeaderboardVisibility } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Settings → "排行榜可見度" section (leaderboard v2, spec ③). One
 * master switch for whether the user's dogs appear on the dog board,
 * with three choices: public (all-app + friends, the default),
 * friends-only, or off. Writes `users/{uid}.leaderboardVisibility`;
 * the backend's syncDogEntryVisibility trigger fans the change out to
 * the user's dog entries — the client never touches dog entries.
 *
 * Absent value reads as 'public' (default opt-in). Selection is
 * optimistic with rollback-on-error, matching the other Settings
 * toggles (EngagementPushSection / WalkAutoPhotoSection).
 */
const OPTIONS: { value: LeaderboardVisibility; icon: LucideIcon }[] = [
  { value: "public", icon: Globe },
  { value: "friends", icon: Users },
  { value: "off", icon: Lock },
];

export function LeaderboardVisibilitySection() {
  const t = useTranslations("Settings.leaderboardVisibility");
  const { user } = useAuth();
  const [value, setValue] = useState<LeaderboardVisibility>("public");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const u = await getAppUser(user.uid);
        // Absent → 'public' (default opt-in).
        if (!cancelled) setValue(u?.leaderboardVisibility ?? "public");
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

  const handleSelect = useCallback(
    async (next: LeaderboardVisibility) => {
      if (!user || pending || next === value) return;
      const prev = value;
      // Optimistic — flip locally first so the choice feels instant,
      // then write. On error roll back AND surface the failure.
      setValue(next);
      setPending(true);
      setError(null);
      try {
        await updateLeaderboardVisibility(user.uid, next);
      } catch (err) {
        setValue(prev);
        setError(err instanceof Error ? err.message : "Failed to save");
      } finally {
        setPending(false);
      }
    },
    [user, value, pending],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          <Trophy className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{t("title")}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {t("subtitle")}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-zinc-500">{t("loading")}</p>
      ) : (
        <div
          role="radiogroup"
          aria-label={t("title")}
          className="flex flex-col gap-2"
        >
          {OPTIONS.map(({ value: optValue, icon: Icon }) => {
            const selected = value === optValue;
            return (
              <button
                key={optValue}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={pending}
                onClick={() => handleSelect(optValue)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  selected
                    ? "border-amber-400 bg-amber-50 dark:border-amber-500/50 dark:bg-amber-500/10"
                    : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900",
                  pending && "cursor-not-allowed opacity-60",
                )}
              >
                <Icon
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    selected
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-zinc-500 dark:text-zinc-400",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t(`${optValue}.label`)}</p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {t(`${optValue}.hint`)}
                  </p>
                </div>
                {selected && (
                  <Check className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
