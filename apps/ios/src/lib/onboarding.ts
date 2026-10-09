import AsyncStorage from "@react-native-async-storage/async-storage";

/** AsyncStorage key marking that first-login onboarding was completed/skipped.
 *  Read once on the sign-in transition (root navigator) to decide whether to
 *  land a new user on /onboarding. */
export const ONBOARDED_KEY = "mango.onboarded";

// ── Pending family invite (SHELL-6) ──────────────────────────────────
// Web keeps a signed-out visitor's /join/{code} in `/?next=` and sends them
// back there after sign-in (apps/web/src/app/page.tsx getNextPath). iOS has no
// URL to carry it, so the root navigator stashes the code here when it bounces
// a signed-out user from /join/{code} to sign-in, and consumes it on the
// auth → app transition. Persisted (not just a ref) so it survives the app
// being evicted during the Google / Apple hand-off; expires so an abandoned
// sign-in does not hijack a much later one.

/** AsyncStorage key for the pending /join/{code} deep link. */
export const PENDING_JOIN_KEY = "mango.pendingJoin";
const PENDING_JOIN_TTL_MS = 60 * 60 * 1000;

/** Normalise a raw route param into a join code worth keeping (or null). */
export function normalizeJoinCode(raw: unknown): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return null;
  let code = value.trim();
  try {
    code = decodeURIComponent(code);
  } catch {
    // keep the raw value
  }
  code = code.trim();
  if (!code || code.length > 64) return null;
  return code;
}

/** `/join/123456` (optionally with a query) → "123456"; anything else → null. */
export function joinCodeFromPath(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  const match = /^\/join\/([^/?#]+)/.exec(pathname);
  return match ? normalizeJoinCode(match[1]) : null;
}

/** Remember the invite a signed-out user tried to open. Best-effort. */
export async function rememberPendingJoin(code: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_JOIN_KEY, JSON.stringify({ code, at: Date.now() }));
  } catch {
    // Non-fatal: the in-memory copy in the root navigator still works.
  }
}

/** Read AND clear the stored invite (null when none or expired). */
export async function takePendingJoin(): Promise<string | null> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(PENDING_JOIN_KEY);
  } catch {
    return null;
  }
  if (raw == null) return null;
  AsyncStorage.removeItem(PENDING_JOIN_KEY).catch(() => {});
  try {
    const parsed = JSON.parse(raw) as { code?: unknown; at?: unknown };
    const at = typeof parsed.at === "number" ? parsed.at : 0;
    if (Date.now() - at > PENDING_JOIN_TTL_MS) return null;
    return normalizeJoinCode(parsed.code);
  } catch {
    return null;
  }
}

/** Drop any stored invite (e.g. after it was consumed in memory). */
export async function clearPendingJoin(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_JOIN_KEY);
  } catch {
    // ignore
  }
}
