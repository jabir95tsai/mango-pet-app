/**
 * iOS leaderboard reads (P4a) — realtime onSnapshot, mirroring web
 * apps/web/src/lib/firebase/leaderboards.ts. Cloud Functions write the entry
 * docs (recompute* realtime + aggregate* cron); the client is read-only.
 * Paths: leaderboards/{periodKey}/entries (human, keyed uid) and
 * dogLeaderboards/{periodKey}/entries (dog, keyed petId). periodKey comes from
 * @mango/shared-business so iOS reads the SAME period the functions write.
 *
 * ⚠️ Callers MUST keep the returned unsubscribe and call it on unmount /
 * background — multiple live listeners drain Firestore quota (master plan risk 3).
 */
import firestore from "@react-native-firebase/firestore";
import { periodKey } from "@mango/shared-business";
import type {
  DogLeaderboardEntry,
  LeaderboardEntry,
  LeaderboardPeriod,
} from "@mango/shared-types";

export function subscribeLeaderboard(
  period: LeaderboardPeriod,
  onChange: (entries: LeaderboardEntry[]) => void,
  onError?: (err: unknown) => void,
  max = 100,
): () => void {
  const key = periodKey(period);
  return firestore()
    .collection("leaderboards")
    .doc(key)
    .collection("entries")
    .orderBy("totalScore", "desc")
    .limit(max)
    .onSnapshot(
      (snap) => onChange(snap.docs.map((d) => d.data() as LeaderboardEntry)),
      (err) => onError?.(err),
    );
}

export function subscribeDogLeaderboard(
  period: LeaderboardPeriod,
  onChange: (entries: DogLeaderboardEntry[]) => void,
  onError?: (err: unknown) => void,
  max = 100,
): () => void {
  const key = periodKey(period);
  return firestore()
    .collection("dogLeaderboards")
    .doc(key)
    .collection("entries")
    .orderBy("totalScore", "desc")
    .limit(max)
    .onSnapshot(
      (snap) => onChange(snap.docs.map((d) => d.data() as DogLeaderboardEntry)),
      (err) => onError?.(err),
    );
}
