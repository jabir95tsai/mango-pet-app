/**
 * Local walk drafts — AsyncStorage port of apps/web/src/lib/walk-drafts.ts.
 *
 * A finalized tracked walk is stored under a per-uid, per-walkId key BEFORE
 * the server write and removed once the server acknowledges it. If the write
 * fails (offline, rules rejection, app killed while waiting for the ack), the
 * walks home lists the leftover drafts with Retry + per-draft Discard.
 *
 * Keys are byte-identical to web:
 *   mango.walks.pending.v1.{uid}.{walkId}    → JSON draft
 *   mango.walks.discarded.v1.{uid}.{walkId}  → "1" (tombstone: an old callback
 *                                              can never recreate the draft)
 *
 * Differences from web: everything is async (AsyncStorage), and the draft
 * carries the score precomputed at stop (`score`) instead of the pet object
 * (`scorePet` is not serialisable — its birthday is a Timestamp).
 */
import { AppState, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { CreateWalkInput } from "./walks";

/** A finalized walk waiting for its server ack. Always has an id + score. */
export type WalkDraft = Omit<CreateWalkInput, "scorePet" | "walkId" | "score"> & {
  scorePet: null;
  walkId: string;
  score: number;
};

const PREFIX = "mango.walks.pending.v1.";
const DISCARDED_PREFIX = "mango.walks.discarded.v1.";

function draftKey(uid: string, walkId: string): string {
  return `${PREFIX}${uid}.${walkId}`;
}

function discardedKey(uid: string, walkId: string): string {
  return `${DISCARDED_PREFIX}${uid}.${walkId}`;
}

/** Thrown by storeWalkDraft when the walk was discarded on this device. */
export class WalkDraftDiscardedError extends Error {
  constructor() {
    super("This local walk draft was discarded.");
    this.name = "WalkDraftDiscardedError";
  }
}

/** Keep a finalized walk until the server acknowledges it. Each account and
 *  walk has its own key, so a new session cannot replace a failed earlier one. */
export async function storeWalkDraft(draft: WalkDraft): Promise<void> {
  if (await wasWalkDraftDiscarded(draft.walkerUid, draft.walkId)) {
    throw new WalkDraftDiscardedError();
  }
  const serialised = {
    ...draft,
    scorePet: null,
    startedAt: draft.startedAt.toISOString(),
    endedAt: draft.endedAt.toISOString(),
  };
  await AsyncStorage.setItem(draftKey(draft.walkerUid, draft.walkId), JSON.stringify(serialised));
}

export async function removeWalkDraft(uid: string, walkId: string): Promise<void> {
  await AsyncStorage.removeItem(draftKey(uid, walkId));
}

/** Only local state. The marker prevents an old callback recreating it. */
export async function discardWalkDraft(uid: string, walkId: string): Promise<void> {
  await AsyncStorage.setItem(discardedKey(uid, walkId), "1");
  await removeWalkDraft(uid, walkId);
}

export async function wasWalkDraftDiscarded(uid: string, walkId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(discardedKey(uid, walkId))) !== null;
}

function parseDraft(uid: string, name: string, raw: string | null): WalkDraft | null {
  try {
    const data = JSON.parse(raw ?? "null") as Record<string, unknown> | null;
    if (!data || data.walkerUid !== uid || typeof data.walkId !== "string") return null;
    if (name !== draftKey(uid, data.walkId)) return null;
    if (typeof data.petId !== "string" || typeof data.score !== "number") return null;
    const startedAt = new Date(String(data.startedAt));
    const endedAt = new Date(String(data.endedAt));
    if (!Number.isFinite(startedAt.getTime()) || !Number.isFinite(endedAt.getTime())) return null;
    return { ...(data as unknown as WalkDraft), scorePet: null, startedAt, endedAt };
  } catch {
    // One malformed local entry must not hide other recoverable walks.
    return null;
  }
}

/** Every pending (not discarded) draft for `uid`, oldest start first. */
export async function listWalkDrafts(uid: string): Promise<WalkDraft[]> {
  const prefix = `${PREFIX}${uid}.`;
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(prefix));
  if (keys.length === 0) return [];
  const entries = await AsyncStorage.multiGet(keys);
  const drafts: WalkDraft[] = [];
  for (const [name, raw] of entries) {
    const draft = parseDraft(uid, name, raw);
    if (draft) drafts.push(draft);
  }
  if (drafts.length === 0) return [];
  const markers = await AsyncStorage.multiGet(drafts.map((d) => discardedKey(uid, d.walkId)));
  const discarded = new Set(markers.filter(([, v]) => v !== null).map(([k]) => k));
  return drafts
    .filter((d) => !discarded.has(discardedKey(uid, d.walkId)))
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
}

/**
 * Retry hint — the iOS stand-in for web's onWalkReconnect (NetInfo is not
 * installed). Returning to the foreground is only a HINT that a retry may now
 * succeed, never proof that Firebase is reachable: one attempt per
 * background→active transition, no timer/polling loop.
 */
export function onWalkRetryHint(retry: () => void, attemptInitially = false): () => void {
  let previous: AppStateStatus = AppState.currentState;
  let disposed = false;
  const sub = AppState.addEventListener("change", (next) => {
    const wasAway = previous !== "active";
    previous = next;
    if (!disposed && next === "active" && wasAway) retry();
  });
  if (attemptInitially) retry();
  return () => {
    disposed = true;
    sub.remove();
  };
}
