/**
 * GlassSurface — the base Apple-Glass pane every glass primitive builds on.
 *
 * Composition (3 stacked layers, per the design system — never nest blurs):
 *   outer View  → mango-tinted soft shadow + radius (shadow can't live on the
 *                 clipped BlurView, so it sits on a non-clipping wrapper)
 *   BlurView    → the actual backdrop blur (expo-blur), radius + overflow hidden
 *     · tint overlay   — warm mango-white wash so glass reads on any backdrop
 *     · edge ring      — 0.5px full hairline (white ~32%)
 *     · top highlight  — 1px lifted highlight along the top
 *     · children
 *
 * ♿ Reduce Transparency → NO blur: render an opaque warm panel (level.solid)
 * with a hairline border. This is a hard requirement, not a nicety.
 */
import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { requireOptionalNativeModule } from "expo-modules-core";

import { useReduceTransparency } from "@/lib/use-reduce-transparency";
import { colors, glass, glassEdge, glassRadius, glassShadow, type GlassLevel } from "@/theme/theme";

// Is the expo-blur NATIVE view actually in this binary? A dev-client / build
// made before expo-blur was added won't have it — rendering <BlurView> there
// throws "Unimplemented component: ExpoBlurView". Probe once (non-throwing) and
// fall back to the opaque surface so the app never errors; real glass appears
// automatically once a blur-enabled build is installed.
const BLUR_AVAILABLE = requireOptionalNativeModule("ExpoBlurView") != null;

type Props = {
  children?: ReactNode;
  level?: GlassLevel;
  radius?: number;
  /** Apply the floating mango shadow on the outer wrapper. Default true. */
  shadow?: boolean;
  /** Show the micro-light edge (ring + top highlight). Default true. */
  edge?: boolean;
  /** Style for the outer (shadow) wrapper — margins, width, position. */
  style?: StyleProp<ViewStyle>;
  /** Style for the inner clipped surface — padding, alignment, minHeight. */
  contentStyle?: StyleProp<ViewStyle>;
};

export function GlassSurface({
  children,
  level = "regular",
  radius = glassRadius.card,
  shadow = true,
  edge = true,
  style,
  contentStyle,
}: Props) {
  const reduce = useReduceTransparency();
  const g = glass[level];

  if (reduce || !BLUR_AVAILABLE) {
    // Opaque warm fallback — Reduce Transparency (a11y) OR a build without the
    // expo-blur native view. Keeps full contrast, no translucency.
    return (
      <View
        style={[
          shadow && glassShadow,
          {
            borderRadius: radius,
            backgroundColor: g.solid,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.hairline,
          },
          style,
          contentStyle,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <View style={[shadow && glassShadow, { borderRadius: radius }, style]}>
      <BlurView
        intensity={g.intensity}
        tint="light"
        style={[styles.blur, { borderRadius: radius }, contentStyle]}
      >
        {/* warm mango-white tint wash */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: g.overlay }]} />
        {edge ? (
          <>
            {/* full hairline ring */}
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { borderRadius: radius, borderWidth: 0.5, borderColor: glassEdge.ring },
              ]}
            />
            {/* top lifted highlight */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                left: radius * 0.5,
                right: radius * 0.5,
                height: 1,
                backgroundColor: glassEdge.topHighlight,
              }}
            />
          </>
        ) : null}
        {children}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  blur: { overflow: "hidden" },
});
