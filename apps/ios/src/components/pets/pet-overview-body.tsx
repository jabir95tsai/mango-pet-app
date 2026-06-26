/**
 * Overview tab body — 2×2 StatGrid (next reminder / month spend / weight /
 * walk days) + an "即將到期" upcoming-reminder card + a "最近開銷" recent-
 * expense card. The two cards reuse the shared PetReminderCard /
 * PetExpenseCard (read-only here — no action handlers), and empty states are
 * white rounded cards, all 1:1 with web pet-overview-body. Month math comes
 * from @mango/shared-business.
 */
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Bell, Cookie, PawPrint, Scale, type LucideIcon } from "lucide-react-native";
import { dayDiffFromNow, startOfMonth } from "@mango/shared-business";
import type { Expense, Pet, Reminder, Walk } from "@mango/shared-types";

import { groupThousands } from "@/lib/format";
import { scoped } from "@/lib/i18n";
import { colors, radius, shadows, spacing } from "@/theme/theme";
import { PetReminderCard } from "./pet-reminder-card";
import { PetExpenseCard } from "./pet-expense-card";

const tPP = scoped("PetsPage");

function ms(ts: { toMillis?: () => number } | undefined): number {
  return ts?.toMillis?.() ?? 0;
}

type StatTone = "brand" | "leaf" | "cookie";

const ICON_BG: Record<StatTone, string> = {
  brand: colors.brandTint,
  cookie: colors.cookieTint,
  leaf: colors.leafTint,
};
const ICON_FG: Record<StatTone, string> = {
  brand: colors.brandDeep,
  cookie: colors.cookie,
  leaf: colors.leaf,
};
const SUB_COLOR = {
  brand: colors.brandDeep,
  cookie: colors.cookie,
  leaf: colors.leaf,
  muted: colors.ink3,
} as const;

function PetStatTile({
  Icon,
  label,
  value,
  unit,
  sub,
  tone,
  subTone = "muted",
}: {
  Icon: LucideIcon;
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  tone: StatTone;
  subTone?: StatTone | "muted";
}) {
  return (
    <View style={styles.tile}>
      <View style={styles.tileHead}>
        <View style={[styles.tileIcon, { backgroundColor: ICON_BG[tone] }]}>
          <Icon size={16} color={ICON_FG[tone]} strokeWidth={1.8} />
        </View>
        <Text style={styles.tileLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={styles.tileValueRow}>
        <Text style={styles.tileValue}>{value}</Text>
        {unit ? <Text style={styles.tileUnit}>{unit}</Text> : null}
      </View>
      {sub ? (
        <Text style={[styles.tileSub, { color: SUB_COLOR[subTone] }]} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export function PetOverviewBody({
  pet,
  reminders,
  expenses,
  walks,
}: {
  pet: Pet;
  reminders: Reminder[];
  expenses: Expense[];
  walks: Walk[];
}) {
  const petReminders = useMemo(
    () =>
      reminders
        .filter((r) => r.petId === pet.petId && !r.done)
        .sort((a, b) => ms(a.triggerAt) - ms(b.triggerAt)),
    [reminders, pet.petId],
  );
  const petExpenses = useMemo(
    () =>
      expenses
        .filter((e) => e.petId === pet.petId)
        .sort((a, b) => ms(b.spentAt) - ms(a.spentAt)),
    [expenses, pet.petId],
  );

  const nextR = petReminders[0];
  const recentE = petExpenses[0];

  const monthSpend = useMemo(() => {
    const start = startOfMonth().getTime();
    return expenses
      .filter((e) => e.petId === pet.petId && ms(e.spentAt) >= start)
      .reduce((s, e) => s + e.amount, 0);
  }, [expenses, pet.petId]);

  const walkDays = useMemo(() => {
    const start = startOfMonth().getTime();
    const days = new Set<number>();
    for (const w of walks) {
      if (w.petId !== pet.petId) continue;
      const millis = ms(w.startedAt);
      if (millis < start) continue;
      days.add(Math.floor(millis / 86_400_000));
    }
    return days.size;
  }, [walks, pet.petId]);

  const reminderStat = nextR ? dayDiffFromNow(nextR.triggerAt) : null;

  return (
    <View style={styles.wrap}>
      {/* 2×2 stat grid */}
      <View style={styles.grid}>
        <PetStatTile
          Icon={Bell}
          label={tPP("stat.nextReminder")}
          value={reminderStat ? reminderStat.value : "—"}
          unit={reminderStat ? reminderStat.unit : undefined}
          sub={nextR ? nextR.title : tPP("stat.noReminder")}
          tone="brand"
          subTone={nextR ? "brand" : "muted"}
        />
        <PetStatTile
          Icon={Cookie}
          label={tPP("stat.monthSpend")}
          value={groupThousands(monthSpend)}
          unit="NT$"
          sub={tPP("stat.subThisMonth")}
          tone="cookie"
          subTone="muted"
        />
        <PetStatTile
          Icon={Scale}
          label={tPP("stat.weight")}
          value={pet.weightKg != null ? `${pet.weightKg}` : "—"}
          unit={pet.weightKg != null ? tPP("kgUnit") : undefined}
          sub={pet.weightKg != null ? tPP("stat.subRecent") : tPP("stat.noWeight")}
          tone="leaf"
          subTone={pet.weightKg != null ? "leaf" : "muted"}
        />
        <PetStatTile
          Icon={PawPrint}
          label={tPP("stat.walkDays")}
          value={`${walkDays}`}
          unit="天 · 本月"
          sub={tPP("stat.subKeepGoing")}
          tone="brand"
          subTone="muted"
        />
      </View>

      {/* Upcoming reminder (read-only — actions are no-ops, same as web) */}
      <Text style={styles.sectionTitle}>{tPP("overview.upcoming")}</Text>
      {nextR ? (
        <PetReminderCard
          reminder={nextR}
          petName={pet.name}
          onComplete={() => {}}
          onDelete={() => {}}
        />
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{tPP("overview.noReminder")}</Text>
        </View>
      )}

      {/* Recent expense */}
      <Text style={[styles.sectionTitle, styles.sectionGap]}>
        {tPP("overview.recentExpense")}
      </Text>
      {recentE ? (
        <PetExpenseCard expense={recentE} />
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{tPP("overview.noExpense")}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    flexGrow: 1,
    flexBasis: "47%",
    minHeight: 116,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: 14,
    gap: 8,
    ...shadows.card,
  },
  tileHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  tileIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.ink3,
    letterSpacing: 0.3,
  },
  tileValueRow: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  tileValue: { fontSize: 26, fontWeight: "800", letterSpacing: -0.7, color: colors.ink },
  tileUnit: { fontSize: 12, fontWeight: "600", color: colors.ink2 },
  tileSub: { fontSize: 12, fontWeight: "500", marginTop: -2 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.ink,
    paddingHorizontal: spacing.xs,
  },
  sectionGap: { marginTop: spacing.sm },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.lg,
    paddingVertical: 20,
    alignItems: "center",
    ...shadows.card,
  },
  emptyText: { fontSize: 14, color: colors.ink3, textAlign: "center" },
});
