/**
 * Health record card — 1:1 with apps/web/src/components/pets/
 * pet-health-record-card.tsx: header row (42px tone square with the type's
 * lucide icon, uppercase type label in the tone colour + title, yyyy/MM/dd
 * date, optional trash button), then — when there is a detail or note — a
 * dashed-hairline divider with the big detail (e.g. "12.5 公斤") on the left
 * and a one-line note on the right.
 *
 * Tone per type (web TONE): weight → leaf, vaccine → brand, vet → peach /
 * cookie, feeding → brand tint, medication → cookie tint.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Pill,
  Scale,
  Stethoscope,
  Syringe,
  Trash2,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react-native";
import type {
  FeedingData,
  HealthRecord,
  HealthRecordType,
  MedicationData,
  VaccineData,
  VetData,
  WeightData,
} from "@mango/shared-types";

import { t } from "@/lib/i18n";
import { colors, radius, shadows } from "@/theme/theme";

type ToneSpec = { bg: string; fg: string; icon: LucideIcon };

const TONE: Record<HealthRecordType, ToneSpec> = {
  weight: { bg: colors.leafTint, fg: colors.leaf, icon: Scale },
  vaccine: { bg: colors.brandTint, fg: colors.brandDeep, icon: Syringe },
  vet: { bg: colors.peachTint, fg: colors.cookie, icon: Stethoscope },
  feeding: { bg: colors.brandTint, fg: colors.brandDeep, icon: UtensilsCrossed },
  medication: { bg: colors.cookieTint, fg: colors.cookie, icon: Pill },
};

/** Web summarize(): big detail + optional note + header title per type. */
function summarize(record: HealthRecord): {
  detail: string;
  note: string | null;
  title: string;
} {
  const notes = record.notes || null;
  switch (record.type) {
    case "weight": {
      const d = record.data as WeightData;
      return {
        detail: `${d.kg} ${t("PetsPage.kgUnit")}`,
        note: notes,
        title: t("PetsPage.health.weightRecordTitle"),
      };
    }
    case "feeding": {
      const d = record.data as FeedingData;
      const parts = [d.brand, d.amountG ? `${d.amountG}g` : null, d.foodType]
        .filter(Boolean)
        .join(" · ");
      return {
        detail: parts || "—",
        note: notes,
        title: d.brand || t("PetsPage.health.feedingRecordTitle"),
      };
    }
    case "vaccine": {
      const d = record.data as VaccineData;
      return { detail: d.name ?? "", note: notes, title: d.name ?? "" };
    }
    case "vet": {
      const d = record.data as VetData;
      return { detail: d.clinic ?? "", note: d.diagnosis || null, title: d.clinic ?? "" };
    }
    case "medication": {
      const d = record.data as MedicationData;
      return { detail: d.name ?? "", note: d.frequency || notes, title: d.name ?? "" };
    }
    default:
      return { detail: "", note: notes, title: "" };
  }
}

function ymd(ts: { toMillis?: () => number } | undefined): string {
  const millis = ts?.toMillis?.() ?? 0;
  if (!millis) return "";
  const d = new Date(millis);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}/${mm}/${dd}`;
}

export function HealthRecordCard({
  record,
  onDelete,
  busy = false,
}: {
  record: HealthRecord;
  onDelete?: () => void;
  /** A delete for this record is in flight (dims the card, disables trash). */
  busy?: boolean;
}) {
  const tone = TONE[record.type] ?? TONE.weight;
  const Icon = tone.icon;
  const { detail, note, title } = summarize(record);
  const typeLabel = t(`Health.types.${record.type}`);

  return (
    <View style={[styles.card, busy && styles.busy]}>
      <View style={styles.head}>
        <View
          style={[styles.icon, { backgroundColor: tone.bg }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Icon size={18} color={tone.fg} strokeWidth={1.8} />
        </View>
        <View style={styles.titleCol}>
          <Text style={[styles.typeLabel, { color: tone.fg }]}>{typeLabel}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Text style={styles.date}>{ymd(record.recordedAt)}</Text>
        {onDelete ? (
          <Pressable
            onPress={onDelete}
            disabled={busy}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${t("Common.delete")} ${typeLabel}`}
            accessibilityState={{ disabled: busy }}
            style={({ pressed }) => [styles.trash, pressed && styles.trashPressed]}
          >
            {({ pressed }) => (
              <Trash2 size={16} color={pressed ? colors.danger : colors.ink3} strokeWidth={2} />
            )}
          </Pressable>
        ) : null}
      </View>

      {detail || note ? (
        <>
          {/* iOS draws single-side dashed borders solid, so the dashed rule
              is the clipped top edge of a fully dashed box. */}
          <View style={styles.dashClip} accessibilityElementsHidden>
            <View style={styles.dashLine} />
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detail} numberOfLines={2}>
              {detail}
            </Text>
            {note ? (
              <Text style={styles.note} numberOfLines={1}>
                {note}
              </Text>
            ) : null}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // web rounded-[18px] border hairline bg-card p-3.5 shadow-card
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 14,
    ...shadows.card,
  },
  busy: { opacity: 0.55 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  // web size-[42px] rounded-[14px]
  icon: {
    width: 42,
    height: 42,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  titleCol: { flex: 1, minWidth: 0 },
  typeLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  title: {
    marginTop: 2,
    fontSize: 14.5,
    fontWeight: "700",
    letterSpacing: -0.1,
    color: colors.ink,
  },
  date: { flexShrink: 0, fontSize: 11.5, color: colors.ink3, fontVariant: ["tabular-nums"] },
  // web grid size-8 rounded-lg text-ink-3 (hitSlop 6 → 44pt)
  trash: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  trashPressed: { backgroundColor: colors.peachTint },
  // web mt-2.5 border-t border-dashed border-hairline pt-2.5
  dashClip: { marginTop: 10, height: 1, overflow: "hidden" },
  dashLine: {
    height: 2,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.hairline,
  },
  // web flex items-center justify-between gap-3
  detailRow: {
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  detail: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
    color: colors.ink,
  },
  note: { flexShrink: 1, fontSize: 12, color: colors.ink2, textAlign: "right" },
});
