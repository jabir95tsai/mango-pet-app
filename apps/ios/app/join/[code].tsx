/**
 * Family join deep-link (P4b) — mirrors web /join/[code]. Validates a 6-digit
 * code, calls joinFamilyByCode, then bounces to the leaderboard (family now
 * active). Unauthenticated visitors are redirected to sign-in by the root
 * navigator before this renders. Reachable via mangopet://join/123456 and (once
 * universal links land, P7) the https invite URL.
 */
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useFamily } from "@/state/family-context";
import { joinFamilyByCode } from "@/lib/families-write";
import { t } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

type Status =
  | { kind: "joining" }
  | { kind: "joined" }
  | { kind: "alreadyMember" }
  | { kind: "invalidCode" }
  | { kind: "error" };

export default function JoinScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { refresh } = useFamily();
  const [status, setStatus] = useState<Status>({ kind: "joining" });

  useEffect(() => {
    const raw = (code ?? "").trim();
    if (!/^\d{6}$/.test(raw)) {
      setStatus({ kind: "invalidCode" });
      return;
    }
    let alive = true;
    let bounce: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      try {
        const res = await joinFamilyByCode(raw);
        if (!alive) return;
        if (res.alreadyMember) {
          setStatus({ kind: "alreadyMember" });
          return;
        }
        await refresh();
        if (!alive) return;
        setStatus({ kind: "joined" });
        bounce = setTimeout(() => router.replace("/(tabs)/leaderboard"), 1200);
      } catch {
        if (alive) setStatus({ kind: "error" });
      }
    })();
    return () => {
      alive = false;
      if (bounce) clearTimeout(bounce);
    };
  }, [code, refresh, router]);

  const message =
    status.kind === "joining"
      ? t("Join.joining")
      : status.kind === "joined"
        ? t("Join.joined")
        : status.kind === "alreadyMember"
          ? t("Join.alreadyMember")
          : status.kind === "invalidCode"
            ? t("Join.invalidCode")
            : t("Join.error");

  return (
    <SafeAreaView style={styles.flex}>
      <View style={styles.center}>
        {status.kind === "joining" ? (
          <ActivityIndicator color={colors.brand} size="large" />
        ) : (
          <Text style={styles.emoji}>
            {status.kind === "joined" ? "🎉" : status.kind === "alreadyMember" ? "👌" : "⚠️"}
          </Text>
        )}
        <Text style={styles.message}>{message}</Text>
        {status.kind !== "joining" && status.kind !== "joined" ? (
          <Pressable onPress={() => router.replace("/(tabs)/leaderboard")} style={styles.btn}>
            <Text style={styles.btnText}>{t("Join.back")}</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg, padding: spacing.xl },
  emoji: { fontSize: 48 },
  message: { fontSize: 16, fontWeight: "700", color: colors.ink, textAlign: "center" },
  btn: { height: 48, paddingHorizontal: spacing.xxl, borderRadius: radius.pill, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 15, fontWeight: "800", color: colors.card },
});
