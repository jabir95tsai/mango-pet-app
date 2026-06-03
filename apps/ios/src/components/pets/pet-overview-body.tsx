/**
 * Overview tab body — 2×2 StatGrid (next reminder / month spend / weight /
 * walk days) + an "即將到期" upcoming-reminder card + a "最近開銷" recent-
 * expense card. Pure presentation over already-loaded arrays; all the month
 * math comes from @mango/shared-business (startOfMonth / dayDiffFromNow).
 * Mirrors web pet-overview-body.
 */
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { dayDiffFromNow, startOfMonth } from "@mango/shared-business";
import type { Expense, Pet, Reminder, Walk } from "@mango/shared-types";

import { CATEGORY_EMOJI } from "@/lib/expense-ui";
import { groupThousands, monthDay } from "@/lib/format";
import { scoped } from "@/lib/i18n";
import { colors, radius, shadows, spacing } from "@/theme/theme";

const tPP = scoped("PetsPage");
const tExp = scoped("Expense");
const tRem = scoped("Reminder");

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
  icon,
  label,
  value,
  unit,
  sub,
  tone,
  subTone = "muted",
}: {
  icon: string;
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
          <Text style={[styles.tileIconText, { color: ICON_FG[tone] }]}>{icon}</Text>
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
          icon="🔔"
          label={tPP("stat.nextReminder")}
          value={reminderStat ? reminderStat.value : "—"}
          unit={reminderStat ? reminderStat.unit : undefined}
          sub={nextR ? nextR.title : tPP("stat.noReminder")}
          tone="brand"
          subTone={nextR ? "brand" : "muted"}
        />
        <PetStatTile
          icon="🍪"
          label={tPP("stat.monthSpend")}
          value={`$${groupThousands(monthSpend)}`}
          sub={tPP("stat.subThisMonth")}
          tone="cookie"
          subTone="muted"
        />
        <PetStatTile
          icon="⚖️"
          label={tPP("stat.weight")}
          value={pet.weightKg != null ? `${pet.weightKg}` : "—"}
          unit={pet.weightKg != null ? tPP("kgUnit") : undefined}
          sub={pet.weightKg != null ? tPP("stat.subRecent") : tPP("stat.noWeight")}
          tone="leaf"
          subTone={pet.weightKg != null ? "leaf" : "muted"}
        />
        <PetStatTile
          icon="🐾"
          label={tPP("stat.walkDays")}
          value={`${walkDays}`}
          unit="天"
          sub={tPP("stat.subKeepGoing")}
          tone="brand"
          subTone="muted"
        />
      </View>

      {/* Upcoming reminder */}
      <Text style={styles.sectionTitle}>{tPP("overview.upcoming")}</Text>
      {nextR ? (
        <View style={styles.card}>
          <View style={[styles.cardIcon, { backgroundColor: colors.bellTint }]}>
            <Text style={styles.cardIconText}>🔔</Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {nextR.title}
            </Text>
            <View style={styles.cardSubRow}>
              {nextR.repeat !== "none" ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {tRem(`repeat.${nextR.repeat}`)}
                  </Text>
                </View>
              ) : null}
              {reminderStat ? (
                <Text style={styles.cardSub}>
                  {`${reminderStat.value} ${reminderStat.unit}`}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      ) : (
        <Text style={styles.empty}>{tPP("overview.noReminder")}</Text>
      )}

      {/* Recent expense */}
      <Text style={[styles.sectionTitle, styles.sectionGap]}>
        {tPP("overview.recentExpense")}
      </Text>
      {recentE ? (
        <View style={styles.card}>
          <View style={[styles.cardIcon, { backgroundColor: colors.cookieTint }]}>
            <Text style={styles.cardIconText}>
              {CATEGORY_EMOJI[recentE.category] ?? "🧾"}
            </Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {recentE.vendor ?? tExp(`categories.${recentE.category}`)}
            </Text>
            <Text style={styles.cardSub}>{monthDay(recentE.spentAt)}</Text>
          </View>
          <Text style={styles.amount}>{`$${groupThousands(recentE.amount)}`}</Text>
        </View>
      ) : (
        <Text style={styles.empty}>{tPP("overview.noExpense")}</Text>
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
  tileIconText: { fontSize: 15 },
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
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconText: { fontSize: 18 },
  cardBody: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  cardSubRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  cardSub: { fontSize: 12, color: colors.ink3 },
  badge: {
    backgroundColor: colors.brandTint,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: { fontSize: 11, fontWeight: "700", color: colors.brandDeep },
  amount: { fontSize: 16, fontWeight: "800", color: colors.ink },
  empty: {
    fontSize: 13,
    color: colors.ink3,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
});
