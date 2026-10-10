// Bottom 5-tab nav — 1:1 with the web PWA app-nav.tsx mobile bar:
//  · a notched card-soft bar (SVG path, dip in the middle) + soft top shadow
//  · 4 side tabs: lucide icon (24) + 10px label + a 5px brand active dot;
//    active = brand-deep (icon nudged up), inactive = ink-2
//  · raised centre "walks" disc: 62px, top -16, brand→brand-deep gradient,
//    amber shadow + 5px cream (mango-bg) ring, white filled PawPrint + label.
// Matches web exactly (incl. pets + centre both PawPrint — the web does this).
// Labels come from the shared Nav.* catalog keys app-nav uses (t(key)).
// a11y: the row is a tablist and every slot a tab with selected state (web
// marks the active link aria-current="page"), so VoiceOver reads "tab, n of 5".
//
// iOS 26+ (LIQUID_GLASS): the same tabs + raised disc sit in a FLOATING Liquid
// Glass capsule instead of the notched bar; the disc's glass ring merges with
// the capsule through a GlassContainer. The bar overlays the screens (see
// useTabBarOverlap in @/lib/liquid-glass). docs/features/ios-liquid-glass.md.
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { GlassContainer, GlassView } from "expo-glass-effect";
import Svg, { Path } from "react-native-svg";
import {
  Home,
  PawPrint,
  Settings,
  Trophy,
  type LucideIcon,
} from "lucide-react-native";

import { t } from "@/lib/i18n";
import {
  GLASS_BAR_H,
  GLASS_DISC_RISE,
  LIQUID_GLASS,
  glassBarBottomGap,
} from "@/lib/liquid-glass";
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
// route name → web app-nav NavKey (Nav.<key> in the shared catalog).
export const TAB_NAV_KEYS: Record<string, string> = {
  index: "Nav.home",
  pets: "Nav.pets",
  walks: "Nav.walks",
  leaderboard: "Nav.leaderboard",
  settings: "Nav.settings",
};

/** Localised tab label for a (tabs) route name. */
export function tabLabel(routeName: string): string {
  const key = TAB_NAV_KEYS[routeName];
  return key ? t(key) : routeName;
}
const CENTER_ROUTE = "walks";
// Taller than the web px so the raised disc's real RN footprint (it pops up AND
// extends down) clears the centre label below it. The cream ring is a real
// circle here (RN has no box-shadow spread), so it adds layout — accounted for.
const BAR_H = 72;
const DISC = 62;
const RING = DISC + 10; // 5px cream ring (web box-shadow 0 0 0 5px mango-bg)
const DISC_TOP = -20;
// The notch SVG's viewBox is authored for a 390pt (iPhone) reference width and
// stretches with `preserveAspectRatio="none"` — rendering it at the RAW window
// width on iPad (768–1366pt) distorts the notch curve and spreads the 5 tabs
// across a huge gap. Cap the bar at the widest phone size and center it —
// a floating capsule nav on iPad, same bar on phone (width === MAX_BAR_WIDTH
// there, so this is a no-op below the cap). iPad QA pass, docs/features/
// ios-app-store-submission.md ⚠️-iPad.
const MAX_BAR_WIDTH = 430;
// Liquid Glass capsule: inset from the screen edges like the iOS 26 tab bar.
// Disc 56 inside a 66 glass ring whose top rises GLASS_DISC_RISE above the
// capsule; the ring's bottom (48) stays clear of the centre label (bottom 4).
const GLASS_SIDE_INSET = 16;
const GLASS_RING = 66;
const GLASS_DISC = 56;

