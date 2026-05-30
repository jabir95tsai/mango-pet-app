// RN theme — single source of truth for color is @mango/shared-tokens.
// We DO NOT copy-paste hex values here; the mango palette is consumed from the
// shared package so web (Tailwind) and ios (RN StyleSheet) never drift.
// P1+ shared-tokens will also export spacing/radius/shadow tiers; for P0 we
// derive those locally and pull only color from shared.
import { mangoColors, type MangoColorToken } from "@mango/shared-tokens";

export const colors = mangoColors;
export type ColorToken = MangoColorToken;

// Local P0 scales (move to shared-tokens dual-output in P1+).
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const theme = {
  colors,
  spacing,
  radius,
} as const;

export type Theme = typeof theme;
