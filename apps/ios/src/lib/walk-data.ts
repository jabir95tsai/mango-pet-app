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

/** Walks list cap — same default the web recent-list pulls. */
const WALKS_LIMIT = 50;

/**
 * Resolve the signed-in user's active family id, mirroring web:
 * no `familyIds` → personal mode (null); else `currentFamilyId ?? familyIds[0]`.
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

/** Recent walks in the active scope (newest first). */
export async function listWalksForScope(
  familyId: string | null,
  uid: string,
  max: number = WALKS_LIMIT,
): Promise<Walk[]> {
  const col = firestore().collection("walks");
  const base =
    familyId !== null
      ? col.where("familyId", "==", familyId).orderBy("startedAt", "desc")
      : col
          .where("walkerUid", "==", uid)
          .where("familyId", "==", null)
          .orderBy("startedAt", "desc");
  const snap = await base.limit(max).get();
  return snap.docs.map(
    (d) => ({ ...(d.data() as object), walkId: d.id }) as unknown as Walk,
  );
}