export function RaisedTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(windowWidth, MAX_BAR_WIDTH);

  const press = (route: { key: string; name: string }, focused: boolean) => () => {
    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
  };

  const tabs = (glass: boolean) => (
    <View accessibilityRole="tablist" style={[styles.row, { height: glass ? GLASS_BAR_H : BAR_H }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const label = tabLabel(route.name);

        if (route.name === CENTER_ROUTE) {
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: focused }}
              onPress={press(route, focused)}
              style={styles.centerCell}
            >
              {/* Classic: cream ring around the disc. Glass: the ring is the
                  GlassView behind this row, so only the gradient core here. */}
              <View
                style={[
                  glass ? styles.glassDiscSlot : styles.discRing,
                  focused && styles.discActive,
                ]}
              >
                <LinearGradient
                  colors={[colors.brand, colors.brandDeep]}
                  start={{ x: 0.15, y: 0 }}
                  end={{ x: 0.85, y: 1 }}
                  style={glass ? styles.glassDiscCore : styles.discCore}
                >
                  <PawPrint size={glass ? 24 : 26} color="#ffffff" fill="#ffffff" strokeWidth={2} />
                </LinearGradient>
              </View>
              <Text style={[styles.centerLabel, glass && styles.glassCenterLabel]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        }

        const Icon = ICONS[route.name];
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={label}
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
              {label}
            </Text>
            <View style={[styles.dot, focused && styles.dotActive]} />
          </Pressable>
        );
      })}
    </View>
  );

  if (LIQUID_GLASS) {
    // Floating capsule, inset from the screen edges, overlaying the content.
    const gap = glassBarBottomGap(insets.bottom);
    const capsuleW = width - GLASS_SIDE_INSET * 2;
    return (
      <View
        pointerEvents="box-none"
        style={[styles.glassWrap, { height: gap + GLASS_BAR_H + GLASS_DISC_RISE }]}
      >
        <View
          style={[
            styles.glassFrame,
            { width: capsuleW, bottom: gap, left: (windowWidth - capsuleW) / 2 },
          ]}
        >
          {/* One container so the disc's glass ring and the capsule merge into
              a single liquid shape (spacing = merge distance). */}
          <GlassContainer spacing={14} style={StyleSheet.absoluteFill} pointerEvents="none">
            <GlassView glassEffectStyle="regular" colorScheme="light" style={styles.glassCapsule} />
            <GlassView
              glassEffectStyle="regular"
              colorScheme="light"
              style={[styles.glassRing, { left: (capsuleW - GLASS_RING) / 2 }]}
            />
          </GlassContainer>
          {tabs(true)}
        </View>
      </View>
    );
  }

  // ONE continuous SVG covers the notched bar AND the safe-area below it — no
  // two-piece seam. Scale the viewBox height with the render height so the notch
  // (y 0-40) keeps its pixel size while the extra fill extends straight down.
  const renderH = BAR_H + insets.bottom;
  const vbH = Math.round((78 * renderH) / BAR_H);
  const NOTCH = "M0,0 H143 C169,0 161,40 195,40 C229,40 221,0 247,0 H390";

  return (
    <View style={[styles.wrap, { height: renderH, width, alignSelf: "center" }]}>
      <View style={styles.barShadow} pointerEvents="none">
        <Svg width={width} height={renderH} viewBox={`0 0 390 ${vbH}`} preserveAspectRatio="none">
          {/* fill only — no stroke, so no seam line anywhere */}
          <Path d={`${NOTCH} V${vbH} H0 Z`} fill={colors.cardSoft} />
          {/* stroke ONLY the top edge + notch curve (open path) */}
          <Path
            d={NOTCH}
            fill="none"
            stroke={colors.hairline}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </Svg>
      </View>
      {tabs(false)}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative", backgroundColor: "transparent" },
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
  // ── Liquid Glass variant ──
  glassWrap: { position: "absolute", left: 0, right: 0, bottom: 0 },
  glassFrame: { position: "absolute", height: GLASS_BAR_H },
  glassCapsule: { ...StyleSheet.absoluteFill, borderRadius: GLASS_BAR_H / 2 },
  glassRing: {
    position: "absolute",
    top: -GLASS_DISC_RISE,
    width: GLASS_RING,
    height: GLASS_RING,
    borderRadius: GLASS_RING / 2,
  },
  // Centred in the glass ring (ring/disc are concentric).
  glassDiscSlot: {
    position: "absolute",
    top: -GLASS_DISC_RISE + (GLASS_RING - GLASS_DISC) / 2,
    width: GLASS_DISC,
    height: GLASS_DISC,
    borderRadius: GLASS_DISC / 2,
    shadowColor: colors.brand,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  glassDiscCore: {
    width: GLASS_DISC,
    height: GLASS_DISC,
    borderRadius: GLASS_DISC / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  glassCenterLabel: { bottom: 4 },
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
