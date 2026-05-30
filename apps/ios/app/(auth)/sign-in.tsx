import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  isAppleSignInAvailable,
  signInWithApple,
  signInWithGoogle,
} from "@/lib/auth";
import { colors, radius, spacing } from "@/theme/theme";

export default function SignInScreen() {
  const [busy, setBusy] = useState<null | "google" | "apple">(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  async function run(provider: "google" | "apple", fn: () => Promise<string>) {
    if (busy) return;
    setBusy(provider);
    try {
      await fn();
      // On success the root auth listener redirects to the tabs.
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed";
      Alert.alert("登入失敗", message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.hero}>
        <View style={styles.logoDisc}>
          <Text style={styles.logoEmoji}>🥭</Text>
        </View>
        <Text style={styles.title}>Mango Pet</Text>
        <Text style={styles.subtitle}>陪牠走每一步</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="使用 Google 登入"
          disabled={busy !== null}
          onPress={() => run("google", signInWithGoogle)}
          style={({ pressed }) => [
            styles.googleBtn,
            pressed && styles.pressed,
            busy !== null && styles.disabled,
          ]}
        >
          {busy === "google" ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text style={styles.googleText}>使用 Google 登入</Text>
          )}
        </Pressable>

        {appleAvailable && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={
              AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
            }
            buttonStyle={
              AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={radius.pill}
            style={styles.appleBtn}
            onPress={() => run("apple", signInWithApple)}
          />
        )}

        <Text style={styles.legal}>
          登入即代表你同意《服務條款》與《隱私權政策》
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  logoDisc: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  logoEmoji: { fontSize: 48 },
  title: { fontSize: 28, fontWeight: "800", color: colors.ink },
  subtitle: { fontSize: 15, color: colors.ink2 },
  actions: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  googleBtn: {
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  googleText: { fontSize: 16, fontWeight: "600", color: colors.ink },
  appleBtn: { height: 50, width: "100%" },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
  legal: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.ink3,
    textAlign: "center",
  },
});
