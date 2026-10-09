/**
 * Tailwind's `/NN` opacity modifier for a mango token (e.g. web
 * `border-mango-brand/40` → `withAlpha(colors.brand, 0.4)`), so the auth
 * surfaces never hard-code an rgba copy of a palette hex.
 */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
