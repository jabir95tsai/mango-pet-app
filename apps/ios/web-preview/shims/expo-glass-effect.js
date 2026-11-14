// WEB PREVIEW ONLY (metro.config.js swaps this in when platform === "web").
// expo-glass-effect's own web build renders GlassView as a plain transparent
// View and reports Liquid Glass as unavailable, so the preview would never show
// the iOS 26 floating glass tab bar / lens. This stand-in reports it available
// and approximates the material with CSS frosted glass (backdrop blur +
// translucent white + light rim). Real UIGlassEffect refraction/shimmer is
// iOS-only — compare on device for fidelity.
//
// Add ?glass=0 to the preview URL (then reload) to see the iOS < 26 notched bar.
import { View } from "react-native";

import { GLASS_ENABLED } from "../device-mode";

const glassEnabled = () => GLASS_ENABLED;

export function isLiquidGlassAvailable() {
  return glassEnabled();
}

export function isGlassEffectAPIAvailable() {
  return glassEnabled();
}

const MATERIAL = {
  regular: {
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    backdropFilter: "blur(18px) saturate(180%)",
  },
  clear: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    backdropFilter: "blur(6px) saturate(160%)",
  },
};

export function GlassView({ glassEffectStyle = "regular", tintColor, style, ...props }) {
  const material = MATERIAL[glassEffectStyle === "clear" ? "clear" : "regular"];
  return (
    <View
      {...props}
      style={[
        {
          ...material,
          WebkitBackdropFilter: material.backdropFilter,
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.7)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8), 0 8px 24px rgba(60, 40, 10, 0.12)",
          overflow: "hidden",
        },
        tintColor ? { backgroundColor: tintColor } : null,
        style,
      ]}
    />
  );
}

export function GlassContainer(props) {
  return <View {...props} />;
}
