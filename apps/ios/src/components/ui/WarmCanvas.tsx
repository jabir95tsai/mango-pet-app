import { useEffect, useState, type PropsWithChildren } from "react";
import { AccessibilityInfo, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { GlassView } from "expo-glass-effect";
import { LIQUID_GLASS } from "@/lib/liquid-glass";
import { radius } from "@/theme/theme";

/** iOS A palette: ambient canvas, with native glass reserved for small controls. */
export function WarmCanvas() {
  return <LinearGradient pointerEvents="none" colors={["#FFF9F0", "#FCE8CF", "#FFF9F2"]} locations={[0, 0.48, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />;
}
export function WarmGlass({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const [opaque, setOpaque] = useState(true);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceTransparencyEnabled().then(value => { if (active) setOpaque(value); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceTransparencyChanged", setOpaque);
    return () => { active = false; sub.remove(); };
  }, []);
  return <View style={style}>
    {LIQUID_GLASS && !opaque ? <GlassView pointerEvents="none" glassEffectStyle="regular" colorScheme="light" style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]} /> : <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#FFF9F0", borderRadius: radius.pill }]} />}
    {children}
  </View>;
}
