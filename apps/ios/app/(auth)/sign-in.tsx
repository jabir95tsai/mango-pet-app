/**
 * Sign-in — 1:1 with the web landing (apps/web/src/app/page.tsx) +
 * SignInButtons (apps/web/src/components/auth/sign-in-buttons.tsx):
 *
 *   [繁中 | EN]                                   (top-right switcher)
 *   logo 84 · App.name 36/700 · App.tagline
 *   card: Auth.welcome / Auth.subtitle
 *         Google (white, G mark) · Apple (native button)
 *         ── Auth.guestDivider ──
 *         Auth.continueAsGuest (outlined, weaker)
 *         inline error (Auth.errors.*)
 *   footer: Common.privacy · Common.terms
 *
 * iOS differences (accepted): the Apple button is Apple's native
 * AppleAuthenticationButton (system-localised, HIG), Facebook is not offered.
 * A cancelled Google / Apple sheet shows nothing (SHELL-5). On success the
 * root navigator routes the user (guests → walks, pending invite → /join).
 */
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  isAppleSignInAvailable,
  signInAsGuest,
  signInWithApple,
  signInWithGoogle,
} from "@/lib/auth";
import { SITE_URL } from "@/lib/config";
import { t, useLocale } from "@/lib/i18n";
import { GoogleIcon } from "@/components/auth/provider-icons";
import { signInErrorMessage } from "@/components/auth/auth-errors";
import { LanguageSwitcher } from "@/components/settings/language-switcher";
import { colors, radius, shadows, spacing, CONTENT_MAX_WIDTH } from "@/theme/theme";

type Busy = null | "google" | "apple" | "guest";

// web max-w-md / max-w-xs
const SECTION_MAX_WIDTH = Math.min(448, CONTENT_MAX_WIDTH);
const BUTTONS_MAX_WIDTH = 320;

