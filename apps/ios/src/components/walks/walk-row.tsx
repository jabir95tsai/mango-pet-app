/**
 * Recent-walk row — compact summary (date · distance · duration). Read-only for
 * P1a; delete / detail are P1b. Mirrors the web walk-row data surface.
 */
import { StyleSheet, Text, View } from "react-native";
import type { Walk } from "@mango/shared-types";

import { colors, radius, spacing } from "@/theme/theme";

function formatWhen(walk: Walk): string {
  const ts = walk.startedAt as { toMillis?: () => number } | undefined;
  if (!ts?.toMillis) return "";
  const d = new Date(ts.toMillis());
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
  if (sameDay) return `今天 ${time}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${time}`;
}

export function WalkRow({ walk }: { walk: Walk }) {
  return (
    <View style={styles.row}>
      <View style={styles.icon}>
        <Text style={styles.iconEmoji}>{walk.isManual ? "✍️" : "🐾"}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {walk.petName ?? "遛狗"}
        </Text>
        <Text style={styles.sub}>{formatWhen(walk)}</Text>
      </View>
      <View style={styles.stats}>
        <Text style={styles.statMain}>{`${(walk.distanceKm ?? 0).toFixed(2)} km`}</Text>
        <Text style={styles.statSub}>{`${Math.round(walk.durationMin ?? 0)} 分`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  iconEmoji: { fontSize: 18 },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: "700", color: colors.ink },
  sub: { fontSize: 12, color: colors.ink3 },
  stats: { alignItems: "flex-end" },
  statMain: { fontSize: 15, fontWeight: "800", color: colors.ink },
  statSub: { fontSize: 12, color: colors.ink2 },
});
