import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { signOut } from "@/lib/auth";
import { useAuth } from "@/state/auth-context";
import { colors, radius, spacing } from "@/theme/theme";

export default function SettingsScreen() {
  const { user } = useAuth();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.body}>
        <Text style={styles.emoji}>⚙️</Text>
        <Text style={styles.title}>設定</Text>
        <Text style={styles.subtitle}>
          {user?.email ?? user?.uid ?? "未登入"}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="登出"
          onPress={() => {
            void signOut();
          }}
          style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
        >
          <Text style={styles.signOutText}>登出</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.xl,
  },
  emoji: { fontSize: 56 },
  title: { fontSize: 20, fontWeight: "800", color: colors.ink },
  subtitle: { fontSize: 14, color: colors.ink2 },
  signOut: {
    marginTop: spacing.xl,
    height: 48,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutText: { fontSize: 16, fontWeight: "600", color: colors.cookie },
  pressed: { opacity: 0.7 },
});
