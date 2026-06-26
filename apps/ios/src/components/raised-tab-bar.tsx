// Bottom 5-tab nav — 1:1 with the web PWA app-nav.tsx mobile bar:
//  · a notched card-soft bar (SVG path, dip in the middle) + soft top shadow
//  · 4 side tabs: lucide icon (24) + 10px label + a 5px brand active dot;
//    active = brand-deep (icon nudged up), inactive = ink-2
//  · raised centre "walks" disc: 62px, top -16, brand→brand-deep gradient,
//    amber shadow + 5px cream (mango-bg) ring, white filled PawPrint + label.
// Matches web exactly (incl. pets + centre both PawPrint — the web does this).
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import {
  Home,
  PawPrint,
  Settings,
  Trophy,
  type LucideIcon,
} from "lucide-react-native";

import { colors } from "@/theme/theme";

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

// Side-tab icons (centre handled separately). pets = PawPrint, like web.
const ICONS: Record<string, LucideIcon> = {
  index: Home,
  pets: PawPrint,
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
// Taller than the web px so the raised disc's real RN footprint (it pops up AND
// extends down) clears the centre label below it. The cream ring is a real
// circle here (RN has no box-shadow spread), so it adds layout — accounted for.
const BAR_H = 72;
const DISC = 62;
const RING = DISC + 10; // 5px cream ring (web box-shadow 0 0 0 5px mango-bg)
const DISC_TOP = -20;

export function RaisedTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const press = (route: { key: string; name: string }, focused: boolean) => () => {
    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
  };

  return (
    <View style={[styles.wrap, { height: BAR_H + insets.bottom }]}>
      {/* safe-area strip below the notched bar */}
      <View style={[styles.safeStrip, { height: insets.bottom }]} pointerEvents="none" />
      {/* notched card-soft bar */}
      <View style={styles.barShadow} pointerEvents="none">
        <Svg width={width} height={BAR_H} viewBox="0 0 390 78" preserveAspectRatio="none">
          <Path
            d="M0,0 H143 C169,0 161,40 195,40 C229,40 221,0 247,0 H390 V78 H0 Z"
            fill={colors.cardSoft}
            stroke={colors.hairline}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </Svg>
      </View>

      {/* tabs row */}
      <View style={[styles.row, { height: BAR_H }]}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;

          if (route.name === CENTER_ROUTE) {
            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityLabel={LABELS[route.name]}
                accessibilityState={{ selected: focused }}
                onPress={press(route, focused)}
                style={styles.centerCell}
              >
                <View style={[styles.discRing, focused && styles.discActive]}>
                  <LinearGradient
                    colors={[colors.brand, colors.brandDeep]}
                    start={{ x: 0.15, y: 0 }}
                    end={{ x: 0.85, y: 1 }}
                    style={styles.discCore}
                  >
                    <PawPrint size={26} color="#ffffff" fill="#ffffff" strokeWidth={2} />
                  </LinearGradient>
                </View>
                <Text style={styles.centerLabel}>{LABELS[route.name]}</Text>
              </Pressable>
            );
          }

          const Icon = ICONS[route.name];
          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityLabel={LABELS[route.name]}
              accessibilityState={{ selected: focused }}
              onPress={press(route, focused)}
              style={styles.tab}
            >
              {Icon ? (
                <Icon
                  size={24}
                  color={focused ? colors.brandDeep : colors.ink2}
                  strokeWidth={2}
                  style={focused ? styles.iconActive : undefined}
                />
              ) : null}
              <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
                {LABELS[route.name] ?? route.name}
              </Text>
              <View style={[styles.dot, focused && styles.dotActive]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative", backgroundColor: "transparent" },
  safeStrip: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.cardSoft,
  },
  barShadow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    shadowColor: "#50320a",
    shadowOpacity: 0.1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: -8 },
  },
  row: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row" },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 4 },
  iconActive: { transform: [{ translateY: -2 }] },
  label: { maxWidth: "100%", fontSize: 10, lineHeight: 12, fontWeight: "500", color: colors.ink2 },
  labelActive: { fontWeight: "700", color: colors.brandDeep },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.brand, opacity: 0 },
  dotActive: { opacity: 1 },
  centerCell: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  // 5px cream ring around the 62px disc (web: box-shadow 0 0 0 5px mango-bg).
  discRing: {
    position: "absolute",
    top: DISC_TOP,
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.brand,
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  discActive: { transform: [{ scale: 1.06 }] },
  discCore: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  // pinned to the cell bottom so the popped-up disc never covers it.
  centerLabel: {
    position: "absolute",
    bottom: 5,
    fontSize: 10.5,
    lineHeight: 12,
    fontWeight: "700",
    color: colors.brandDeep,
  },
});
