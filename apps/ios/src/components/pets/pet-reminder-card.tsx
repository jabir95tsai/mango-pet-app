/**
 * Reminder card — 1:1 with apps/web/src/components/pets/pet-reminder-card.tsx.
 * 42px keyword-tinted icon square (rounded-14) + title (· petName) + a
 * repeat/due chip cluster (🔁 每月 · ⏰ 大約 N 小時內) + a check / optional
 * edit / trash action cluster on the right. Used in BOTH the 概覽「即將到期」
 * row and the 提醒 tab list, exactly as web reuses this one card.
 *
 * Icon tint is keyword-derived (mirrors web toneForTitle): 疫苗 → 💉 leaf,
 * 驅蟲/心絲蟲 → 🩺 brand, 美容/洗澡 → ✂️ peach, else 🔔 brand. RN has no
 * date-fns, so the due string reproduces date-fns zh-TW's
 * formatDistanceToNow(addSuffix) shape: 「內」for future, 「前」for past.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Bell,
  Check,
  Clock,
  Pencil,
  Repeat,
  Scissors,
  Stethoscope,
  Syringe,
  Trash2,
  type LucideIcon,
} from "lucide-react-native";
import type { Reminder } from "@mango/shared-types";

import { scoped } from "@/lib/i18n";
import { colors, radius, shadows, spacing } from "@/theme/theme";

const tRem = scoped("Reminder");
const tC = scoped("Common");

type Tone = { bg: string; fg: string; Icon: LucideIcon };

// 1:1 with web pet-reminder-card toneForTitle: Syringe/Stethoscope/Scissors/Bell.
function toneForTitle(title: string): Tone {
  const t = title.toLowerCase();
  if (/疫苗|vaccine/.test(t)) return { bg: colors.leafTint, fg: colors.leaf, Icon: Syringe };
  if (/驅蟲|心絲蟲|deworm|heartworm/.test(t))
    return { bg: colors.brandTint, fg: colors.brandDeep, Icon: Stethoscope };
  if (/洗澡|美容|bath|groom/.test(t))
    return { bg: colors.peachTint, fg: colors.cookie, Icon: Scissors };
  return { bg: colors.brandTint, fg: colors.brandDeep, Icon: Bell };
}

/** date-fns zh-TW formatDistanceToNow(addSuffix) lookalike: future → 「內」,
 *  past → 「前」, with 「大約」on the hour/month/year buckets. */
function relativeDue(ts: { toMillis?: () => number } | undefined): {
  text: string;
  overdue: boolean;
} {
  const delta = (ts?.toMillis?.() ?? 0) - Date.now();
  const overdue = delta < 0;
  const abs = Math.abs(delta);
  const suffix = overdue ? "前" : "內";
  let core: string;
  if (abs < 60 * 60_000) {
    core = `${Math.max(1, Math.round(abs / 60_000))} 分鐘`;
  } else if (abs < 24 * 3_600_000) {
    core = `大約 ${Math.max(1, Math.round(abs / 3_600_000))} 小時`;
  } else if (abs < 30 * 86_400_000) {
    core = `${Math.max(1, Math.round(abs / 86_400_000))} 天`;
  } else if (abs < 365 * 86_400_000) {
    core = `大約 ${Math.max(1, Math.round(abs / (30 * 86_400_000)))} 個月`;
  } else {
    core = `大約 ${Math.max(1, Math.round(abs / (365 * 86_400_000)))} 年`;
  }
  return { text: core + suffix, overdue };
}

export function PetReminderCard({
  reminder,
  petName,
  onComplete,
  onEdit,
  onDelete,
}: {
  reminder: Reminder;
  petName?: string;
  onComplete: () => void;
  onEdit?: () => void;
  onDelete: () => void;
}) {
  const tone = toneForTitle(reminder.title);
  const due = relativeDue(reminder.triggerAt);

  return (
    <View style={styles.card}>
      <View style={[styles.icon, { backgroundColor: tone.bg }]}>
        <tone.Icon size={18} color={tone.fg} strokeWidth={1.8} />
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {reminder.title}
          </Text>
          {petName ? <Text style={styles.petName}>· {petName}</Text> : null}
        </View>
        <View style={styles.chipRow}>
          {reminder.repeat !== "none" ? (
            <View style={styles.repeatChip}>
              <Repeat size={11} color={colors.ink2} strokeWidth={2} />
              <Text style={styles.repeatText}>{tRem(`repeat.${reminder.repeat}`)}</Text>
            </View>
          ) : null}
          <View style={styles.dueRow}>
            <Clock size={12} color={due.overdue ? "#dc2626" : colors.ink2} strokeWidth={2} />
            <Text style={[styles.due, due.overdue && styles.dueOverdue]}>{due.text}</Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onComplete}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={tRem("markDone")}
          style={({ pressed }) => [styles.checkBtn, pressed && styles.pressed]}
        >
          <Check size={18} color={colors.ink3} strokeWidth={2.6} />
        </Pressable>
        {onEdit ? (
          <Pressable
            onPress={onEdit}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={tC("edit")}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <Pencil size={16} color={colors.ink2} strokeWidth={2} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={onDelete}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={tC("delete")}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <Trash2 size={16} color={colors.ink2} strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 14,
    paddingVertical: 14,
    ...shadows.card,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontSize: 18 },
  body: { flex: 1, gap: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { flexShrink: 1, fontSize: 14.5, fontWeight: "700", letterSpacing: -0.1, color: colors.ink },
  petName: { fontSize: 11, color: colors.ink3 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  repeatChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.bgAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  repeatText: { fontSize: 11, fontWeight: "600", color: colors.ink2 },
  dueRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  due: { fontSize: 11.5, fontWeight: "600", color: colors.ink2 },
  dueOverdue: { color: "#dc2626" },
  actions: { flexDirection: "row", alignItems: "center", gap: 4 },
  checkBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: { fontSize: 17, fontWeight: "800", color: colors.ink3 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnText: { fontSize: 15 },
  pressed: { opacity: 0.6 },
});
