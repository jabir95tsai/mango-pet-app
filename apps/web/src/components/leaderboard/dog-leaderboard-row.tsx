"use client";

import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { DogLeaderboardEntry } from "@/lib/types";

type Props = {
  rank: number;
  entry: DogLeaderboardEntry;
  /** True when this dog belongs to the signed-in user — amber highlight,
   *  same treatment the walker board gives "you". */
  highlight?: boolean;
  /** Set by useDogEntryGlow when this entry's lastUpdatedAt just bumped.
   *  Reuses the shared `leaderboard-row-glow` class (reduced-motion safe
   *  via globals.css). */
  isGlowing?: boolean;
};

function rankBadge(rank: number): { emoji: string; color: string } {
  if (rank === 1) return { emoji: "🥇", color: "text-amber-500" };
  if (rank === 2) return { emoji: "🥈", color: "text-zinc-400" };
  if (rank === 3) return { emoji: "🥉", color: "text-orange-500" };
  return { emoji: `${rank}`, color: "text-zinc-500" };
}

export function DogLeaderboardRow({ rank, entry, highlight, isGlowing }: Props) {
  const t = useTranslations("Leaderboard.dog");
  const { emoji, color } = rankBadge(rank);

  // Compact meta line, same rhythm as the walker row:
  // "{n} 次 · {km} km · 🔥 {streak} · 飼主 {owner}". Gamified stats lead
  // (always visible); the owner trails so it's what truncates first on
  // narrow screens — the photo + name already identify the dog.
  const meta = [
    t("walkCount", { count: entry.walkCount }),
    `${entry.totalDistanceKm.toFixed(1)} km`,
  ];
  if (entry.streakDays > 0) meta.push(`🔥 ${entry.streakDays}`);
  meta.push(t("byOwner", { owner: entry.ownerName }));

  return (
    <article
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 shadow-sm shadow-zinc-200/40 transition-colors dark:shadow-none",
        highlight
          ? "border-amber-400 bg-amber-100/70 dark:border-amber-500/50 dark:bg-amber-500/10"
          : "border-amber-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-950",
        isGlowing && "leaderboard-row-glow",
      )}
    >
      <div className={cn("w-8 text-center text-lg font-bold", color)}>
        {emoji}
      </div>
      <Avatar src={entry.petPhotoURL} name={entry.petName} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold">{entry.petName}</p>
          {entry.breed && (
            <span className="shrink-0 truncate rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              {entry.breed}
            </span>
          )}
          {highlight && (
            <span className="shrink-0 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white dark:text-zinc-950">
              {t("yours")}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-zinc-500">{meta.join(" · ")}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-lg font-bold tabular-nums text-amber-700 dark:text-amber-300">
          {entry.totalScore.toFixed(0)}
        </p>
        <p className="text-[10px] text-zinc-500">{t("scoreUnit")}</p>
      </div>
    </article>
  );
}
