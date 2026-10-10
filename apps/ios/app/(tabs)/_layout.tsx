import { useEffect, useRef } from "react";
import { Tabs, useRouter } from "expo-router";

import { RaisedTabBar, type TabBarProps } from "@/components/raised-tab-bar";
import { useAuth } from "@/state/auth-context";
import { clearActiveWalkSession, getActiveWalkSession } from "@/lib/walk-tracking-service";
import { t } from "@/lib/i18n";

/**
 * R16 — a walk left running by a killed / evicted app must be resolved as soon
 * as the tabs mount, not only when the Walks tab happens to gain focus: until
 * then background location could keep recording with no tracking UI (breaking
 * the "background location only during a walk" promise). This also switches
 * off orphaned location updates (getActiveWalkSession) and drops another
 * account's session. The Walks tab's recovery hook then asks
 * "continue / end & save".
 */
function useActiveWalkLaunchCheck() {
  const router = useRouter();
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const checkedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!uid || checkedFor.current === uid) return;
    checkedFor.current = uid;
    let alive = true;
    void getActiveWalkSession()
      .then(async (session) => {
        if (!alive || !session) return;
        if (session.uid !== uid) {
          await clearActiveWalkSession(session.walkId).catch(() => {});
          return;
        }
        router.navigate("/(tabs)/walks");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [uid, router]);
}

export default function TabsLayout() {
  useActiveWalkLaunchCheck();
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      // Custom bar handles the raised center disc; cast to our minimal prop
      // shape to stay decoupled from the @react-navigation version.
      tabBar={(props) => (
        <RaisedTabBar {...(props as unknown as TabBarProps)} />
      )}
    >
      {/* Titles = the same Nav.* strings the bar shows (web app-nav t(key)). */}
      <Tabs.Screen name="index" options={{ title: t("Nav.home") }} />
      <Tabs.Screen name="pets" options={{ title: t("Nav.pets") }} />
      <Tabs.Screen name="walks" options={{ title: t("Nav.walks") }} />
      <Tabs.Screen name="leaderboard" options={{ title: t("Nav.leaderboard") }} />
      <Tabs.Screen name="settings" options={{ title: t("Nav.settings") }} />
    </Tabs>
  );
}
