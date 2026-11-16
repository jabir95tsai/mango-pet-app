/** Server-owned route lifecycle. Coordinates never live in the public Walk summary. */
import { isDeepStrictEqual } from "node:util";
import { getFirestore, Timestamp, type Firestore, type Transaction } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { assertAccountsActive } from "./account-mutation";

const SIX_HOURS = 21600000;
const FIVE_MINUTES = 300000;
type Point = { lat: number; lng: number; t: number; segment: number };
const fail = (code: "invalid-argument" | "failed-precondition" | "permission-denied" | "already-exists" | "not-found", message: string): never => { throw new HttpsError(code, message); };
function id(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) return fail("invalid-argument", "Invalid ID");
  return value;
}
function number(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) return fail("invalid-argument", "Invalid numeric value");
  return value;
}
function integer(value: unknown, min: number, max: number): number {
  const n = number(value, min, max);
  if (!Number.isSafeInteger(n)) return fail("invalid-argument", "Expected integer");
  return n;
}
function point(value: any, start: number, end: number): Point {
  if (!value || typeof value !== "object") return fail("invalid-argument", "Invalid point");
  return { lat: number(value.lat, -90, 90), lng: number(value.lng, -180, 180), t: integer(value.t, start, end), segment: integer(value.segment, 0, Number.MAX_SAFE_INTEGER) };
}
async function member(tx: Transaction, db: Firestore, familyId: string | null, uid: string): Promise<boolean> {
  return familyId !== null && ((await tx.get(db.doc(`families/${familyId}`))).data()?.memberUids ?? []).includes(uid);
}

