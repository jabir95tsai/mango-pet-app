import { Pressable, StyleSheet, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Play } from "lucide-react-native";
import { t } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { radius } from "@/theme/theme";
export function WalksStartCta({ onPress, disabled = false }: { onPress: () => void; disabled?: boolean }) {
  const reduceMotion = useReducedMotion();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.shadow, { opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }, pressed && !disabled && !reduceMotion && styles.pressed]}>
    <LinearGradient colors={["#E99321", "#BF650A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pill}>
      <Play size={19} color="white" fill="white" />
      <Text style={styles.label}>{t("Walks.core.startWalking")}</Text>
    </LinearGradient>
  </Pressable>;
}
const styles = StyleSheet.create({
  shadow: { borderRadius: radius.pill, shadowColor: "#B96E24", shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  pill: { minHeight: 56, paddingVertical: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: "#F7C58B", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  label: { fontSize: 18, fontWeight: "700", color: "white" },
  pressed: { transform: [{ scale: 0.97 }] }
});
