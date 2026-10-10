import "@/lib/rnfb-setup";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AlertTriangle } from "lucide-react-native";

import { AuthProvider, useAuth } from "@/state/auth-context";
import { FamilyProvider } from "@/state/family-context";
import { GuestUpgradeProvider } from "@/components/auth/guest-upgrade";
import { Button } from "@/components/ui";
import { resolveCurrentFamilyId } from "@/lib/walk-data";
import {
  ONBOARDED_KEY,
  joinCodeFromPath,
  rememberPendingJoin,
  takePendingJoin,
} from "@/lib/onboarding";
import { colors, radius, spacing, CONTENT_MAX_WIDTH } from "@/theme/theme";
import { restorePersistedLocale, t, useLocale, useLocaleRestored } from "@/lib/i18n";
import { signOutUnreadySession } from "@/lib/auth";

/** Auth / onboarding paths are never "resumed" after a re-bootstrap. */
function isResumablePath(path: string | null): path is string {
  return !!path && !path.startsWith("/sign-in") && !path.startsWith("/onboarding");
}

function RootNavigator() {
  const { user, initializing, profileError, retryProfile } = useAuth();
  const locale = useLocale();
  const localeRestored = useLocaleRestored();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();
  // Guards the once-per-sign-in landing decision so we don't loop while the
  // async onboarding/family check resolves.
  const decidedRef = useRef(false);
  // SHELL-6: /join/{code} a signed-out visitor tried to open (web ?next=).
  const pendingJoinRef = useRef<string | null>(null);
  // The last signed-in account + app path. When the SAME account re-bootstraps
  // (guest → Google/Apple link, profile retry) the navigator remounts on the
  // auth group; we send the user back where they were (web reloads in place).
  const lastUidRef = useRef<string | null>(null);
  const lastPathRef = useRef<string | null>(null);

  // SETTINGS-2: re-apply the persisted language before the first navigator
  // render (the splash below waits for it).
  useEffect(() => {
    void restorePersistedLocale();
  }, []);

  useEffect(() => {
    if (!localeRestored) return;
    if (initializing || profileError) {
      // Identity is (re)bootstrapping: the navigator is unmounted behind the
      // splash and will remount on the auth group — decide again then.
      decidedRef.current = false;
      return;
    }
    const inAuthGroup = segments[0] === "(auth)";
    if (!user) {
      decidedRef.current = false;
      lastUidRef.current = null;
      lastPathRef.current = null;
      // Signed-out deep link to a family invite: keep it across sign-in.
      if (segments[0] === "join") {
        const code = joinCodeFromPath(pathname);
        if (code) {
          pendingJoinRef.current = code;
          void rememberPendingJoin(code);
        }
      }
      if (!inAuthGroup) router.replace("/(auth)/sign-in");
      return;
    }
    // Signed in. Decide the landing ONCE on the auth→app transition:
    //  1. a pending invite → /join/{code} (auto-join, SHELL-6);
    //  2. the same account re-bootstrapped → back to where it was;
    //  3. a guest → the walks tab (family onboarding is guest-locked; web
    //     sends every fresh sign-in to /app/walks);
    //  4. a brand-new user (not onboarded + no family) → /onboarding;
    //  5. everyone else → the walks tab.
    // We don't continuously enforce, so onboarding's own navigation doesn't
    // bounce back.
    if (inAuthGroup && !decidedRef.current) {
      decidedRef.current = true;
      const uid = user.uid;
      const isGuest = user.isAnonymous;
      const resumePath = lastUidRef.current === uid ? lastPathRef.current : null;
      const memoryJoin = pendingJoinRef.current;
      pendingJoinRef.current = null;
      (async () => {
        // Always consume the stored copy so it can't resurface later.
        const storedJoin = await takePendingJoin();
        const join = memoryJoin ?? storedJoin;
        if (join) {
          router.replace(`/join/${encodeURIComponent(join)}`);
          return;
        }
        if (isResumablePath(resumePath)) {
          router.replace(resumePath);
          return;
        }
        if (isGuest) {
          router.replace("/(tabs)/walks");
          return;
        }
        const [flag, fam] = await Promise.all([
          AsyncStorage.getItem(ONBOARDED_KEY).catch(() => null),
          resolveCurrentFamilyId(uid).catch(() => null),
        ]);
        router.replace(!flag && !fam ? "/onboarding" : "/(tabs)/walks");
      })();
    }
  }, [user, initializing, profileError, localeRestored, segments, pathname, router]);

  // A language switch remounts the Stack (keyed by locale below). A remounted
  // navigator may come back on its initial route instead of the screen the
  // user switched from (usually Settings), so capture the path at the moment
  // the locale changes — before the remember-effect below overwrites it — and
  // restore it once the new navigator has mounted. No-op when the route
  // survived the remount.
  const prevLocaleRef = useRef(locale);
  const pathBeforeSwitchRef = useRef<string | null>(null);
  if (prevLocaleRef.current !== locale) {
    prevLocaleRef.current = locale;
    pathBeforeSwitchRef.current = lastPathRef.current;
  }
  useEffect(() => {
    const target = pathBeforeSwitchRef.current;
    if (!target) return;
    pathBeforeSwitchRef.current = null;
    const id = setTimeout(() => {
      if (isResumablePath(target)) router.replace(target);
    }, 0);
    return () => clearTimeout(id);
  }, [locale, router]);

  // Remember the account + app screen for the re-bootstrap resume above.
  useEffect(() => {
    if (!user || initializing || profileError) return;
    lastUidRef.current = user.uid;
    if (segments[0] !== "(auth)" && pathname) lastPathRef.current = pathname;
  }, [user, initializing, profileError, segments, pathname]);

  if (profileError) {
    return <ProfileErrorScreen onRetry={retryProfile} />;
  }

  if (!localeRestored || initializing) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  // Keyed by locale: a language switch remounts every screen with the new
  // strings. The effect above returns the user to the screen they switched
  // from in case the remounted navigator restarts on its initial route.
  return (
    <Stack key={locale} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      <Stack.Screen name="feed" options={{ presentation: "card" }} />
      <Stack.Screen name="photos" options={{ presentation: "card" }} />
      <Stack.Screen name="family" options={{ presentation: "card" }} />
      <Stack.Screen name="achievements" options={{ presentation: "card" }} />
      <Stack.Screen name="join/[code]" options={{ presentation: "card" }} />
      <Stack.Screen name="friends/index" options={{ presentation: "card" }} />
      <Stack.Screen name="friends/add" options={{ presentation: "card" }} />
    </Stack>
  );
}

