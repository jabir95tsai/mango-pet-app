/** Warm glass progress dial. Values and goal remain owned by useWalksData. */
import { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Check, PawPrint } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, G } from "react-native-svg";
import Reanimated, { Easing, useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
import { t } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { colors } from "@/theme/theme";
const SIZE = 232, R = 102, C = 2 * Math.PI * R;
const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);
type Props = { percent: number; complete: boolean; doneMin: number; goalMin: number };
function WalksDialBase({ percent, complete, doneMin, goalMin }: Props) {
  const clamped = Math.max(0, Math.min(1, percent / 100));
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = reduced ? clamped : withTiming(clamped, { duration: 600, easing: Easing.out(Easing.ease) });
  }, [clamped, reduced, progress]);
  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - progress.value) }));
  const tint = complete ? colors.leaf : colors.brandDeep;
  return <View accessible style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={`${Math.round(doneMin)} ${t("Walks.page.dialGoal", { goal: goalMin })}`} accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}>
    <LinearGradient colors={["#FFFFFF", "#FFF4E3"]} style={styles.disc} />
    <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
      <G rotation={-90} originX={116} originY={116}>
        <Circle cx={116} cy={116} r={R} fill="none" stroke={complete ? colors.leafTint : "#F2DDC0"} strokeWidth={9} />
        <AnimatedCircle cx={116} cy={116} r={R} fill="none" stroke={tint} strokeWidth={9} strokeLinecap="round" strokeDasharray={C} animatedProps={arcProps} />
      </G>
    </Svg>
    {complete ? <Check size={24} color={tint} /> : <PawPrint size={24} color={tint} />}
    <Text style={styles.value}>{Math.round(doneMin)}</Text>
    <Text style={styles.goal}>{t("Walks.page.dialGoal", { goal: goalMin })}</Text>
  </View>;
}
export const WalksDial = memo(WalksDialBase);
const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignSelf: "center", alignItems: "center", justifyContent: "center" },
  disc: { position: "absolute", width: 184, height: 184, borderRadius: 92, borderWidth: 1, borderColor: "#FFFFFF" },
  value: { fontSize: 58, lineHeight: 68, fontWeight: "700", letterSpacing: -2, color: colors.ink, fontVariant: ["tabular-nums"] },
  goal: { fontSize: 13, fontWeight: "500", color: colors.ink2 },
});
