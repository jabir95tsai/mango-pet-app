import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
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
