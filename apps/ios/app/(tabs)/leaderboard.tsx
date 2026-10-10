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
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, StyleSheet, View } from "react-native";
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
import { Segmented } from "@/components/leaderboard/segmented";
import { t } from "@/lib/i18n";
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
    setDimension(next);
    void AsyncStorage.setItem(DIMENSION_KEY, next).catch(() => {});
  }

  const active = focused && foreground;

  const toggle = (
    <View style={styles.toggle}>
      <Segmented
        options={[
          { value: "human", label: `🧑 ${t("Leaderboard.dimension.human")}` },
          { value: "dog", label: `🐕 ${t("Leaderboard.dimension.dog")}` },
        ]}
        value={dimension}
        onChange={changeDimension}
      />
    </View>
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.flex}>
      {!prefs ? (
        <ActivityIndicator color={colors.brand} style={styles.loader} />
      ) : dimension === "human" ? (
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  loader: { marginTop: spacing.xxl },
  // web: page-level Tabs above each self-contained board
  toggle: { marginBottom: spacing.lg },
});
