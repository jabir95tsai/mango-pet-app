import type { CreateWalkArgs } from "./firebase/walks";

export type WalkDraft = CreateWalkArgs & { walkId: string };
const PREFIX = "mango.walks.pending.v1.";

function key(uid: string, walkId: string) {
  return `${PREFIX}${uid}.${walkId}`;
}

/** Keep finalized walks until the server acknowledges them. Each account and
 * walk has its own key, so a new session cannot replace a failed earlier one. */
export function storeWalkDraft(draft: WalkDraft, storage: Storage = localStorage) {
  storage.setItem(key(draft.walkerUid, draft.walkId), JSON.stringify(draft));
}

export function removeWalkDraft(uid: string, walkId: string, storage: Storage = localStorage) {
  storage.removeItem(key(uid, walkId));
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
