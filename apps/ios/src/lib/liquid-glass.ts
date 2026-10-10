/**
 * iOS 26 Liquid Glass gate + the floating tab bar's geometry.
 *
 * Design rule (Apple HIG "Materials" + docs/features/ios-liquid-glass.md):
 * glass is ONLY for the navigation layer that floats above content — today
 * the bottom tab bar. Cards / rows / content stay solid mango.
 *
 * On iOS 26+ the tab bar becomes a floating glass capsule and the tab screens
 * scroll UNDER it (glass needs content behind it to refract). Everywhere else
 * (iOS < 26, or a build without the Liquid Glass SDK) the original in-flow
 * notched bar is kept, so the overlap is 0 and nothing else moves.
 *
 * Accessibility: the native UIGlassEffect already honours Reduce Transparency
 * (renders a frosted, opaque fill), Increase Contrast and Reduce Motion (no
 * interactive shimmer), so no JS fallback is needed for those settings.
 */
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";

function detect(): boolean {
  if (Platform.OS !== "ios") return false;
  try {
    // isGlassEffectAPIAvailable guards early iOS 26 betas where the API is
    // missing and rendering GlassView would crash.
    return isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

/** Static for the app's lifetime (OS + compiled SDK can't change at runtime). */
export const LIQUID_GLASS = detect();

/** Floating capsule height (icons + labels). */
export const GLASS_BAR_H = 64;
/** The raised walks disc pokes this far above the capsule's top edge. */
export const GLASS_DISC_RISE = 18;

/** Gap between the capsule's bottom edge and the screen bottom. */
export function glassBarBottomGap(insetBottom: number): number {
  // Sit inside the home-indicator area like the iOS 26 system tab bar does.
  return insetBottom > 0 ? Math.max(insetBottom - 12, 8) : 12;
}

/**
 * How much of a tab screen's bottom the floating glass bar covers, so scroll
 * content (contentInset) and bottom-pinned controls (FAB, CTA dock) can clear
 * it. 0 when the classic in-flow bar is used (the screen already ends above it).
 */
export function useTabBarOverlap(): number {
  const insets = useSafeAreaInsets();
  if (!LIQUID_GLASS) return 0;
  return glassBarBottomGap(insets.bottom) + GLASS_BAR_H + GLASS_DISC_RISE;
}

/** ScrollView / FlatList props that let content scroll fully past the glass bar. */
export function useTabBarScrollInsets() {
  const overlap = useTabBarOverlap();
  return {
    contentInset: { bottom: overlap },
    scrollIndicatorInsets: { bottom: overlap },
  } as const;
}
