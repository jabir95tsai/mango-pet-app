export const DISPLAY_NAME_MAX = 30;

/** Trimmed display name, or null when empty / longer than DISPLAY_NAME_MAX. */
export function normalizeDisplayName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, " ");
  return name && [...name].length <= DISPLAY_NAME_MAX ? name : null;
}