/** Retain a permanent, coordinate-free fence; bounded deletion can retry safely. */
export async function eraseWalkRoute(db: Firestore, sessionId: string): Promise<void> {
  const ref = db.doc(`walkRouteSessions/${sessionId}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    tx.set(ref, { sessionId, status: "deleted", walkerUid: snap.data()!.walkerUid, petId: snap.data()!.petId });
    tx.delete(db.doc(`walkLiveLocations/${sessionId}`));
  });
  // The tombstone blocks append before collection deletion begins.
  await db.recursiveDelete(ref.collection("chunks"));
}

export const cleanupDeletedWalkRoute = onDocumentDeleted(
  { document: "walks/{walkId}", region: "asia-east1", retry: true },
  async (event) => { await eraseWalkRoute(getFirestore(), event.params.walkId); },
);

export const manageWalkRoute = onCall({ region: "asia-east1", cors: true }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign-in required");
  const data = req.data;
  if (!data || typeof data !== "object") return fail("invalid-argument", "Missing operation");
  const sessionId = id(data.sessionId);
  const op = data.op;
  if (!["start", "append", "publish", "end", "finalize", "delete"].includes(op)) return fail("invalid-argument", "Unknown operation");
  const db = getFirestore();
  const ref = db.doc(`walkRouteSessions/${sessionId}`);
  const live = db.doc(`walkLiveLocations/${sessionId}`);
  const walk = db.doc(`walks/${sessionId}`);
  const now = Date.now();
  const result = await db.runTransaction(async (tx) => {
    await assertAccountsActive(tx, db, [uid]);
    const snap = await tx.get(ref);
    const s = snap.data();
    if (s?.status === "deleted" && op === "delete") return { sessionId, status: "deleted" };
    if (s?.status === "deleted") return fail("failed-precondition", "Session was deleted");
    if (op === "start") {
      const petId = id(data.petId);
      const familyId = data.familyId === null ? null : id(data.familyId);
      const startedAtMs = integer(data.startedAtMs, 1, now);
      if (typeof data.shareLive !== "boolean" || (familyId === null && data.shareLive)) return fail("invalid-argument", "Invalid sharing choice");
      if (s) {
        if (s.walkerUid !== uid) return fail("permission-denied", "Not session owner");
        if (s.petId !== petId || s.familyId !== familyId || s.startedAt.toMillis() !== startedAtMs || s.shareLive !== data.shareLive) return fail("already-exists", "Session ID already reserved");
        return { sessionId, status: s.status, expiresAtMs: s.expiresAt.toMillis() };
      }
      const pet = (await tx.get(db.doc(`pets/${petId}`))).data();
      const existingWalk = await tx.get(walk);
      if (existingWalk.exists) return fail("already-exists", "Walk ID already exists");
      if (!pet || pet.familyId !== familyId) return fail("permission-denied", "Pet scope changed");
      await assertAccountsActive(tx, db, [pet.ownerUid]);
      if (familyId === null ? pet.ownerUid !== uid : req.auth?.token.firebase?.sign_in_provider === "anonymous" || !(await member(tx, db, familyId, uid))) return fail("permission-denied", "Pet access denied");
      const expiresAtMs = startedAtMs + SIX_HOURS;
      tx.create(ref, { sessionId, walkerUid: uid, petId, petName: typeof pet.name === "string" ? pet.name : "", familyId,
        shareLive: data.shareLive, startedAt: Timestamp.fromMillis(startedAtMs), expiresAt: Timestamp.fromMillis(expiresAtMs),
        status: "active", chunkCount: 0, pointCount: 0, lastPoint: null, createdAt: Timestamp.fromMillis(now) });
      return { sessionId, status: "active", expiresAtMs };
    }
    if (!s) return fail("not-found", "Session not found");
    const isMember = s.familyId === null ? false : await member(tx, db, s.familyId, uid);
    if (op === "delete") {
      if (s.walkerUid !== uid && !isMember) return fail("permission-denied", "No delete access");
      tx.set(ref, { sessionId, status: "deleted", walkerUid: s.walkerUid, petId: s.petId });
      tx.delete(walk);
      tx.delete(live);
      return { sessionId, status: "deleted" };
    }
    if (s.walkerUid !== uid) return fail("permission-denied", "Not session owner");
    // Historical family ownership cannot be silently moved to another family.
    if (op !== "end" && s.familyId !== null && !isMember) return fail("permission-denied", "Original family membership required");
    const start = s.startedAt.toMillis();
    const expiry = s.expiresAt.toMillis();
    if (op === "end") {
      const ended = integer(data.endedAtMs, start, Math.min(now, expiry));
      if (s.status !== "active") {
        if (s.endedAt?.toMillis() !== ended) return fail("failed-precondition", "End is immutable");
        return { sessionId, status: s.status };
      }
      if (s.lastPoint && s.lastPoint.t > ended) return fail("invalid-argument", "End precedes uploaded samples");
      tx.update(ref, { status: "ended", endedAt: Timestamp.fromMillis(ended) });
      tx.delete(live);
      return { sessionId, status: "ended" };
    }
    if (op === "publish") {
      if (s.status !== "active" || !s.shareLive || now >= expiry) return fail("failed-precondition", "Sharing is inactive");
      const p = point(data.point, start, Math.min(now, expiry));
      if (p.t + FIVE_MINUTES <= now) return fail("failed-precondition", "Location is stale");
      const previous = (await tx.get(live)).data();
      if (previous && p.t <= previous.locatedAt.toMillis()) return fail("failed-precondition", "Location must advance");
      tx.set(live, { sessionId, familyId: s.familyId, walkerUid: uid, petId: s.petId,
        lat: p.lat, lng: p.lng, locatedAt: Timestamp.fromMillis(p.t), expiresAt: Timestamp.fromMillis(Math.min(p.t + FIVE_MINUTES, expiry)) });
      return { sessionId, status: s.status };
    }
    if (op === "append") {
      if (s.status === "finalized") return fail("failed-precondition", "Route is sealed");
      const index = integer(data.chunkIndex, 0, Number.MAX_SAFE_INTEGER);
      if (!Array.isArray(data.points) || data.points.length < 1 || data.points.length > 250) return fail("invalid-argument", "Send 1–250 points per chunk");
      const points = data.points.map((p: unknown) => point(p, start, Math.min(now, s.endedAt?.toMillis() ?? expiry)));
      const chunk = ref.collection("chunks").doc(String(index).padStart(10, "0"));
      const prior = await tx.get(chunk);
      if (prior.exists) {
        if (!isDeepStrictEqual(prior.data()?.points, points)) return fail("already-exists", "Chunk is immutable");
        return { sessionId, status: s.status, chunkCount: s.chunkCount, pointCount: s.pointCount };
      }
      if (index !== s.chunkCount) return fail("failed-precondition", "Upload chunks sequentially");
      let previous: Point | null = s.lastPoint;
      for (const p of points) {
        if (previous && (p.t <= previous.t || p.segment < previous.segment)) return fail("invalid-argument", "Samples must advance time and segment");
        previous = p;
      }
      tx.create(chunk, { chunkIndex: index, points });
      tx.update(ref, { chunkCount: index + 1, pointCount: s.pointCount + points.length, lastPoint: previous });
      return { sessionId, status: s.status, chunkCount: index + 1, pointCount: s.pointCount + points.length };
    }
    if (s.status !== "ended" && s.status !== "finalized") return fail("failed-precondition", "End before finalizing");
    const manifest = {
      chunkCount: integer(data.chunkCount, 0, Number.MAX_SAFE_INTEGER), pointCount: integer(data.pointCount, 0, Number.MAX_SAFE_INTEGER),
      distanceKm: number(data.distanceKm, 0, 1000), durationMin: number(data.durationMin, 0, (s.endedAt.toMillis() - start) / 60000), score: number(data.score, 0, 1000000),
    };
    const existing = await tx.get(walk);
    if (s.status === "finalized") {
      if (!existing.exists) return fail("failed-precondition", "Walk was deleted");
      if (!isDeepStrictEqual(s.manifest, manifest)) return fail("already-exists", "Finalization is immutable");
      return { sessionId, status: "finalized" };
    }
    if (manifest.chunkCount !== s.chunkCount || manifest.pointCount !== s.pointCount) return fail("failed-precondition", "Upload incomplete");
    if (existing.exists) return fail("already-exists", "Walk ID exists");
    const pet = (await tx.get(db.doc(`pets/${s.petId}`))).data();
    if (!pet || pet.familyId !== s.familyId || (s.familyId === null && pet.ownerUid !== uid)) return fail("permission-denied", "Pet scope changed");
    await assertAccountsActive(tx, db, [pet.ownerUid]);
    tx.create(walk, { walkId: sessionId, familyId: s.familyId, walkerUid: uid, ownerUid: uid, petId: s.petId, petName: s.petName,
      startedAt: s.startedAt, endedAt: s.endedAt, distanceKm: manifest.distanceKm, durationMin: manifest.durationMin, score: manifest.score,
      isManual: false, routeVersion: 1, routePointCount: s.pointCount, routeChunkCount: s.chunkCount, createdAt: Timestamp.fromMillis(now) });
    tx.update(ref, { status: "finalized", manifest });
    tx.delete(live);
    return { sessionId, status: "finalized" };
  });
  if (op === "delete") await db.recursiveDelete(ref.collection("chunks"));
  return result;
});

/** Bounded discovery over the single familyId index. Empty pages can have a cursor. */
export const listWalkLiveLocations = onCall({ region: "asia-east1", cors: true }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign-in required");
  if (req.auth?.token.firebase?.sign_in_provider === "anonymous") return fail("permission-denied", "Family membership required");
  const familyId = id(req.data?.familyId);
  const pageSize = integer(req.data?.pageSize ?? 25, 1, 50);
  const cursor = req.data?.cursor == null ? null : id(req.data.cursor);
  const db = getFirestore();
  return db.runTransaction(async (tx) => {
    await assertAccountsActive(tx, db, [uid]);
    const family = (await tx.get(db.doc(`families/${familyId}`))).data();
    const members: string[] = family?.memberUids ?? [];
    if (!members.includes(uid)) return fail("permission-denied", "Family membership required");
    let query = db.collection("walkLiveLocations").where("familyId", "==", familyId).orderBy("__name__").limit(pageSize);
    if (cursor) query = query.startAfter(cursor);
    const page = await tx.get(query);
    const sessions = await Promise.all(page.docs.map((doc) => tx.get(db.doc(`walkRouteSessions/${doc.id}`))));
    const now = Date.now();
    const locations = page.docs.flatMap((doc, i) => {
      const live = doc.data();
      const session = sessions[i].data();
      if (!session || session.status !== "active" || !session.shareLive || session.familyId !== familyId
        || session.walkerUid !== live.walkerUid || !members.includes(live.walkerUid)) return [];
      const locatedAtMs = live.locatedAt.toMillis();
      const expiresAtMs = Math.min(live.expiresAt.toMillis(), session.expiresAt.toMillis(), locatedAtMs + FIVE_MINUTES);
      if (expiresAtMs <= now || locatedAtMs > now) return [];
      return [{ sessionId: doc.id, familyId, walkerUid: live.walkerUid, petId: live.petId,
        lat: live.lat, lng: live.lng, locatedAtMs, expiresAtMs }];
    });
    return { locations, nextCursor: page.size === pageSize ? page.docs[page.size - 1].id : null };
  });
});
