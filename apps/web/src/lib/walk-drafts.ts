import type { CreateWalkArgs } from "./firebase/walks";

export type WalkDraft = CreateWalkArgs & { walkId: string };
const PREFIX = "mango.walks.pending.v1.";
const DISCARDED_PREFIX = "mango.walks.discarded.v1.";

function key(uid: string, walkId: string) {
  return `${PREFIX}${uid}.${walkId}`;
}

/** Keep finalized walks until the server acknowledges them. Each account and
 * walk has its own key, so a new session cannot replace a failed earlier one. */
export function storeWalkDraft(draft: WalkDraft, storage: Storage = localStorage) {
  if (storage.getItem(`${DISCARDED_PREFIX}${draft.walkerUid}.${draft.walkId}`)) {
    throw new Error("This local walk draft was discarded.");
  }
  storage.setItem(key(draft.walkerUid, draft.walkId), JSON.stringify(draft));
}

export function removeWalkDraft(uid: string, walkId: string, storage: Storage = localStorage) {
  storage.removeItem(key(uid, walkId));
}

/** Only local state. The marker prevents an old tab/callback recreating it. */
export function discardWalkDraft(uid: string, walkId: string, storage: Storage = localStorage) {
  storage.setItem(`${DISCARDED_PREFIX}${uid}.${walkId}`, "1");
  removeWalkDraft(uid, walkId, storage);
}

export function wasWalkDraftDiscarded(uid: string, walkId: string, storage: Storage = localStorage) {
  return storage.getItem(`${DISCARDED_PREFIX}${uid}.${walkId}`) !== null;
}

export function listWalkDrafts(uid: string, storage: Storage = localStorage): WalkDraft[] {
  const prefix = `${PREFIX}${uid}.`;
  const drafts: WalkDraft[] = [];
  for (let i = 0; i < storage.length; i++) {
    const name = storage.key(i);
    if (!name?.startsWith(prefix)) continue;
    try {
      const data = JSON.parse(storage.getItem(name) ?? "null");
      if (!data || data.walkerUid !== uid || typeof data.walkId !== "string"
        || name !== key(uid, data.walkId)) continue;
      if (wasWalkDraftDiscarded(uid, data.walkId, storage)) continue;
      const startedAt = new Date(data.startedAt);
      const endedAt = new Date(data.endedAt);
      if (!Number.isFinite(startedAt.getTime()) || !Number.isFinite(endedAt.getTime())) continue;
      drafts.push({ ...data, startedAt, endedAt });
    } catch {
      // One malformed local entry must not hide other recoverable walks.
    }
  }
  return drafts;
}

/** Connectivity is only a retry hint, never proof that Firebase is reachable.
 * One attempt per real offline→online transition; no timer/polling loop. */
export function onWalkReconnect(retry: () => void, attemptInitially = false) {
  let offline = navigator.onLine === false;
  let disposed = false;
  const markOffline = () => { offline = true; };
  const retryOnline = () => {
    if (disposed || !offline) return;
    offline = false;
    retry();
  };
  window.addEventListener("offline", markOffline);
  window.addEventListener("online", retryOnline);
  if (attemptInitially && !offline) retry();
  return () => {
    disposed = true;
    window.removeEventListener("offline", markOffline);
    window.removeEventListener("online", retryOnline);
  };
}
