"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { SmilePlus } from "lucide-react";
import { getMyReaction, setReaction } from "@/lib/firebase/posts";
import { REACTION_EMOJIS, type ReactionEmoji } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  postId: string;
  uid: string;
  counts: Record<ReactionEmoji, number>;
  onChange?: (updates: Record<ReactionEmoji, number>) => void;
};

const DEFAULT_EMOJI: ReactionEmoji = "❤️";
const LONG_PRESS_MS = 450;

/**
 * Facebook-style reaction control (feed-comments-and-reactions-v2 §B).
 *
 * Default surface = one ❤️ toggle + a summary cluster (which emojis
 * appeared + total count). Tap the button to set/remove ❤️ (or remove
 * whatever you currently picked). Long-press it — or use the focusable
 * "more reactions" button / mouse hover — to open a 5-emoji tray and
 * replace your single reaction.
 *
 * Backend model is unchanged: still one reaction per user
 * (setReaction / reactions/{uid} / denormalised reactionCounts). This is
 * purely a front-end interaction rework.
 *
 * a11y: long-press is unreachable by keyboard / screen readers, so the
 * "more reactions" button (aria-haspopup) is the accessible path — it
 * opens the tray and moves focus to the first emoji; every tray emoji
 * has an aria-label; Escape closes and restores focus. The pop animation
 * is disabled under prefers-reduced-motion.
 */
