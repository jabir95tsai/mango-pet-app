// RN theme — single source of truth for color is @mango/shared-tokens.
// We DO NOT copy-paste hex values here; the mango palette is consumed from the
// shared package so web (Tailwind) and ios (RN StyleSheet) never drift.
// P1+ shared-tokens will also export spacing/radius/shadow tiers; for P0 we
// derive those locally and pull only color from shared.
import type { TextStyle, ViewStyle } from "react-native";
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

// Radius scale — 1:1 with web globals.css :root --radius-* (NOT the larger
// native values we used in the native-feel pass). lg 14 = card default,
// xl 18 = mockup Card, xl2 22 = MangoPhoto / pet-header avatar.
export const radius = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 18,
  xl2: 22,
  pill: 9999,
} as const;

// The mango primary-button / FAB gradient — 1:1 with web globals.css
// `.btn-mango` (linear-gradient 160deg amber → brand 50% → brandDeep) with
// white text + lifted shadow. expo-linear-gradient renders it; the 160deg is
// approximated with start/end points.
export const mangoGradient = {
  colors: [colors.amber, colors.brand, colors.brandDeep] as const,
  locations: [0, 0.5, 1] as const,
  start: { x: 0.1, y: 0 },
  end: { x: 0.9, y: 1 },
};

// Warm-brown drop-shadow base (rgb(80,50,10)), mirrors web --shadow-card /
// --shadow-elevated tone. RN can't express multi-layer / negative-spread
// shadows, so each tier is the closest single-layer approximation. `elevation`
// drives the Android stack order; iOS uses the shadow* fields.
const SHADOW_WARM = "#50320a";

export const shadows = {
  // Resting card lift on the cream bg — subtle, mirrors --shadow-card.
  card: {
    shadowColor: SHADOW_WARM,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  // Modals / sheets / tracking view — mirrors --shadow-elevated.
  elevated: {
    shadowColor: SHADOW_WARM,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  // Brand emphasis under primary CTAs / the raised tab disc — mirrors web
  // --shadow-mango / .btn-mango (0 10-12px 22-24px -8px rgba(243,152,0,0.55)).
  mango: {
    shadowColor: colors.brand,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
} satisfies Record<string, ViewStyle>;

export type ShadowTier = keyof typeof shadows;

// Typography scale — the recurring sizes/weights already used across the app,
// named so primitives and surfaces stop re-declaring them. Consume by spreading
// into a StyleSheet entry: `h1: { ...type.h1, color: colors.ink }`.
export const type = {
  h1: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: "800" },
  title: { fontSize: 16, fontWeight: "800" },
  body: { fontSize: 15, fontWeight: "500", lineHeight: 21 },
  label: { fontSize: 13, fontWeight: "700" },
  caption: { fontSize: 12, fontWeight: "600" },
  meta: { fontSize: 11, fontWeight: "600" },
} satisfies Record<string, TextStyle>;

export type TypeToken = keyof typeof type;

export const theme = {
  colors,
  spacing,
  radius,
  shadows,
  type,
} as const;

export type Theme = typeof theme;
