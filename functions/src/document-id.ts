/** Validate a single Firestore document ID before using untrusted stored fields
 * as paths. In particular, __.*__ is reserved by the production API even when
 * the emulator accepts it. See https://firebase.google.com/docs/firestore/quotas.
 */
export function isFirestoreDocumentId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
    && value !== "." && value !== ".." && !value.includes("/")
    && !/^__[\s\S]*__$/.test(value)
    && Buffer.byteLength(value, "utf8") <= 1500
    && Buffer.from(value, "utf8").toString("utf8") === value;
}
