// ── Mango design tokens (P0 stub) ──
// Cross-platform single source of truth for the mango palette, aligned to
// apps/web/src/app/globals.css `@theme inline`. P0 only seeds the color
// object so the package exists and resolves; P1+ adds the dual-output
// generators (web Tailwind config extend + ios theme.ts for RN StyleSheet),
// plus spacing / radius / shadow tiers. Until then web keeps reading its
// own globals.css; nothing imports this in P0.

export const mangoColors = {
  bg: "#fbf1dd",
  bgAlt: "#f6e7c8",
  card: "#ffffff",
  cardSoft: "#fff8e8",
  hairline: "#eadfc4",
  ink: "#231b14",
  ink2: "#5a4a38",
  ink3: "#9a8a74",
  brand: "#f39800",
  brandDeep: "#d77b00",
  brandTint: "#ffe7bf",
  amber: "#ffc25c",
  leaf: "#5fa858",
  leafTint: "#e7f2dc",
  success: "#7dd699",
  successTint: "#d8f2de",
  // Destructive / danger semantics (delete account, danger zone). Mango is the
  // brand palette, but status colors stay conventional so a destructive action
  // never reads as "just another mango button". 1:1 with the web danger zone,
  // which uses Tailwind red-600 (fill + icon) and red-700 (title).
  danger: "#dc2626",
  dangerDeep: "#b91c1c",
  bellTint: "#ffe9a8",
  cookie: "#d77b3f",
  cookieTint: "#ffe0cc",
  peach: "#ffb3ba",
  peachTint: "#ffe4e6",
  paw: "#3b2a1d",
} as const;

export type MangoColorToken = keyof typeof mangoColors;
