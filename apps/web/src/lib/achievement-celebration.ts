import { ACHIEVEMENTS, type Achievement } from "@/lib/types";

/** newly-earned detection for the unlock celebration (spec §H).
 *
 *  The achievements page only reads existing grants — it can't tell "just
 *  unlocked" from "had it for weeks". We bridge that gap on the client:
 *  a per-user localStorage set of already-celebrated ids. On first ever
 *  load we SEED that set with the current grants (so existing users don't
 *  get a flood) and celebrate nothing; thereafter only ids that appear
 *  AFTER the baseline fire the modal. The unlock push deep-link
 *  (`?unlocked=<id,...>`) bypasses the diff entirely — the push already
 *  means "you just earned this".
 */

const STORAGE_PREFIX = "mango.celebratedAchievements.";

/** id → Achievement, for resolving grant ids / deep-link ids to catalogue
 *  entries (and silently dropping anything unknown). */
const BY_ID: ReadonlyMap<string, Achievement> = new Map(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);

export function achievementById(id: string): Achievement | undefined {
  return BY_ID.get(id);
}

function storageKey(uid: string): string {
  return STORAGE_PREFIX + uid;
}

/** The set of achievement ids already celebrated on this device for this
 *  user. Returns null when no record exists yet (→ caller seeds a baseline
 *  rather than celebrating every pre-existing badge). SSR / disabled
 *  storage degrades to an empty set so nothing throws. */
export function loadCelebrated(uid: string): Set<string> | null {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey(uid));
    if (raw == null) return null;
    const arr = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function saveCelebrated(uid: string, ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(uid), JSON.stringify([...ids]));
  } catch {
    // Storage full / blocked (private mode) — non-fatal; worst case the
    // modal may replay a badge on a later visit.
  }
}

/** Resolve a `?unlocked=walk-1,dist-5` deep-link value to catalogue
 *  entries, preserving order and dropping unknown / duplicate ids. */
export function parseUnlockedParam(value: string | null): Achievement[] {
  if (!value) return [];
  const seen = new Set<string>();
  const out: Achievement[] = [];
  for (const raw of value.split(",")) {
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const a = BY_ID.get(id);
    if (a) out.push(a);
  }
  return out;
}

/** Granted ids not yet seen (celebrated or already queued). Returns
 *  catalogue entries in canonical ACHIEVEMENTS order for a stable
 *  multi-badge strip. */
export function newlyEarned(
  grantedIds: Iterable<string>,
  seen: ReadonlySet<string>,
): Achievement[] {
  const granted = new Set(grantedIds);
  return ACHIEVEMENTS.filter((a) => granted.has(a.id) && !seen.has(a.id));
}
