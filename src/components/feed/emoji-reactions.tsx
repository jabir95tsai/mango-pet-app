"use client";

import { useEffect, useState } from "react";
import { getMyReaction, setReaction } from "@/lib/firebase/posts";
import { REACTION_EMOJIS, type ReactionEmoji } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  postId: string;
  uid: string;
  counts: Record<ReactionEmoji, number>;
  onChange?: (updates: Record<ReactionEmoji, number>) => void;
};

export function EmojiReactions({ postId, uid, counts, onChange }: Props) {
  const [mine, setMine] = useState<ReactionEmoji | null>(null);
  const [pending, setPending] = useState<ReactionEmoji | null>(null);
  const [localCounts, setLocalCounts] = useState(counts);

  useEffect(() => {
    setLocalCounts(counts);
  }, [counts]);

  useEffect(() => {
    let cancelled = false;
    getMyReaction(postId, uid).then((r) => {
      if (!cancelled) setMine(r);
    });
    return () => {
      cancelled = true;
    };
  }, [postId, uid]);

  async function handleClick(emoji: ReactionEmoji) {
    if (pending) return;
    const next = mine === emoji ? null : emoji;
    setPending(emoji);

    const optimistic = { ...localCounts };
    if (mine && mine !== next) optimistic[mine] = Math.max(0, optimistic[mine] - 1);
    if (next && next !== mine) optimistic[next] = (optimistic[next] ?? 0) + 1;
    setLocalCounts(optimistic);
    setMine(next);
    onChange?.(optimistic);

    try {
      await setReaction(postId, uid, next);
    } catch {
      setLocalCounts(counts);
      setMine(mine);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex gap-1 flex-wrap">
      {REACTION_EMOJIS.map((emoji) => {
        const active = mine === emoji;
        const count = localCounts[emoji] ?? 0;
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => handleClick(emoji)}
            disabled={pending !== null}
            className={cn(
              "inline-flex items-center gap-1 h-8 px-2.5 rounded-full text-sm transition-colors",
              active
                ? "bg-amber-100 dark:bg-amber-500/20 ring-1 ring-amber-400"
                : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700",
            )}
          >
            <span>{emoji}</span>
            {count > 0 && <span className="text-xs font-medium">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