export default function SignInScreen() {
  useLocale();
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    let alive = true;
    isAppleSignInAvailable()
      .then((ok) => {
        if (alive) setAppleAvailable(ok);
      })
      .catch(() => {
        if (alive) setAppleAvailable(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function run(kind: Exclude<Busy, null>, fn: () => Promise<string>) {
    if (busy) return;
    setBusy(kind);
    setError(null);
    try {
      await fn();
      // On success the root auth listener swaps to the app.
    } catch (err) {
      setError(signInErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const locked = busy !== null;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <LanguageSwitcher />
        </View>

        <View style={styles.section}>
          <View style={styles.brand}>
            <View style={styles.logoShadow}>
              <Image
                source={require("../../assets/icon.png")}
                style={styles.logo}
                accessibilityIgnoresInvertColors
                accessible={false}
              />
            </View>
            <View style={styles.brandText}>
              <Text style={styles.appName} accessibilityRole="header">
                {t("App.name")}
              </Text>
              <Text style={styles.tagline}>{t("App.tagline")}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.welcome} accessibilityRole="header">
                {t("Auth.welcome")}
              </Text>
              <Text style={styles.subtitle}>{t("Auth.subtitle")}</Text>
            </View>

            <View style={styles.buttons}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Auth.signInWithGoogle")}
                accessibilityState={{ disabled: locked, busy: busy === "google" }}
                disabled={locked}
                onPress={() => run("google", signInWithGoogle)}
                style={({ pressed }) => [
                  styles.google,
                  pressed && !locked && styles.googlePressed,
                  locked && styles.disabled,
                ]}
              >
                {busy === "google" ? (
                  <ActivityIndicator color={colors.ink} />
                ) : (
                  <>
                    <GoogleIcon size={20} />
                    <Text style={styles.googleText} numberOfLines={1}>
                      {t("Auth.signInWithGoogle")}
                    </Text>
                  </>
                )}
              </Pressable>

              {appleAvailable ? (
                <View
                  pointerEvents={locked ? "none" : "auto"}
                  style={[styles.appleWrap, locked && styles.disabled]}
                >
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={radius.sm}
                    style={styles.apple}
                    onPress={() => run("apple", signInWithApple)}
                  />
                </View>
              ) : null}

              {/* Guest entry — secondary, visually weaker than the provider
                  buttons; the divider sets it apart (spec guest-login.md §A). */}
              <View
                style={styles.divider}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t("Auth.guestDivider")}</Text>
                <View style={styles.dividerLine} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Auth.continueAsGuest")}
                accessibilityState={{ disabled: locked, busy: busy === "guest" }}
                disabled={locked}
                onPress={() => run("guest", signInAsGuest)}
                style={({ pressed }) => [
                  styles.guest,
                  pressed && !locked && styles.guestPressed,
                  locked && styles.disabled,
                ]}
              >
                {busy === "guest" ? (
                  <ActivityIndicator color={colors.ink2} />
                ) : (
                  <Text style={styles.guestText} numberOfLines={1}>
                    {t("Auth.continueAsGuest")}
                  </Text>
                )}
              </Pressable>

              {error ? (
                <Text
                  style={styles.error}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                >
                  {error}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="link"
            onPress={() => Linking.openURL(`${SITE_URL}/privacy`).catch(() => {})}
            hitSlop={LINK_HIT_SLOP}
          >
            <Text style={styles.footerLink}>{t("Common.privacy")}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            onPress={() => Linking.openURL(`${SITE_URL}/terms`).catch(() => {})}
            hitSlop={LINK_HIT_SLOP}
          >
            <Text style={styles.footerLink}>{t("Common.terms")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// 16pt text-xs links → 44pt targets
const LINK_HIT_SLOP = { top: 14, bottom: 14, left: 8, right: 8 };

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  // web: main flex min-h-dvh flex-col px-4 py-5
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: 20,
  },
  // web: flex justify-end
  topBar: { flexDirection: "row", justifyContent: "flex-end" },
  // web: mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 py-10
  section: {
    flex: 1,
    width: "100%",
    maxWidth: SECTION_MAX_WIDTH,
    alignSelf: "center",
    justifyContent: "center",
    gap: spacing.xxl,
    paddingVertical: 40,
  },
  // web: flex flex-col items-center gap-4
  brand: { alignItems: "center", gap: spacing.lg },
  // web: rounded-lg shadow-lg shadow-amber-500/20
  logoShadow: {
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    shadowColor: colors.brand,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
  },
  logo: { width: 84, height: 84, borderRadius: radius.sm },
  // web: space-y-2
  brandText: { alignItems: "center", gap: spacing.sm },
  // web: text-4xl font-bold text-zinc-950
  appName: { fontSize: 36, lineHeight: 40, fontWeight: "700", color: colors.ink, textAlign: "center" },
  // web: text-zinc-600 (base 16)
  tagline: { fontSize: 16, lineHeight: 24, color: colors.ink2, textAlign: "center" },
  // web: rounded-lg border border-zinc-200/80 bg-white/85 p-5 shadow-sm
  // (radius → --radius-lg per docs/design-system.md §2)
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    padding: 20,
    ...shadows.card,
  },
  // web: mb-5 space-y-2
  cardHead: { marginBottom: 20, gap: spacing.sm },
  // web: text-xl font-semibold
  welcome: { fontSize: 20, lineHeight: 28, fontWeight: "600", color: colors.ink, textAlign: "center" },
  // web: text-sm leading-6 text-zinc-500
  subtitle: { fontSize: 14, lineHeight: 24, color: colors.ink2, textAlign: "center" },
  // web: mx-auto flex w-full max-w-xs flex-col gap-3
  buttons: { width: "100%", maxWidth: BUTTONS_MAX_WIDTH, alignSelf: "center", gap: spacing.md },
  // web: flex h-12 items-center justify-center gap-3 rounded-lg font-medium
  //      bg-white text-zinc-900 border border-zinc-200
  google: {
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  googlePressed: { backgroundColor: colors.cardSoft },
  googleText: { fontSize: 16, fontWeight: "500", color: colors.ink },
  appleWrap: { height: 48, width: "100%" },
  apple: { height: 48, width: "100%" },
  // web disabled:opacity-60
  disabled: { opacity: 0.6 },
  // web: flex items-center gap-3 pt-1
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingTop: spacing.xs },
  // web: h-px flex-1 bg-zinc-200
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.hairline },
  // web: text-xs text-zinc-400
  dividerText: { fontSize: 12, color: colors.ink3 },
  // web: flex h-11 rounded-lg border border-zinc-200 bg-transparent
  //      text-sm font-medium text-zinc-600
  guest: {
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  guestPressed: { backgroundColor: colors.cardSoft },
  guestText: { fontSize: 14, fontWeight: "500", color: colors.ink2 },
  // web: text-sm text-red-600 text-center
  error: { fontSize: 14, lineHeight: 20, color: colors.danger, textAlign: "center" },
  // web: flex justify-center gap-4 pb-2 text-xs text-zinc-400
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.lg,
    paddingBottom: spacing.sm,
  },
  footerLink: { fontSize: 12, lineHeight: 16, color: colors.ink3 },
});
