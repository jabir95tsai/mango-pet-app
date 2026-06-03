/**
 * Recent-walk row — re-aligned to apps/web/src/components/walks/walk-card.tsx:
 * white card (rounded-lg, hairline, shadow-card), a 40px icon disc (brand-tint
 * footprints / bg-alt hand for manual), name + relative time, date line, and a
 * 3-col 📏km · ⏱️min · ⭐score grid (score in brand-deep).
 */
import { StyleSheet, Text, View } from "react-native";
import type { Walk } from "@mango/shared-types";

import { colors, radius, shadows, spacing } from "@/theme/theme";

function formatWhen(walk: Walk): { date: string; rel: string } {
  const ts = walk.startedAt as { toMillis?: () => number } | undefined;
  if (!ts?.toMillis) return { date: "", rel: "" };
  const d = new Date(ts.toMillis());
  const now = new Date();
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${time}`;
  const sameDay = d.toDateString() === now.toDateString();
  const rel = sameDay ? "今天" : `${d.getMonth() + 1}/${d.getDate()}`;
  return { date, rel };
}

export function WalkRow({ walk }: { walk: Walk }) {
  const { date, rel } = formatWhen(walk);
  return (
    <View style={styles.row}>
      <View style={[styles.icon, walk.isManual ? styles.iconManual : styles.iconWalk]}>
        <Text style={styles.iconEmoji}>{walk.isManual ? "✋" : "🐾"}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {walk.petName ?? "🐾"}
          </Text>
          <Text style={styles.rel}>{rel}</Text>
        </View>
        <Text style={styles.date}>{date}</Text>
        <View style={styles.grid}>
          <Text style={styles.stat}>{`📏 ${(walk.distanceKm ?? 0).toFixed(2)} km`}</Text>
          <Text style={styles.stat}>{`⏱️ ${Math.round(walk.durationMin ?? 0)} min`}</Text>
          <Text style={styles.statScore}>{`⭐ ${(walk.score ?? 0).toFixed(1)}`}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWalk: { backgroundColor: colors.brandTint },
  iconManual: { backgroundColor: colors.bgAlt },
  iconEmoji: { fontSize: 18 },
  body: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  title: { fontSize: 14, fontWeight: "600", color: colors.ink },
  rel: { fontSize: 12, color: colors.ink2 },
  date: { fontSize: 12, color: colors.ink2, marginTop: 2 },
  grid: { flexDirection: "row", marginTop: 8, gap: spacing.sm },
  stat: { flex: 1, fontSize: 13, color: colors.ink },
  statScore: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.brandDeep },
});
