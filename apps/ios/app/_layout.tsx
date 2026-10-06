import { useEffect, useRef } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { AuthProvider, useAuth } from "@/state/auth-context";
import { FamilyProvider } from "@/state/family-context";
import { resolveCurrentFamilyId } from "@/lib/walk-data";
import { ONBOARDED_KEY } from "@/lib/onboarding";
import { colors } from "@/theme/theme";
import { t, activeLocale } from "@/lib/i18n";

function RootNavigator() {
  const { user, initializing, profileError, retryProfile } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  // Guards the once-per-sign-in landing decision so we don't loop while the
  // async onboarding/family check resolves.
  const decidedRef = useRef(false);

  useEffect(() => {
    if (initializing || profileError) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!user) {
      decidedRef.current = false;
      if (!inAuthGroup) router.replace("/(auth)/sign-in");
      return;
    }
    // Signed in. Decide the landing ONCE on the auth→app transition: a brand-new
    // user (not onboarded + no family) lands on /onboarding; everyone else on
    // the walks tab. We don't continuously enforce, so onboarding's own navigation
    // doesn't bounce back.
    if (inAuthGroup && !decidedRef.current) {
      decidedRef.current = true;
      (async () => {
        const [flag, fam] = await Promise.all([
          AsyncStorage.getItem(ONBOARDED_KEY).catch(() => null),
          resolveCurrentFamilyId(user.uid).catch(() => null),
        ]);
        router.replace(!flag && !fam ? "/onboarding" : "/(tabs)/walks");
      })();
    }
  }, [user, initializing, profileError, segments, router]);

  if (profileError) {
    return <View style={styles.splash}>
      <Text style={{ color: colors.ink }}>{activeLocale === "en" ? "Could not prepare your profile. Check your connection and try again." : "無法準備帳號資料，請確認連線後重試。"}</Text>
      <Pressable accessibilityRole="button" onPress={retryProfile} style={{ padding: 20 }}>
        <Text style={{ color: colors.brandDeep }}>{t("Common.retry")}</Text>
      </Pressable>
    </View>;
  }

  if (initializing) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      <Stack.Screen name="feed" options={{ presentation: "card" }} />
      <Stack.Screen name="photos" options={{ presentation: "card" }} />
      <Stack.Screen name="family" options={{ presentation: "card" }} />
      <Stack.Screen name="join/[code]" options={{ presentation: "card" }} />
      <Stack.Screen name="friends/index" options={{ presentation: "card" }} />
      <Stack.Screen name="friends/add" options={{ presentation: "card" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <AuthProvider>
          <FamilyProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </FamilyProvider>
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
});
