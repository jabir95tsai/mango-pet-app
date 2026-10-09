/**
 * 健康 tab body — 1:1 with apps/web/src/components/pets/pet-health-body.tsx:
 *  - weight trend card: "體重趨勢 / 近 6 個月" header, the 70pt chart (or the
 *    "資料不足" placeholder with < 2 readings), then the current weight
 *    (latest reading, else pet.weightKg, else "—") and, with a chart, the
 *    "+0.4 kg / 6m" delta (leaf when ≥ 0, cookie when < 0)
 *  - the record list (newest first), each with a trash button
 *  - empty → the HeartPulse empty card with an add CTA (web EmptyHealth),
 *    shown only when there are no records AND no chart (web logic)
 *
 * Records are loaded per pet via useHealthRecords (reloadKey bumps reload
 * silently). Delete: optional `onDelete` override; by default the body
 * confirms (web handleDeleteRecord), deletes, reloads its list and calls
 * `onChanged`.
 */
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { HeartPulse, Plus } from "lucide-react-native";
import type { HealthRecord } from "@mango/shared-types";

import { Button } from "@/components/ui";
import { alertError, confirm } from "@/lib/confirm";
import { weightSeriesFromRecords } from "@/lib/health-data";
import { deleteHealthRecord } from "@/lib/health-write";
import { t } from "@/lib/i18n";
import { useHealthRecords } from "@/lib/use-health-records";
import { colors, radius, shadows, spacing } from "@/theme/theme";
import { HealthRecordCard } from "./health-record-card";
import { WeightChart } from "./weight-chart";

/** Web: 6 × 30 days. */
const SIX_MONTHS_MS = 6 * 30 * 86_400_000;

