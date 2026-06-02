/**
 * Health tab body — weight trend chart (last 6 weight points) + a timeline of
 * HealthRecordCards (newest first). Loads its own nested records via
 * useHealthRecords when the active pet changes. Mirrors web's health tab.
 * The multi-type add form (weight syncs pet.weightKg) lands in P2c.
 */
import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { weightSeriesFromRecords } from "@/lib/health-data";
import { useHealthRecords } from "@/lib/use-health-records";
import { scoped } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";
import { WeightChart } from "./weight-chart";
import { HealthRecordCard } from "./health-record-card";

const tPP = scoped("PetsPage");
const tH = scoped("Health");

export function PetHealthBody({
  petId,
  reloadKey = 0,
}: {
  petId: string;
  reloadKey?: number;
}) {
  const { loading, records } = useHealthRecords(petId, reloadKey);
  const weightPoints = useMemo(
    () => weightSeriesFromRecords(records),
    [records],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (records.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyEmoji}>🩺</Text>
        <Text style={styles.emptyText}>{tPP("health.empty")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>{tH("weightChart")}</Text>
        <WeightChart points={weightPoints} max={6} />
      </View>

      <Text style={styles.sectionTitle}>{tH("timeline")}</Text>
      <View style={styles.list}>
        {records.map((r) => (
          <HealthRecordCard key={r.recordId} record={r} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  center: { paddingVertical: spacing.xxl, alignItems: "center" },
  chartCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink2,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.ink,
    paddingHorizontal: spacing.xs,
  },
  list: { gap: spacing.sm },
  emptyBox: { alignItems: "center", paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontSize: 14, color: colors.ink3 },
});
