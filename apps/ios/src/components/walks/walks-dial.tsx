/**
 * Radial walk dial — 1:1 with apps/web/src/components/walks/walks-dial.tsx.
 * 232px container, R=96 / 14px stroke ring, solid brand (or leaf when complete)
 * arc over a warm-amber / leaf-tint background ring, white tick at top, a soft
 * gradient centre disc holding the walking dog, a leaf check badge on complete,
 * and a white numeric pill overlapping the bottom of the ring.
 *
 * The arc sweep animates (600ms) — preserved even under reduced-motion, since
 * it's progress feedback not decoration (matches web). Only the dog stops.
 */
import { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Check } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, G, RadialGradient, Stop } from "react-native-svg";
import Reanimated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { WalksPetWalking } from "./walks-pet-walking";
import { t } from "@/lib/i18n";
import { colors } from "@/theme/theme";

const SIZE = 232;
const R = 96;
const STROKE = 14;
const C = 2 * Math.PI * R;
const CENTER = SIZE / 2;

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);

type Props = {
  percent: number;
  complete: boolean;
  doneMin: number;
  goalMin: number;
};

function WalksDialBase({ percent, complete, doneMin, goalMin }: Props) {
  const clamped = Math.max(0, Math.min(1, percent / 100));
  const ringColor = complete ? "#5fa858" : "#f39800";
  const bgRing = complete ? "#e7f2dc" : "#f7e4c5";

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(clamped, { duration: 600, easing: Easing.out(Easing.ease) });
  }, [clamped, progress]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: C * (1 - progress.value),
  }));

  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={`${Math.round(doneMin)} / ${goalMin}`}>
      {/* web: radial-gradient(circle, rgba(95,168,88,.18) 0%, transparent 65%) */}
      {complete ? (
        <Svg width={GLOW} height={GLOW} style={styles.glow} pointerEvents="none">
          <Defs>
            <RadialGradient id="dialGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#5fa858" stopOpacity={0.18} />
              <Stop offset="65%" stopColor="#5fa858" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={GLOW / 2} cy={GLOW / 2} r={GLOW / 2} fill="url(#dialGlow)" />
        </Svg>
      ) : null}

      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        <G rotation={-90} originX={CENTER} originY={CENTER}>
          <Circle cx={CENTER} cy={CENTER} r={R} fill="none" stroke={bgRing} strokeWidth={STROKE} />
          <AnimatedCircle
            cx={CENTER}
            cy={CENTER}
            r={R}
            fill="none"
            stroke={ringColor}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={C}
            animatedProps={arcProps}
          />
          {/* tick at top */}
          <Circle cx={CENTER} cy={CENTER - R} r={3} fill="#ffffff" stroke="#eadfc4" strokeWidth={1.5} />
        </G>
      </Svg>

      {/* Centre gradient disc with the walking dog */}
      <LinearGradient
        colors={complete ? ["#fff7e0", "#ffeec2"] : ["#ffe9b8", "#ffcf75"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.disc}
      >
        <WalksPetWalking complete={complete} />
      </LinearGradient>

      {/* Goal-hit check badge */}
      {complete ? (
        // web: 38px leaf badge + 4px white ring OUTSIDE (46 overall), Check 20
        <View style={styles.checkRing}>
          <View style={styles.checkBadge}>
            <Check size={20} color="#ffffff" strokeWidth={3} />
          </View>
        </View>
      ) : null}

      {/* Numeric pill overlapping the bottom of the ring */}
      <View style={styles.pillWrap} pointerEvents="none">
        <View style={styles.pill}>
          <Text style={styles.pillDone}>{Math.round(doneMin)}</Text>
          <Text style={styles.pillGoal}>{` ${t("Walks.page.dialGoal", { goal: goalMin })}`}</Text>
        </View>
      </View>
    </View>
  );
}

export const WalksDial = memo(WalksDialBase);

const DISC = SIZE - 28 * 2; // inset-7
const GLOW = SIZE + 20;

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  glow: { position: "absolute", top: -10, left: -10 },
  disc: {
    position: "absolute",
    top: 28,
    left: 28,
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkRing: {
    position: "absolute",
    right: 14,
    bottom: 14,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3f8a3a",
    shadowOpacity: 0.55,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  checkBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.leaf,
    alignItems: "center",
    justifyContent: "center",
  },
  pillWrap: { position: "absolute", bottom: -6, left: 0, right: 0, alignItems: "center" },
  pill: {
    flexDirection: "row",
    alignItems: "baseline",
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
    shadowColor: "#50320a",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  pillDone: { fontSize: 22, fontWeight: "700", color: colors.ink, fontVariant: ["tabular-nums"] },
  pillGoal: { fontSize: 12, fontWeight: "600", color: colors.ink2 },
});
