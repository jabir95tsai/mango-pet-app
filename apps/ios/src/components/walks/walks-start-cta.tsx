import { Pressable, StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";
import { Play } from "lucide-react-native";
import { t } from "@/lib/i18n";
import { MangoGlass } from "@/components/ui/Button";
import { usePressFeedback } from "@/components/ui/use-press-feedback";
import { radius } from "@/theme/theme";
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
export function WalksStartCta({ onPress, disabled = false }: { onPress: () => void; disabled?: boolean }) {
  const press = usePressFeedback({ pressedOpacity: 0.85, restOpacity: disabled ? 0.5 : 1 });
  return <AnimatedPressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} {...press.handlers} style={press.style}>
    <MangoGlass style={styles.pill}>
      <Play size={19} color="white" fill="white" />
      <Text style={styles.label}>{t("Walks.core.startWalking")}</Text>
    </MangoGlass>
  </AnimatedPressable>;
}
const styles = StyleSheet.create({
  pill: { minHeight: 56, paddingVertical: 14, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  label: { fontSize: 18, fontWeight: "700", color: "white" }
});
