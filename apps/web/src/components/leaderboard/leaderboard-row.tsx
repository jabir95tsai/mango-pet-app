"use client";

import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry } from "@/lib/types";

type Props = {
  rank: number;
  entry: LeaderboardEntry;
  highlight?: boolean;
  /** Set by useLeaderboardEntryGlow when this entry's lastUpdatedAt
   *  just bumped (realtime trigger or daily cron). Adds the
   *  `leaderboard-row-glow` class which runs a 1.5s brand-color
   *  background pulse. Globally suppressed by prefers-reduced-motion
   *  via the existing rule in globals.css. */
  isGlowing?: boolean;
};

function rankBadge(rank: number): { emoji: string; color: string } {
  if (rank === 1) return { emoji: "🥇", color: "text-amber-500" };
  if (rank === 2) return { emoji: "🥈", color: "text-zinc-400" };
  if (rank === 3) return { emoji: "🥉", color: "text-orange-500" };
  return { emoji: `${rank}`, color: "text-zinc-500" };
}

export function LeaderboardRow({ rank, entry, highlight, isGlowing }: Props) {
  const t = useTranslations("Leaderboard");
  const { emoji, color } = rankBadge(rank);
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
      <div className={cn("w-8 text-center text-lg font-bold", color)}>{emoji}</div>
      <Avatar src={entry.photoURL} name={entry.displayName} size={36} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{entry.displayName}</p>
        <p className="text-xs text-zinc-500">
          {t("unitWalks", { count: entry.walkCount })} ·{" "}
          {entry.totalDistanceKm.toFixed(1)} km
          {entry.streakDays > 0 && ` · 🔥 ${entry.streakDays}`}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-lg font-bold text-amber-700 tabular-nums dark:text-amber-300">
          {entry.totalScore.toFixed(0)}
        </p>
        <p className="text-[10px] text-zinc-500">{t("unitScore")}</p>
      </div>
    </article>
  );
}
