import { Tabs } from "expo-router";

import { RaisedTabBar, type TabBarProps } from "@/components/raised-tab-bar";
import { t } from "@/lib/i18n";

export default function TabsLayout() {
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