/**
 * Profile-bootstrap failure (SHELL-13 / XCUT-5) — styled like web's error
 * boundary (apps/web/src/app/error.tsx: Error.title + Error.retry): an
 * AlertTriangle tile, the explanation, Retry and Sign out. Sign-out revokes
 * this device's push token first; a revocation failure keeps the session and
 * says so inline.
 */
function ProfileErrorScreen({ onRetry }: { onRetry: () => void }) {
  const [exiting, setExiting] = useState(false);
  const [exitError, setExitError] = useState(false);

  async function exit() {
    if (exiting) return;
    setExiting(true);
    setExitError(false);
    try {
      await signOutUnreadySession();
    } catch {
      setExitError(true);
    } finally {
      setExiting(false);
    }
  }

  return (
    <SafeAreaView style={styles.errorSafe}>
      <View style={styles.errorColumn}>
        <View style={styles.errorTile}>
          <AlertTriangle size={32} color={colors.brandDeep} strokeWidth={2} />
        </View>
        <View style={styles.errorText}>
          <Text style={styles.errorTitle} accessibilityRole="header">
            {t("Error.title")}
          </Text>
          <Text style={styles.errorBody}>{t("Auth.profileError.body")}</Text>
        </View>
        <View style={styles.errorActions}>
          <Button
            label={t("Error.retry")}
            onPress={() => {
              setExitError(false);
              onRetry();
            }}
            disabled={exiting}
            size="lg"
            fullWidth
          />
          <Button
            label={t("Auth.signOut")}
            variant="ghost"
            onPress={exit}
            loading={exiting}
            fullWidth
          />
        </View>
        {exitError ? (
          <Text style={styles.errorNote} accessibilityRole="alert" accessibilityLiveRegion="polite">
            {t("Auth.profileError.revokeFailed")}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <AuthProvider>
          <GuestUpgradeProvider>
            <FamilyProvider>
              <StatusBar style="dark" />
              <RootNavigator />
            </FamilyProvider>
          </GuestUpgradeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  errorSafe: { flex: 1, backgroundColor: colors.bg },
  errorColumn: {
    flex: 1,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
    padding: spacing.xl,
  },
  // 64pt tile, same as the join screen status tile.
  errorTile: {
    width: 64,
    height: 64,
    borderRadius: radius.xl2,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: { alignItems: "center", gap: spacing.sm },
  errorTitle: { fontSize: 20, fontWeight: "800", color: colors.ink, textAlign: "center" },
  errorBody: { fontSize: 14, lineHeight: 20, color: colors.ink2, textAlign: "center" },
  errorActions: { alignSelf: "stretch", gap: spacing.sm },
  errorNote: { fontSize: 13, lineHeight: 18, color: colors.danger, textAlign: "center" },
});
