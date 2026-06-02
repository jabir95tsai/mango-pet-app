/**
 * Shared Firestore write helpers for the iOS Pets write layer. The `clean`
 * helper + the explicit-null handling mirror apps/web's firebase/*.ts so iOS
 * writes produce byte-identical docs (same fields, same sentinels) — both
 * platforms write the same collections directly (no Cloud Functions involved;
 * security rules permit authenticated owner/family writes).
 */
import firestore from "@react-native-firebase/firestore";

/** Strip undefined / "" values before a write (mirrors web's clean()). */
export function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== ""),
  ) as Partial<T>;
}

export const serverTimestamp = (): unknown =>
  firestore.FieldValue.serverTimestamp();

export const deleteField = (): unknown => firestore.FieldValue.delete();

export const tsFromDate = (d: Date) => firestore.Timestamp.fromDate(d);

/** Structural Timestamp with toDate() — RNFB Timestamp satisfies it. */
export type DatableTimestamp = { toDate(): Date };
