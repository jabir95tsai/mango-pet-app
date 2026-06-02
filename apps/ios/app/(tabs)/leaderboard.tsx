/**
 * Leaderboard tab (P4a) — dimension toggle (human/dog, persisted) over the two
 * realtime boards. Mirrors web apps/web/src/app/app/leaderboard/page.tsx.
 */
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { HumanLeaderboard } from "@/components/leaderboard/human-leaderboard";
import { DogLeaderboard } from "@/components/leaderboard/dog-leaderboard";
import { Segmented } from "@/components/leaderboard/segmented";
import { t } from "@/lib/i18n";
import { colors, spacing } from "@/theme/theme";

const DIMENSION_KEY = "mango.leaderboard.dimension";
type Dimension = "human" | "dog";

export default function LeaderboardScreen() {
  const router = useRouter();
  const [dimension, setDimension] = useState<Dimension>("human");

  useEffect(() => {
    AsyncStorage.getItem(DIMENSION_KEY).then((v) => {
      if (v === "human" || v === "dog") setDimension(v);
    });
  }, []);

  function changeDimension(next: Dimension) {
    setDimension(next);
    void AsyncStorage.setItem(DIMENSION_KEY, next);
  }

  // Family management screen lands in P4b; route to settings (its future home)
  // for now. Repointed to /family in P4b.
  const goFamily = () => router.push("/(tabs)/settings");

  return (
    <SafeAreaView edges={["top"]} style={styles.flex}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("Leaderboard.title")}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Segmented
          options={[
            { value: "human", label: t("Leaderboard.dimension.human") },
            { value: "dog", label: t("Leaderboard.dimension.dog") },
          ]}
          value={dimension}
          onChange={changeDimension}
        />
        <View style={styles.board}>
          {dimension === "human" ? (
            <HumanLeaderboard onCreateFamily={goFamily} />
          ) : (
            <DogLeaderboard onAddFriend={goFamily} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  title: { fontSize: 22, fontWeight: "800", color: colors.ink },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  board: { marginTop: spacing.sm },
});
