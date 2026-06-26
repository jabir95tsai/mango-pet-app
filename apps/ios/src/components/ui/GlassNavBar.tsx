/**
 * GlassNavBar — the bottom 5-tab nav in the Apple-Glass material. A thin
 * frosted bar (BlurView) carrying the four side tabs (lucide icons, same as the
 * solid RaisedTabBar), plus a raised centre "walks" disc that FLOATS above the
 * bar. The disc is rendered as an absolute overlay — not inside the BlurView —
 * because the blur is `overflow:hidden` and would clip anything popping out the
 * top. Disc = thick-glass ring + mango-gradient core + Footprints.
 *
 * Reduce-transparency falls back to opaque warm surfaces via GlassSurface.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  Footprints,
  Home,
  PawPrint,
  Settings,
  Trophy,
  type LucideIcon,
} from "lucide-react-native";

import { GlassSurface } from "./GlassSurface";
import { colors, glassRadius, mangoGradient, spacing } from "@/theme/theme";

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
const DISC = 60;

export function GlassNavBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  const press = (route: { key: string; name: string }, focused: boolean) => () => {
    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
  };

  const centerRoute = state.routes.find((r) => r.name === CENTER_ROUTE);
  const centerFocused = centerRoute
    ? state.index === state.routes.indexOf(centerRoute)
    : false;
  const CenterIcon = ICONS[CENTER_ROUTE];

  return (
    <View style={styles.wrap}>
      <GlassSurface
        level="thin"
        radius={0}
        shadow={false}
        edge={false}
        contentStyle={[styles.bar, { paddingBottom: insets.bottom || spacing.sm }]}
      >
        <View style={styles.topHairline} pointerEvents="none" />
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const Icon = ICONS[route.name];
          if (route.name === CENTER_ROUTE) {
            // spacer slot — the floating disc sits above it (overlay below)
            return (
              <View key={route.key} style={styles.centerSlot}>
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
              onPress={press(route, focused)}
              style={styles.tab}
            >
              {Icon ? (
                <Icon size={24} color={focused ? colors.brandDeep : colors.ink3} strokeWidth={2} />
              ) : null}
              <Text style={[styles.label, focused && styles.labelActive]}>
                {LABELS[route.name] ?? route.name}
              </Text>
            </Pressable>
          );
        })}
      </GlassSurface>

      {/* Floating raised disc — absolute overlay so it escapes the blur clip. */}
      {centerRoute ? (
        <View style={styles.discLayer} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={LABELS[CENTER_ROUTE]}
            accessibilityState={{ selected: centerFocused }}
            onPress={press(centerRoute, centerFocused)}
            style={({ pressed }) => [styles.disc, pressed && styles.discPressed]}
          >
            <GlassSurface
              level="thick"
              radius={DISC / 2}
              contentStyle={styles.discRing}
            >
              <LinearGradient
                colors={mangoGradient.colors}
                locations={mangoGradient.locations}
                start={mangoGradient.start}
                end={mangoGradient.end}
                style={styles.discCore}
              >
                {CenterIcon ? <CenterIcon size={26} color="#ffffff" strokeWidth={2} /> : null}
              </LinearGradient>
            </GlassSurface>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative" },
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingTop: spacing.sm,
  },
  topHairline: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, paddingVertical: spacing.xs },
  label: { fontSize: 10, color: colors.ink3, marginTop: 2 },
  labelActive: { color: colors.brandDeep, fontWeight: "700" },
  centerSlot: { flex: 1, alignItems: "center", justifyContent: "flex-end", paddingVertical: spacing.xs },
  centerLabel: { fontSize: 10, color: colors.brandDeep, fontWeight: "700", marginTop: 2 },
  // overlay spanning the bar; the disc is centred horizontally and pushed up.
  discLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
  },
  disc: { position: "absolute", top: -22 },
  discPressed: { opacity: 0.92, transform: [{ scale: 0.97 }] },
  discRing: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  discCore: {
    width: DISC - 8,
    height: DISC - 8,
    borderRadius: (DISC - 8) / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
