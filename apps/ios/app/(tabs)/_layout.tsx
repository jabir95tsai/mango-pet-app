import { Tabs } from "expo-router";

import { GlassNavBar, type TabBarProps } from "@/components/ui/GlassNavBar";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      // Glass raised-disc bar; cast to our minimal prop shape to stay decoupled
      // from the @react-navigation version.
      tabBar={(props) => (
        <GlassNavBar {...(props as unknown as TabBarProps)} />
      )}
    >
      <Tabs.Screen name="index" options={{ title: "首頁" }} />
      <Tabs.Screen name="pets" options={{ title: "寵物" }} />
      <Tabs.Screen name="walks" options={{ title: "遛狗" }} />
      <Tabs.Screen name="leaderboard" options={{ title: "排行" }} />
      <Tabs.Screen name="settings" options={{ title: "設定" }} />
    </Tabs>
  );
}
