import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { getDb } from "./config";
import type { AchievementGrant, LifetimeStats } from "@/lib/types";

/** Lifetime walk stats doc — `users/{uid}/stats/lifetime`. Written only by
 *  the walk onCreate Cloud Function (covers ALL walks: family + personal,
 *  guests included). Absent for a brand-new user who hasn't walked yet →
 *  callers treat null as "all zeroes". Spec achievements-badges.md §C. */
export async function getLifetimeStats(
  uid: string,
): Promise<LifetimeStats | null> {
  const snap = await getDoc(doc(getDb(), "users", uid, "stats", "lifetime"));
  return snap.exists() ? (snap.data() as LifetimeStats) : null;
}

/** Earned-badge docs — `users/{uid}/achievements/{achievementId}`. Written
 *  once each (idempotent) by Cloud Functions; the client only reads. The
 *  doc id IS the achievement id, so we key by `achievementId`. */
export async function listEarnedAchievements(
  uid: string,
): Promise<AchievementGrant[]> {
  const snap = await getDocs(collection(getDb(), "users", uid, "achievements"));
  return snap.docs.map((d) => d.data() as AchievementGrant);
}

/** Realtime subscription to the earned-badge docs. Powers the app-layer
 *  unlock celebration: when a Cloud Function writes a new grant (right after
 *  a walk / pet / post), the snapshot fires and the celebration layer diffs
 *  it against the locally-celebrated set. Read-only listener; unsubscribes
 *  via the returned fn. Spec achievements-badges.md §H. */
export function subscribeEarnedAchievements(
  uid: string,
  cb: (grants: AchievementGrant[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    collection(getDb(), "users", uid, "achievements"),
    (snap) => cb(snap.docs.map((d) => d.data() as AchievementGrant)),
    (e) => onError?.(e),
  );
}

/** Live counts for the metrics not held in the lifetime-stats doc. Cheap
 *  aggregation reads (1 billed read each, no document download). `postCount`
 *  is skipped for guests (the social badges are guest-locked anyway) so a
 *  guest never pays for / is denied that query.
 *
 *  ⚠️ The pet count is constrained to `familyId == null` (personal pets) —
 *  that's the only rules-allowed shape. A bare `ownerUid == uid` query is
 *  permission-denied because a family pet the user owns needs an
 *  isFamilyMember() check the rules can't pre-verify for a list/aggregation
 *  query (matches `listPersonalPets`). Family-mode pets therefore don't feed
 *  the pet-badge PROGRESS bar, but the badge's EARNED state comes from the
 *  authoritative backend grant either way, so only an un-earned bar could
 *  under-count for a heavy family user. */
export async function getAchievementCounts(
  uid: string,
  opts: { includePosts: boolean },
): Promise<{ petCount: number; postCount: number }> {
  const db = getDb();
  const petCountP = getCountFromServer(
    query(
      collection(db, "pets"),
      where("ownerUid", "==", uid),
      where("familyId", "==", null),
    ),
  );
  const postCountP = opts.includePosts
    ? getCountFromServer(
        query(collection(db, "posts"), where("authorUid", "==", uid)),
      )
    : null;

  const [petSnap, postSnap] = await Promise.all([petCountP, postCountP]);
  return {
    petCount: petSnap.data().count,
    postCount: postSnap ? postSnap.data().count : 0,
  };
}
