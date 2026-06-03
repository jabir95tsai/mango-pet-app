"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { subscribeEarnedAchievements } from "@/lib/firebase/achievements";
import {
  loadCelebrated,
  newlyEarned,
  parseUnlockedParam,
  saveCelebrated,
} from "@/lib/achievement-celebration";
import type { Achievement } from "@/lib/types";
import { CelebrationModal } from "./celebration-modal";

/** App-layer overlay that fires the unlock celebration (spec §H). Mounted
 *  once in the /app shell so it can pop after a walk, on app open, or from a
 *  push deep-link — independent of which page is showing.
 *
 *  Detection (no backend change — the page already only reads grants):
 *  - Realtime listener on `users/{uid}/achievements`. The celebrated-set
 *    lives in localStorage and starts EMPTY. So an existing user's first
 *    open diffs every current grant (including the ops backfill) as "new"
 *    and gets one celebration — spec §H.1. We deliberately do NOT seed the
 *    set to the current grants on first load (that would silently swallow
 *    the first-open celebration). A brand-new 0-badge user has no grants, so
 *    the diff is empty and nothing pops.
 *  - `?unlocked=<id,...>` deep-link (from the unlock push) opens the modal
 *    immediately, then the param is stripped so a refresh won't replay it.
 *  Dismissing a batch writes its ids into the celebrated set, so it never
 *  replays on the next visit.
 */
export function AchievementCelebrationProvider() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [queue, setQueue] = useState<Achievement[][]>([]);
  // Ids already celebrated OR currently queued — the in-memory guard that
  // keeps a snapshot from re-queueing the same badge before it's dismissed.
  const seenRef = useRef<Set<string>>(new Set());
  const uidRef = useRef<string | null>(null);

  // Reset the baseline + handle the push deep-link whenever the user changes.
  useEffect(() => {
    if (!uid) {
      uidRef.current = null;
      seenRef.current = new Set();
      setQueue([]);
      return;
    }
    if (uidRef.current === uid) return;
    uidRef.current = uid;
    seenRef.current = loadCelebrated(uid) ?? new Set();

    const params = new URLSearchParams(window.location.search);
    const unlocked = parseUnlockedParam(params.get("unlocked"));
    if (unlocked.length > 0) {
      unlocked.forEach((a) => seenRef.current.add(a.id));
      setQueue((q) => [...q, unlocked]);
      params.delete("unlocked");
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash,
      );
    }
  }, [uid]);

  // Realtime grant listener → diff against the seen set.
  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeEarnedAchievements(
      uid,
      (grants) => {
        const ids = grants.map((g) => g.achievementId);
        // seenRef was seeded from the (possibly empty) celebrated set when the
        // uid changed; anything granted but not yet seen is newly-earned. On a
        // first open with a non-empty celebrated set absent, that's every
        // grant → one first-open celebration (§H.1).
        const fresh = newlyEarned(ids, seenRef.current);
        if (fresh.length > 0) {
          fresh.forEach((a) => seenRef.current.add(a.id));
          setQueue((q) => [...q, fresh]);
        }
      },
      // Read denied / offline — celebration is best-effort, fail silent.
      () => {},
    );
    return () => unsub();
  }, [uid]);

  if (!uid || queue.length === 0) return null;

  const current = queue[0];
  const dismiss = () => {
    const celebrated = loadCelebrated(uid) ?? new Set<string>();
    current.forEach((a) => celebrated.add(a.id));
    saveCelebrated(uid, celebrated);
    setQueue((q) => q.slice(1));
  };

  return (
    <CelebrationModal
      key={current.map((a) => a.id).join(",")}
      badges={current}
      onClose={dismiss}
    />
  );
}
