/**
 * Leaderboard tab — dimension toggle (human / dog) over the two realtime
 * boards, 1:1 with web apps/web/src/app/app/leaderboard/page.tsx.
 *
 *  - The persisted dimension + both scopes are read BEFORE a board mounts
 *    (no wrong-board flash, no double subscribe); a read failure still
 *    renders with the defaults.
 *  - Tabs never unmount, so the boards' onSnapshot listeners are gated on
 *    `active` = app in the foreground AND this tab focused — with a grace
 *    period after leaving the tab: a fresh listener re-reads the whole board,
 *    so quick tab switches keep the existing one (delta updates only).
 *  - Each board is a virtualized FlatList whose header carries the toggle.
 *  - Both boards stay mounted (stacked, cross-faded): a swap never remounts,
 *    so no spinner→rows jump, no lost scroll, no toggle re-mount. The
 *    incoming list is scrolled to the outgoing offset so the toggle stays put.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, AppState, Easing, FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  HUMAN_SCOPE_KEY,
  HumanLeaderboard,
  type HumanScope,
} from "@/components/leaderboard/human-leaderboard";
import {
  DOG_SCOPE_KEY,
  DogLeaderboard,
  type DogScope,
} from "@/components/leaderboard/dog-leaderboard";
import { Dog, User } from "lucide-react-native";
import { Tabs } from "@/components/ui/Tabs";
import { BoardScroll, type BoardSlot } from "@/components/leaderboard/board-list";
import { WarmCanvas } from "@/components/ui/WarmCanvas";
import { t } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { colors, spacing } from "@/theme/theme";

const DIMENSION_KEY = "mango.leaderboard.dimension";
/** Keep listening this long after the tab loses focus (cheap delta updates
 *  vs. a full re-read when the user comes straight back). */
const BLUR_GRACE_MS = 2 * 60_000;
type Dimension = "human" | "dog";

type Prefs = { dimension: Dimension; humanScope: HumanScope; dogScope: DogScope };
const DEFAULTS: Prefs = { dimension: "human", humanScope: "all", dogScope: "friends" };

export default function LeaderboardScreen() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [dimension, setDimension] = useState<Dimension>(DEFAULTS.dimension);
  // 0 = human board visible, 1 = dog board visible.
  const swap = useRef(new Animated.Value(0)).current;
  const slots = useRef<Record<Dimension, BoardSlot>>({
    human: { ref: { current: null as FlatList | null }, y: { current: 0 } },
    dog: { ref: { current: null as FlatList | null }, y: { current: 0 } },
  }).current;
  const reduceMotion = useReducedMotion();
  const [focused, setFocused] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    AsyncStorage.multiGet([DIMENSION_KEY, HUMAN_SCOPE_KEY, DOG_SCOPE_KEY])
      .then((pairs) => {
        const v = Object.fromEntries(pairs);
        const next: Prefs = {
          dimension: v[DIMENSION_KEY] === "dog" ? "dog" : "human",
          humanScope: v[HUMAN_SCOPE_KEY] === "family" ? "family" : "all",
          dogScope: v[DOG_SCOPE_KEY] === "all" ? "all" : "friends",
        };
        if (alive) {
          setDimension(next.dimension);
          swap.setValue(next.dimension === "dog" ? 1 : 0);
          setPrefs(next);
        }
      })
      .catch(() => {
        if (alive) setPrefs(DEFAULTS);
      });
    return () => {
      alive = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
      blurTimer.current = null;
      setFocused(true);
      return () => {
        blurTimer.current = setTimeout(() => {
          blurTimer.current = null;
          setFocused(false);
        }, BLUR_GRACE_MS);
      };
    }, []),
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setForeground(s === "active"));
    return () => {
      sub.remove();
      if (blurTimer.current) clearTimeout(blurTimer.current);
    };
  }, []);

  function changeDimension(next: Dimension) {
    if (next === dimension) return;
    void AsyncStorage.setItem(DIMENSION_KEY, next).catch(() => {});
    // Line the incoming list up with the outgoing one so the toggle doesn't move.
    const y = slots[dimension].y.current;
    slots[next].ref.current?.scrollToOffset({ offset: y, animated: false });
    slots[next].y.current = y;
    setDimension(next);
    const to = next === "dog" ? 1 : 0;
    if (reduceMotion) {
      swap.setValue(to);
      return;
    }
    Animated.timing(swap, {
      toValue: to,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }

  const active = focused && foreground;

  // Icon-only switch beside the board title (layout T2).
  const toggle = (
    <Tabs
      warm
      size="icon"
      items={[
        { key: "human", label: "", accessibilityLabel: t("Leaderboard.dimension.human"), icon: User },
        { key: "dog", label: "", accessibilityLabel: t("Leaderboard.dimension.dog"), icon: Dog },
      ]}
      value={dimension}
      onChange={changeDimension}
    />
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.flex}>
      <WarmCanvas />
      {!prefs ? (
        <ActivityIndicator color={colors.brand} style={styles.loader} />
      ) : (
        <View style={styles.boards}>
          {(["human", "dog"] as const).map((d) => {
            const shown = d === dimension;
            return (
              <Animated.View
                key={d}
                style={[
                  StyleSheet.absoluteFill,
                  { opacity: d === "dog" ? swap : Animated.subtract(1, swap) },
                ]}
                pointerEvents={shown ? "auto" : "none"}
                accessibilityElementsHidden={!shown}
                importantForAccessibility={shown ? "auto" : "no-hide-descendants"}
              >
                <BoardScroll.Provider value={slots[d]}>
                  {d === "human" ? (
                    <HumanLeaderboard
                      active={active}
                      header={toggle}
                      initialScope={prefs.humanScope}
                      onCreateFamily={() => router.push("/family")}
                    />
                  ) : (
                    <DogLeaderboard
                      active={active}
                      header={toggle}
                      initialScope={prefs.dogScope}
                      onAddFriend={() => router.push("/friends")}
                    />
                  )}
                </BoardScroll.Provider>
              </Animated.View>
            );
          })}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  // transparent so WarmCanvas (and the glass controls on it) show through
  boards: { flex: 1 },
  loader: { marginTop: spacing.xxl },
  // web: page-level Tabs above each self-contained board
});
