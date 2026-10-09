/**
 * iOS walk-screen READ layer — pets / walks / family-scope resolution via
 * @react-native-firebase/firestore. Query shapes mirror the web helpers
 * byte-for-byte so both platforms read the same docs through the same indexes:
 *   - resolveCurrentFamilyId → apps/web family-provider `resolveCurrentFamily`
 *   - listPetsForScope       → apps/web/src/lib/firebase/pets.ts listPets / listPersonalPets
 *   - listWalksForScope      → apps/web/src/lib/firebase/walks.ts listWalks / listPersonalWalks
 *
 * WRITES go through `@/lib/walks` createWalk (P1a backend) — never write a walk
 * doc from here. Reads are cast to the shared types; the @react-native-firebase
 * Timestamp has the same `toMillis()` surface the consumers use.
 */
import firestore from "@react-native-firebase/firestore";
import type { Pet, Walk } from "@mango/shared-types";

import { computeStreak } from "@/lib/walk-stats";

/** Walks list cap — same default the web recent-list pulls. */
const WALKS_LIMIT = 50;

/** First page the Walks home loads (see listWalksForStats). */
export const WALKS_STATS_INITIAL_LIMIT = 60;

/**
 * Resolve the signed-in user's active family id, mirroring web:
 * no `familyIds` → personal mode (null); else `currentFamilyId ?? familyIds[0]`.
 *
 * ⚠️ One-shot use only (the root layout's landing decision, before the tabs
 * mount). Screens / data hooks MUST take the scope from FamilyContext
 * (`useFamilyScope()` in src/lib/use-family-scope.ts) — reading it here
 * bypasses family switches and turns read failures into personal mode (R08).
 */
export async function resolveCurrentFamilyId(
  uid: string,
): Promise<string | null> {
  const snap = await firestore().collection("users").doc(uid).get();
  const data = snap.data() as
    | { familyIds?: string[]; currentFamilyId?: string }
    | undefined;
  const familyIds = data?.familyIds ?? [];
  if (familyIds.length === 0) return null;
  return data?.currentFamilyId ?? familyIds[0];
}

/**
 * Read the user's auto-photo-share preference (walks-auto-photo-share). Default
 * ON — only an explicit `false` disables the start/end prompts, mirroring web
 * (`u?.walkPrefs?.autoPhotoShare !== false`). The toggle UI is P5 settings.
 */
export async function getAutoPhotoShare(uid: string): Promise<boolean> {
  try {
    const snap = await firestore().collection("users").doc(uid).get();
    const data = snap.data() as
      | { walkPrefs?: { autoPhotoShare?: boolean } }
      | undefined;
    return data?.walkPrefs?.autoPhotoShare !== false;
  } catch {
    return true; // best-effort: default ON
  }
}

/** Pets in the active scope. familyId set → family pets; null → personal. */
export async function listPetsForScope(
  familyId: string | null,
  uid: string,
): Promise<Pet[]> {
  const col = firestore().collection("pets");
  const q =
    familyId !== null
      ? col.where("familyId", "==", familyId).orderBy("createdAt", "asc")
      : col
          .where("ownerUid", "==", uid)
          .where("familyId", "==", null)
          .orderBy("createdAt", "asc");
  const snap = await q.get();
  return snap.docs.map(
    (d) => ({ ...(d.data() as object), petId: d.id }) as unknown as Pet,
  );
}

/**
 * Recent walks in the active scope (newest first). `max: null` = no limit
 * (web `withOptionalLimit(…, null)` — listWalks(familyId, null)).
 */
export async function listWalksForScope(
  familyId: string | null,
  uid: string,
  max: number | null = WALKS_LIMIT,
): Promise<Walk[]> {
  const col = firestore().collection("walks");
  const base =
    familyId !== null
      ? col.where("familyId", "==", familyId).orderBy("startedAt", "desc")
      : col
          .where("walkerUid", "==", uid)
          .where("familyId", "==", null)
          .orderBy("startedAt", "desc");
  const snap = await (max === null ? base : base.limit(max)).get();
  return snap.docs.map(
    (d) => ({ ...(d.data() as object), walkId: d.id }) as unknown as Walk,
  );
}

function walkStartMs(w: Walk): number {
  const ts = w.startedAt as { toMillis?: () => number } | undefined;
  return ts?.toMillis?.() ?? 0;
}

/** Monday 00:00 device-local (same anchor as walk-stats' week strip). */
function startOfWeekLocalMs(now: Date): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/**
 * Would walks OLDER than the loaded (newest-first, length === limit) page
 * change any Walks-home number? True when the page doesn't reach back past
 * this week / the trailing 7 days (week strip, km, count, weekly avg, today)
 * or when the current streak run reaches the oldest loaded day (an older walk
 * could extend it).
 */
function pageNeedsOlderWalks(page: Walk[], now: Date = new Date()): boolean {
  const oldestMs = walkStartMs(page[page.length - 1]);
  if (!oldestMs) return true; // malformed timestamps → be exact, load all
  const statsWindowStart = Math.min(
    startOfWeekLocalMs(now),
    now.getTime() - 7 * 86_400_000,
  );
  if (oldestMs >= statsWindowStart) return true;
  const dates = page
    .map((w) => walkStartMs(w))
    .filter((ms) => ms > 0)
    .map((ms) => new Date(ms));
  const streak = computeStreak(dates);
  if (streak === 0) return false;
  // computeStreak buckets by UTC day; the run covers
  // [newestDay - streak + 1, newestDay].
  const newestDay = Math.max(...dates.map((d) => Math.floor(d.getTime() / 86_400_000)));
  const oldestDay = Math.floor(oldestMs / 86_400_000);
  return newestDay - streak + 1 <= oldestDay;
}

/**
 * Walks for the Walks home (WALKS-12). Web loads the FULL history
 * (listWalks(familyId, null)) so its streak / week stats see everything. iOS
 * walk docs carry up to 500 GPS points each and the tab refetches on focus,
 * so an unconditional full read is too heavy for mobile. Instead:
 *   1. read the newest WALKS_STATS_INITIAL_LIMIT walks;
 *   2. if that is the whole history, or no older walk can change today /
 *      week / weekly-avg / streak numbers → done (identical stats to web);
 *   3. otherwise read the full history, exactly like web.
 * `complete` = the returned list is the full history (else call
 * listWalksForScope(familyId, uid, null) for "view all").
 */
export async function listWalksForStats(
  familyId: string | null,
  uid: string,
): Promise<{ walks: Walk[]; complete: boolean }> {
  const page = await listWalksForScope(familyId, uid, WALKS_STATS_INITIAL_LIMIT);
  if (page.length < WALKS_STATS_INITIAL_LIMIT) return { walks: page, complete: true };
  if (!pageNeedsOlderWalks(page)) return { walks: page, complete: false };
  const all = await listWalksForScope(familyId, uid, null);
  return { walks: all, complete: true };
}