export function PetHealthBody({
  petId,
  reloadKey = 0,
  petWeightKg,
  onDelete,
  onAdd,
  onChanged,
}: {
  petId: string;
  reloadKey?: number;
  /** pet.weightKg — the current-weight fallback when there are no readings. */
  petWeightKg?: number | null;
  /** Override the built-in confirm + delete. */
  onDelete?: (r: HealthRecord) => void;
  /** Empty-state CTA (open the health form). Hidden when absent. */
  onAdd?: () => void;
  /** Called after the built-in delete succeeded. */
  onChanged?: () => void;
}) {
  const { loading, records, error, refreshing, reload, refresh } = useHealthRecords(
    petId,
    reloadKey,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const petRecords = useMemo(
    () =>
      records
        .filter((r) => !r.petId || r.petId === petId)
        .sort(
          (a, b) =>
            (b.recordedAt?.toMillis?.() ?? 0) - (a.recordedAt?.toMillis?.() ?? 0),
        ),
    [records, petId],
  );
  const weights = useMemo(() => weightSeriesFromRecords(petRecords), [petRecords]);

  const { current, delta, hasChart } = useMemo(() => {
    if (weights.length === 0) {
      return { current: petWeightKg ?? null, delta: null, hasChart: false };
    }
    const sorted = [...weights].sort((a, b) => a.date - b.date);
    const last = sorted[sorted.length - 1].kg;
    const sixMonthsAgo = Date.now() - SIX_MONTHS_MS;
    const oldRef = sorted.find((p) => p.date >= sixMonthsAgo)?.kg ?? sorted[0].kg;
    const d = +(last - oldRef).toFixed(1);
    return {
      current: last,
      delta: Number.isFinite(d) ? d : null,
      hasChart: weights.length >= 2,
    };
  }, [weights, petWeightKg]);

  async function handleDelete(r: HealthRecord) {
    if (onDelete) {
      onDelete(r);
      return;
    }
    if (deletingId) return;
    const ok = await confirm({
      title: t("Common.delete"),
      confirmLabel: t("Common.delete"),
      cancelLabel: t("Common.cancel"),
      destructive: true,
    });
    if (!ok) return;
    setDeletingId(r.recordId);
    try {
      await deleteHealthRecord(petId, r.recordId);
      await reload();
      onChanged?.();
    } catch (err) {
      alertError(err instanceof Error ? err.message : undefined);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  // Load failed with nothing to show → error + retry instead of "no records".
  if (error && petRecords.length === 0) {
    return (
      <View style={[styles.card, styles.empty]}>
        <Text style={styles.emptyText}>{t("Error.title")}</Text>
        <Button
          label={t("Error.retry")}
          variant="secondary"
          size="sm"
          loading={refreshing}
          onPress={() => void refresh()}
        />
      </View>
    );
  }

  if (petRecords.length === 0 && !hasChart) {
    return <EmptyHealth onAdd={onAdd} />;
  }

  return (
    <View style={styles.wrap}>
      {/* Weight trend card */}
      <View style={[styles.card, styles.trendCard]}>
        <View style={styles.trendHead}>
          <Text style={styles.trendTitle} accessibilityRole="header">
            {t("PetsPage.health.weightTrend")}
          </Text>
          <Text style={styles.trendRange}>{t("PetsPage.health.weightTrendRange")}</Text>
        </View>
        <View style={styles.chartBox}>
          {hasChart ? (
            <WeightChart points={weights} max={6} height={70} />
          ) : (
            <Text style={styles.insufficient}>
              {t("PetsPage.health.weightTrendInsufficient")}
            </Text>
          )}
        </View>
        <View style={styles.trendFoot}>
          {current != null ? (
            <Text style={styles.current}>
              {current}
              <Text style={styles.currentUnit}>{` ${t("PetsPage.kgUnit")}`}</Text>
            </Text>
          ) : (
            <Text style={[styles.current, styles.currentNone]}>—</Text>
          )}
          {delta != null && hasChart ? (
            <Text
              style={[styles.delta, { color: delta >= 0 ? colors.leaf : colors.cookie }]}
            >
              {`${delta >= 0 ? "+" : ""}${delta} kg / 6m`}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.list}>
        {petRecords.map((r) => (
          <HealthRecordCard
            key={r.recordId}
            record={r}
            busy={deletingId === r.recordId}
            onDelete={() => void handleDelete(r)}
          />
        ))}
      </View>
    </View>
  );
}

/** Web EmptyHealth: HeartPulse in a leaf-tint disc + message + tint add pill. */
function EmptyHealth({ onAdd }: { onAdd?: () => void }) {
  return (
    <View style={[styles.card, styles.empty]}>
      <View style={styles.emptyDisc}>
        <HeartPulse size={24} color={colors.leaf} strokeWidth={1.8} />
      </View>
      <Text style={styles.emptyText}>{t("PetsPage.health.empty")}</Text>
      {onAdd ? (
        <Pressable
          onPress={onAdd}
          hitSlop={{ top: 4, bottom: 4 }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.emptyCta, pressed && styles.emptyCtaPressed]}
        >
          <Plus size={16} color={colors.leaf} strokeWidth={2.5} />
          <Text style={styles.emptyCtaText}>{t("PetsPage.health.addCta")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // web flex-col gap-2.5 pt-1
  wrap: { gap: 10, paddingTop: 4 },
  center: { paddingVertical: spacing.xxl, alignItems: "center" },
  // web rounded-[18px] border hairline bg-card shadow-card
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...shadows.card,
  },
  // web px-3.5 pt-3.5 pb-2.5
  trendCard: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10 },
  trendHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  trendTitle: { fontSize: 13, fontWeight: "700", color: colors.ink },
  trendRange: { fontSize: 11.5, color: colors.ink3 },
  chartBox: { marginTop: 8 },
  // web rounded-md bg-bg-alt px-3 py-3 text-center text-[11.5px] ink-3
  insufficient: {
    overflow: "hidden",
    borderRadius: radius.sm,
    backgroundColor: colors.bgAlt,
    paddingHorizontal: 12,
    paddingVertical: 12,
    textAlign: "center",
    fontSize: 11.5,
    color: colors.ink3,
  },
  // web mt-1 flex items-baseline justify-between
  trendFoot: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  current: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  currentNone: { color: colors.ink3 },
  currentUnit: { fontSize: 12, fontWeight: "600", letterSpacing: 0, color: colors.ink2 },
  delta: { fontSize: 11.5, fontWeight: "700" },
  // web mt-2 flex-col gap-2.5
  list: { marginTop: 8, gap: 10 },
  // web mt-3 flex-col items-center gap-3 px-6 py-10
  empty: {
    marginTop: 12,
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  emptyDisc: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.leafTint,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { fontSize: 14, color: colors.ink2, textAlign: "center" },
  // web inline-flex h-9 gap-1 rounded-full bg-leaf-tint px-3 text-sm font-bold
  emptyCta: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.leafTint,
  },
  emptyCtaPressed: { opacity: 0.85 },
  emptyCtaText: { fontSize: 14, fontWeight: "700", color: colors.leaf },
});
