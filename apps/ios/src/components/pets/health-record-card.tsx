/**
 * One health-record row — type icon + type label + date + a per-type summary
 * of the polymorphic `data`. Mirrors web's HealthRecordCard surface
 * (read-only; edit/delete + the add form land in P2c).
 */
import { StyleSheet, Text, View } from "react-native";
import type {
  FeedingData,
  HealthRecord,
  HealthRecordType,
  MedicationData,
  VaccineData,
  VetData,
  WeightData,
} from "@mango/shared-types";

import { monthDay } from "@/lib/format";
import { scoped } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

const tH = scoped("Health");

const TYPE_EMOJI: Record<HealthRecordType, string> = {
  weight: "⚖️",
  feeding: "🍽️",
  vaccine: "💉",
  vet: "🏥",
  medication: "💊",
};

const TYPE_TINT: Record<HealthRecordType, string> = {
  weight: colors.brandTint,
  feeding: colors.cookieTint,
  vaccine: colors.leafTint,
  vet: colors.peachTint,
  medication: colors.bellTint,
};

/** Short one-line summary of the polymorphic `data`, per record type. */
function summarize(record: HealthRecord): string {
  switch (record.type) {
    case "weight": {
      const d = record.data as WeightData;
      return `${d.kg} ${tH("fields.kg")}`;
    }
    case "feeding": {
      const d = record.data as FeedingData;
      return (
        [d.brand, d.foodType, d.amountG != null ? `${d.amountG}g` : null]
          .filter(Boolean)
          .join(" · ") || tH("types.feeding")
      );
    }
    case "vaccine": {
      const d = record.data as VaccineData;
      return d.name || tH("types.vaccine");
    }
    case "vet": {
      const d = record.data as VetData;
      return [d.clinic, d.diagnosis].filter(Boolean).join(" · ") || tH("types.vet");
    }
    case "medication": {
      const d = record.data as MedicationData;
      return [d.name, d.frequency].filter(Boolean).join(" · ") || tH("types.medication");
    }
    default:
      return "";
  }
}

export function HealthRecordCard({ record }: { record: HealthRecord }) {
  return (
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: TYPE_TINT[record.type] }]}>
        <Text style={styles.iconText}>{TYPE_EMOJI[record.type]}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {tH(`types.${record.type}`)}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {summarize(record)}
        </Text>
        {record.notes ? (
          <Text style={styles.notes} numberOfLines={2}>
            {record.notes}
          </Text>
        ) : null}
      </View>
      <Text style={styles.date}>{monthDay(record.recordedAt)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontSize: 17 },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: "700", color: colors.ink },
  sub: { fontSize: 13, color: colors.ink2 },
  notes: { fontSize: 12, color: colors.ink3, marginTop: 2 },
  date: { fontSize: 12, color: colors.ink3, marginTop: 2 },
});
