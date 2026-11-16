import { Pressable, StyleSheet, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated from "react-native-reanimated";
import { Play } from "lucide-react-native";
import { t } from "@/lib/i18n";
import { usePressFeedback } from "@/components/ui/use-press-feedback";
import { radius } from "@/theme/theme";
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
export function WalksStartCta({ onPress, disabled = false }: { onPress: () => void; disabled?: boolean }) {
  const press = usePressFeedback({ pressedOpacity: 0.85, restOpacity: disabled ? 0.5 : 1 });
  return <AnimatedPressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} {...press.handlers} style={[styles.shadow, press.style]}>
    <LinearGradient colors={["#E99321", "#BF650A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pill}>
      <Play size={19} color="white" fill="white" />
      <Text style={styles.label}>{t("Walks.core.startWalking")}</Text>
    </LinearGradient>
  </AnimatedPressable>;
}
const styles = StyleSheet.create({
  shadow: { borderRadius: radius.pill, shadowColor: "#B96E24", shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  pill: { minHeight: 56, paddingVertical: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: "#F7C58B", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  label: { fontSize: 18, fontWeight: "700", color: "white" }
});
