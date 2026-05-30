import { Tabs } from "expo-router";

import { RaisedTabBar, type TabBarProps } from "@/components/raised-tab-bar";

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
      <Tabs.Screen name="index" options={{ title: "首頁" }} />
      <Tabs.Screen name="pets" options={{ title: "寵物" }} />
      <Tabs.Screen name="walks" options={{ title: "遛狗" }} />
      <Tabs.Screen name="leaderboard" options={{ title: "排行" }} />
      <Tabs.Screen name="settings" options={{ title: "設定" }} />
    </Tabs>
  );
}
