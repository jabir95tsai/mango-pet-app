// Custom 5-tab bottom nav with a raised center disc, aligned to web Epic 4
// Phase 0.5 IA: [home, pets, walks(center), leaderboard, settings]. The center
// "walks" tab floats above the bar as a brand disc — the core 遛狗 entry point.
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Footprints,
  Home,
  PawPrint,
  Settings,
  Trophy,
  type LucideIcon,
} from "lucide-react-native";

import { colors, radius, spacing } from "@/theme/theme";

// Minimal structural type of what React Navigation hands a custom tabBar.
// Typed locally to avoid coupling to a specific @react-navigation version.
export type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    navigate: (name: string) => void;
    emit: (event: {
      type: "tabPress";
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
  };
};

// Icons are the SAME lucide set as web app-nav (lucide-react-native ↔
// lucide-react): home→Home, pets→PawPrint, walks→Footprints, leaderboard→
// Trophy, settings→Settings. Web's NAV_ITEMS maps walks→Footprints; the raised
// centre uses Footprints here (per iOS PM directive) so pets (PawPrint) and
// walks (Footprints) read as distinct, not two paws. Labels are the shared-i18n
// Nav catalog values verbatim (我的寵物 / 排行榜).
const ICONS: Record<string, LucideIcon> = {
  index: Home,
  pets: PawPrint,
  walks: Footprints,
  leaderboard: Trophy,
  settings: Settings,
};

const LABELS: Record<string, string> = {
  index: "首頁",
  pets: "我的寵物",
  walks: "遛狗",
  leaderboard: "排行榜",
  settings: "設定",
};

const CENTER_ROUTE = "walks";

export function RaisedTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom || spacing.sm }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const isCenter = route.name === CENTER_ROUTE;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const Icon = ICONS[route.name];

        if (isCenter) {
          return (
            <View key={route.key} style={styles.centerSlot}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={LABELS[route.name]}
                accessibilityState={{ selected: focused }}
                onPress={onPress}
                style={({ pressed }) => [
                  styles.centerDisc,
                  pressed && styles.pressed,
                ]}
              >
                {Icon ? <Icon size={26} color="#ffffff" strokeWidth={2} /> : null}
              </Pressable>
              <Text style={styles.centerLabel}>{LABELS[route.name]}</Text>
            </View>
          );
        }

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityLabel={LABELS[route.name]}
            accessibilityState={{ selected: focused }}
            onPress={onPress}
            style={styles.tab}
          >
            {Icon ? (
              <Icon
                size={24}
                color={focused ? colors.brandDeep : colors.ink3}
                strokeWidth={2}
              />
            ) : null}
            <Text style={[styles.label, focused && styles.labelActive]}>
              {LABELS[route.name] ?? route.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    paddingTop: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: spacing.xs,
  },
  label: { fontSize: 10, color: colors.ink3, marginTop: 2 },
  labelActive: { color: colors.brandDeep, fontWeight: "700" },
  centerSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  centerDisc: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -28,
    borderWidth: 4,
    borderColor: colors.card,
    shadowColor: colors.paw,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  centerLabel: {
    fontSize: 10,
    color: colors.brandDeep,
    fontWeight: "700",
    marginTop: 2,
  },
  pressed: { opacity: 0.85 },
});
