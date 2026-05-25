import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "./config";
import type { LeaderboardEntry, LeaderboardPeriod } from "@/lib/types";
import { isoWeekLabel, monthLabel } from "@/lib/scoring";

export function periodKey(period: LeaderboardPeriod, when = new Date()): string {
  switch (period) {
    case "weekly":
      return isoWeekLabel(when);
    case "monthly":
      return monthLabel(when);
    case "all_time":
      return "all_time";
  }
}

export async function listLeaderboard(
  period: LeaderboardPeriod,
  max = 100,
): Promise<LeaderboardEntry[]> {
  const key = periodKey(period);
  const ref = collection(getDb(), "leaderboards", key, "entries");
  const snap = await getDocs(
    query(ref, orderBy("totalScore", "desc"), limit(max)),
  );
  return snap.docs.map((d) => d.data() as LeaderboardEntry);
}

/** Realtime subscription to a leaderboard period. The realtime trigger
 *  (recomputeWalkerLeaderboards) writes individual entry docs as
 *  family members complete walks, so this listener fires within 1-2s
 *  of any score change — letting the row glow animation in
 *  useLeaderboardEntryGlow fire. */
export function subscribeLeaderboard(
  period: LeaderboardPeriod,
  onChange: (entries: LeaderboardEntry[]) => void,
  onError?: (err: unknown) => void,
  max = 100,
): Unsubscribe {
  const key = periodKey(period);
  const ref = collection(getDb(), "leaderboards", key, "entries");
  return onSnapshot(
    query(ref, orderBy("totalScore", "desc"), limit(max)),
    (snap) => onChange(snap.docs.map((d) => d.data() as LeaderboardEntry)),
    onError,
  );
}
