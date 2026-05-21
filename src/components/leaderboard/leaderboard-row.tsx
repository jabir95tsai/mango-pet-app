"use client";

import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry } from "@/lib/types";

type Props = {
  rank: number;
  entry: LeaderboardEntry;
  highlight?: boolean;
};

function rankBadge(rank: number): { emoji: string; color: string } {
  if (rank === 1) return { emoji: "🥇", color: "text-amber-500" };
  if (rank === 2) return { emoji: "🥈", color: "text-zinc-400" };
  if (rank === 3) return { emoji: "🥉", color: "text-orange-500" };
  return { emoji: `${rank}`, color: "text-zinc-500" };
}

export function LeaderboardRow({ rank, entry, highlight }: Props) {
  const { emoji, color } = rankBadge(rank);
  return (
    <article
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 shadow-sm shadow-zinc-200/40 transition-colors dark:shadow-none",
        highlight
          ? "border-emerald-300 bg-emerald-50/70 dark:border-emerald-500/50 dark:bg-emerald-500/10"
          : "border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-950",
      )}
    >
      <div className={cn("w-8 text-center text-lg font-bold", color)}>{emoji}</div>
      <Avatar src={entry.photoURL} name={entry.displayName} size={36} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{entry.displayName}</p>
        <p className="text-xs text-zinc-500">
          {entry.walkCount} 次 · {entry.totalDistanceKm.toFixed(1)} km
          {entry.streakDays > 0 && ` · 🔥 ${entry.streakDays}`}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-lg font-bold text-emerald-700 tabular-nums dark:text-emerald-300">
          {entry.totalScore.toFixed(0)}
        </p>
        <p className="text-[10px] text-zinc-500">分</p>
      </div>
    </article>
  );
}
