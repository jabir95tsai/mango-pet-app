/**
 * Walking dog avatar — 1:1 RN port of apps/web/src/components/walks/
 * walks-pet-walking.tsx (the cartoon dog in the centre of the walks dial).
 * Same 200×140 viewBox geometry/colours; the web's 5 CSS keyframes (bob /
 * legA swing / legB swing / tail wag / ground drift) are reproduced with two
 * Reanimated linear drivers feeding sin/cos. complete=true relaxes the gait,
 * curves the eye, opens the mouth + tongue. Reduced-motion → fully static.
 */
import { useEffect } from "react";
import Reanimated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";

import { useReducedMotion } from "@/lib/use-reduced-motion";

const AnimatedG = Reanimated.createAnimatedComponent(G);
const TWO_PI = Math.PI * 2;

export function WalksPetWalking({ complete }: { complete: boolean }) {
  const reduceMotion = useReducedMotion();
  const durMs = complete ? 900 : 450;

  const t = useSharedValue(0); // body / legs / ground, linear 0→1 loop
  const tw = useSharedValue(0); // tail wag, faster loop

  useEffect(() => {
    if (reduceMotion) {
      t.value = 0;
      tw.value = 0;
      return;
    }
    t.value = 0;
    t.value = withRepeat(withTiming(1, { duration: durMs, easing: Easing.linear }), -1, false);
    tw.value = 0;
    tw.value = withRepeat(withTiming(1, { duration: 360, easing: Easing.linear }), -1, false);
  }, [reduceMotion, durMs, t, tw]);

  // Body bob: 0 → -2 → 0.
  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -2 * Math.sin(t.value * Math.PI) }],
  }));
  // Legs swing ±18° around their top anchor (A in phase, B opposite).
  const legA = useAnimatedProps(() => ({ rotation: 18 * Math.cos(t.value * TWO_PI) }));
  const legB = useAnimatedProps(() => ({ rotation: -18 * Math.cos(t.value * TWO_PI) }));
  // Tail wag: -6° → 22°.
  const tail = useAnimatedProps(() => ({ rotation: 8 - 14 * Math.cos(tw.value * TWO_PI) }));
  // Ground dots drift left.
  const ground = useAnimatedProps(() => ({ translateX: -24 * t.value } as { translateX: number }));

  return (
    <Reanimated.View style={[{ width: 85, height: 65 }, bodyStyle]}>
      <Svg width={85} height={65} viewBox="0 0 200 140">
        {/* Moving ground dots */}
        <AnimatedG animatedProps={ground}>
          {[-10, 20, 50, 80, 110, 140, 170, 200, 230].map((x) => (
            <Circle key={x} cx={x} cy={128} r={1.6} fill="#c9b27f" opacity={0.55} />
          ))}
        </AnimatedG>
        {/* Contact shadow */}
        <Ellipse cx={100} cy={126} rx={56} ry={4} fill="#000" opacity={0.08} />

        {/* Far-side back leg */}
        <AnimatedG origin="52.5, 82" animatedProps={legB}>
          <Rect x={58} y={82} width={9} height={32} rx={3} fill="#b4773a" />
        </AnimatedG>
        {/* Near-side back leg */}
        <AnimatedG origin="52.5, 82" animatedProps={legA}>
          <Rect x={48} y={82} width={9} height={32} rx={3} fill="#d99258" />
        </AnimatedG>

        {/* Tail */}
        <AnimatedG origin="48, 56" animatedProps={tail}>
          <Path d="M52 64 Q34 50 44 28 Q54 42 62 60 Z" fill="#d99258" />
        </AnimatedG>

        {/* Body */}
        <Ellipse cx={100} cy={72} rx={52} ry={22} fill="#e8a85a" />
        <Ellipse cx={100} cy={84} rx={40} ry={8} fill="#fff5d8" opacity={0.7} />

        {/* Head */}
        <Circle cx={150} cy={56} r={22} fill="#e8a85a" />
        <Path d="M156 36 L170 28 L165 52 Z" fill="#b4773a" />
        <Ellipse cx={170} cy={64} rx={14} ry={9} fill="#fff5d8" />
        <Ellipse cx={180} cy={61} rx={3.2} ry={2.6} fill="#231b14" />
        {complete ? (
          <Path d="M150 52 Q154 49 158 52" stroke="#231b14" strokeWidth={2} fill="none" strokeLinecap="round" />
        ) : (
          <Circle cx={154} cy={52} r={2.2} fill="#231b14" />
        )}
        <Path
          d={complete ? "M167 70 Q172 76 178 70" : "M170 70 Q173 72 178 70"}
          stroke="#231b14"
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
        />
        {complete ? <Ellipse cx={173} cy={73} rx={3.5} ry={2.2} fill="#ff8e8e" /> : null}
        <Circle cx={142} cy={68} r={3} fill="#ffb3ba" opacity={0.55} />

        {/* Far-side front leg */}
        <AnimatedG origin="142.5, 86" animatedProps={legB}>
          <Rect x={138} y={86} width={9} height={32} rx={3} fill="#b4773a" />
        </AnimatedG>
        {/* Near-side front leg */}
        <AnimatedG origin="142.5, 86" animatedProps={legA}>
          <Rect x={128} y={86} width={9} height={32} rx={3} fill="#d99258" />
        </AnimatedG>
      </Svg>
    </Reanimated.View>
  );
}