export function EmojiReactions({ postId, uid, counts, onChange }: Props) {
  const tP = useTranslations("Post");
  const [mine, setMine] = useState<ReactionEmoji | null>(null);
  const [pending, setPending] = useState(false);
  const [localCounts, setLocalCounts] = useState(counts);
  const [trayOpen, setTrayOpen] = useState(false);
  // Drives the enter transition — flipped on the frame after mount so the
  // tray animates from hidden→shown (snaps under reduced-motion).
  const [trayShown, setTrayShown] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const firstEmojiRef = useRef<HTMLButtonElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = useRef(false);
  // Only steal focus into the tray when it was opened deliberately
  // (keyboard / "more" button), never on mouse-hover or touch long-press.
  const focusFirstRef = useRef(false);

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

  // Tray enter-animation gate.
  useEffect(() => {
    if (!trayOpen) {
      setTrayShown(false);
      return;
    }
    const id = requestAnimationFrame(() => setTrayShown(true));
    return () => cancelAnimationFrame(id);
  }, [trayOpen]);

  // Move focus to the first tray emoji when opened via keyboard / the
  // "more" button.
  useEffect(() => {
    if (trayOpen && focusFirstRef.current) {
      firstEmojiRef.current?.focus();
      focusFirstRef.current = false;
    }
  }, [trayOpen]);

  // Dismiss the tray on any pointer-down outside the control (covers
  // touch tap-away + desktop click-away; hover-out also closes via
  // onPointerLeave below).
  useEffect(() => {
    if (!trayOpen) return;
    function onDocPointerDown(e: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setTrayOpen(false);
      }
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [trayOpen]);

  // Commit a reaction change with optimistic counts + rollback on error.
  // `next === mine` is a no-op; passing the current emoji again from the
  // tray therefore can't happen (callers pass null to clear).
  function commit(next: ReactionEmoji | null) {
    if (pending || next === mine) return;
    const prevMine = mine;
    const prevCounts = localCounts;

    const optimistic = { ...localCounts };
    if (prevMine) {
      optimistic[prevMine] = Math.max(0, (optimistic[prevMine] ?? 0) - 1);
    }
    if (next) optimistic[next] = (optimistic[next] ?? 0) + 1;

    setLocalCounts(optimistic);
    setMine(next);
    onChange?.(optimistic);
    setPending(true);

    setReaction(postId, uid, next)
      .catch(() => {
        // Roll back AND surface by reverting — a silent stick would feel
        // like the tap "didn't take".
        setLocalCounts(prevCounts);
        setMine(prevMine);
        onChange?.(prevCounts);
      })
      .finally(() => setPending(false));
  }

  function handleToggle() {
    // Tap the main button: remove whatever you have, else set ❤️.
    commit(mine ? null : DEFAULT_EMOJI);
  }

  function handlePick(emoji: ReactionEmoji) {
    // Tray pick: replace with the chosen emoji, or remove if you tapped
    // the one you already have.
    commit(mine === emoji ? null : emoji);
    setTrayOpen(false);
    moreBtnRef.current?.focus();
  }

  // ── Long-press on the main button → open tray (touch + mouse hold) ──
  function startLongPress() {
    longPressedRef.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressedRef.current = true;
      setTrayOpen(true);
    }, LONG_PRESS_MS);
  }
  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }
  function handleMainClick() {
    // Swallow the click that follows a long-press (it already opened the
    // tray); otherwise it's a real tap → toggle.
    if (longPressedRef.current) {
      longPressedRef.current = false;
      return;
    }
    handleToggle();
  }

  useEffect(() => cancelLongPress, []);

  const total = REACTION_EMOJIS.reduce((s, e) => s + (localCounts[e] ?? 0), 0);
  const present = REACTION_EMOJIS.filter((e) => (localCounts[e] ?? 0) > 0);
  const mainEmoji = mine ?? DEFAULT_EMOJI;
  const mainLabel = mine
    ? tP("yourReaction", { emoji: mine })
    : tP("react", { emoji: DEFAULT_EMOJI });

  return (
    <div
      ref={wrapperRef}
      className="relative inline-flex items-center gap-2"
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setTrayOpen(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setTrayOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && trayOpen) {
          setTrayOpen(false);
          moreBtnRef.current?.focus();
        }
      }}
    >
      {/* Main toggle — tap = ❤️/remove, long-press = open tray. */}
      <button
        type="button"
        onClick={handleMainClick}
        onPointerDown={startLongPress}
        onPointerUp={cancelLongPress}
        onPointerLeave={cancelLongPress}
        disabled={pending}
        aria-label={mainLabel}
        aria-pressed={mine !== null}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep disabled:opacity-60",
          mine
            ? "bg-amber-100 ring-1 ring-amber-400 dark:bg-amber-500/20"
            : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700",
        )}
      >
        <span aria-hidden="true" className="text-base leading-none">
          {mainEmoji}
        </span>
      </button>

      {/* Accessible tray opener (keyboard / screen-reader path + desktop
          click). Long-press / hover are progressive enhancements on top. */}
      <button
        ref={moreBtnRef}
        type="button"
        onClick={() => {
          focusFirstRef.current = true;
          setTrayOpen((o) => !o);
        }}
        aria-label={tP("moreReactions")}
        aria-haspopup="menu"
        aria-expanded={trayOpen}
        className="grid size-9 place-items-center rounded-full bg-zinc-100 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
      >
        <SmilePlus className="size-4" aria-hidden="true" />
      </button>

      {/* Summary — which emojis appeared + total count (FB-style). */}
      {total > 0 && (
        <span
          className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400"
          aria-label={tP("reactionCount", { count: total })}
        >
          <span aria-hidden="true" className="inline-flex">
            {present.map((e) => (
              <span key={e} className="-ml-0.5 first:ml-0 leading-none">
                {e}
              </span>
            ))}
          </span>
          <span aria-hidden="true" className="tabular-nums">
            {total}
          </span>
        </span>
      )}

      {/* Reaction tray */}
      {trayOpen && (
        <div
          role="menu"
          aria-label={tP("pickReaction")}
          className={cn(
            "absolute bottom-full left-0 z-50 mb-2 flex items-center gap-1 rounded-full border border-zinc-200 bg-white p-1 shadow-lg transition duration-150 ease-out dark:border-zinc-700 dark:bg-zinc-900 motion-reduce:transition-none",
            trayShown
              ? "translate-y-0 scale-100 opacity-100"
              : "translate-y-1 scale-90 opacity-0",
          )}
          style={{ transformOrigin: "bottom left" }}
        >
          {REACTION_EMOJIS.map((emoji, idx) => (
            <button
              key={emoji}
              ref={idx === 0 ? firstEmojiRef : undefined}
              type="button"
              role="menuitemradio"
              aria-checked={mine === emoji}
              onClick={() => handlePick(emoji)}
              disabled={pending}
              aria-label={tP("react", { emoji })}
              className={cn(
                "grid size-10 place-items-center rounded-full text-xl transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep motion-reduce:transition-none motion-reduce:hover:scale-100",
                mine === emoji && "bg-amber-100 dark:bg-amber-500/20",
              )}
            >
              <span aria-hidden="true">{emoji}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
