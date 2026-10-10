/**
 * /family — a back-header screen around the single FamilySection (web has no
 * separate family page: family management lives in settings). The route stays
 * because the home invite card and the leaderboard push to it; it adds the
 * iOS-only invite QR to the code row. Refetches members on focus and on
 * pull-to-refresh.
 */
import { useCallback, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";

import { RouteHeader } from "@/components/ui";
import { FamilySection } from "@/components/settings/family-section";
import { useFamily } from "@/state/family-context";
import { t } from "@/lib/i18n";
import { colors, spacing, CONTENT_MAX_WIDTH } from "@/theme/theme";

export default function FamilyScreen() {
  const router = useRouter();
  const { refresh } = useFamily();
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const firstFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      setReloadKey((k) => k + 1);
    }, []),
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setReloadKey((k) => k + 1);
      setRefreshing(false);
    }
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.flex}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.brand} />
        }
      >
        <RouteHeader title={t("Family.title")} onBack={() => router.back()} />
        <FamilySection reloadKey={reloadKey} showQr />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
});
