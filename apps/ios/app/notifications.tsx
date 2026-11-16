/**
 * Notification center — pushed from the home bell. Spec:
 * docs/features/ios-notification-center.md Phase 2.
 *
 *  1. 待辦提醒: active-scope reminders due by end of today (incl. overdue),
 *     not done. Check = complete (useReminderActions keeps doneByUid); row tap
 *     → Pets「提醒」tab. Hidden when empty.
 *  2. 動態: users/{uid}/notifications, newest 50, realtime. Blocked actors are
 *     filtered again client-side (blocks made after the write).
 *
 * Focus writes notificationsLastSeenAt (clears the bell dot); rows newer than
 * the pre-focus value get a tinted background. Blur writes it again so
 * anything that arrived while open doesn't re-light the dot.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import type { AppNotification, Pet, Reminder } from "@mango/shared-types";

import { EmptyState, RouteHeader } from "@/components/ui";
import { UserAvatar } from "@/components/feed/user-avatar";
import { PetReminderCard } from "@/components/pets/pet-reminder-card";
import { useReminderActions } from "@/components/pets/use-reminder-actions";
import { useFamilyScope } from "@/lib/use-family-scope";
import { listRemindersForScope } from "@/lib/pets-data";
import { listPetsForScope } from "@/lib/walk-data";
import { getBlockedUids, getUserProfileLite, type UserProfileLite } from "@/lib/user-prefs";
import {
  getNotificationsLastSeenMs,
  markNotificationsSeen,
  subscribeNotifications,
} from "@/lib/notifications";
import { relativeTime } from "@/lib/format";
import { scoped, t } from "@/lib/i18n";
import { colors, radius, spacing, CONTENT_MAX_WIDTH } from "@/theme/theme";

const tN = scoped("Notifications");
const ACTIVITY_LIMIT = 50;

function endOfTodayMs(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** Due today or overdue, not done, soonest first (query already asc). */
export function dueReminders(all: Reminder[], endMs: number): Reminder[] {
  return all.filter((r) => !r.done && (r.triggerAt?.toMillis?.() ?? Infinity) <= endMs);
}

/** Drop blocked actors; a row with no visible actor left disappears. */
export function visibleActivity(rows: AppNotification[], blocked: string[]): AppNotification[] {
  if (blocked.length === 0) return rows;
  const out: AppNotification[] = [];
  for (const n of rows) {
    const actorUids = n.actorUids.filter((u) => !blocked.includes(u));
    if (actorUids.length === 0) continue;
    out.push({ ...n, actorUids, actorCount: n.actorCount - (n.actorUids.length - actorUids.length) });
  }
  return out;
}

function activityText(n: AppNotification, name: string): string {
  if (n.type === "comment") return tN("comment", { name, preview: n.commentPreview ?? "" });
  if (n.type === "friendRequest") return tN("friendRequest", { name });
  return n.actorCount > 1
    ? tN("reactionMany", { name, count: n.actorCount, others: n.actorCount - 1 })
    : tN("reaction", { name });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { uid, familyId, scopeReady, markDataChanged } = useFamilyScope();

  const [seenBefore, setSeenBefore] = useState<number | null>(null);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [activity, setActivity] = useState<AppNotification[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfileLite | null>>({});
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);

  const loadReminders = useCallback(async () => {
    if (!uid || !scopeReady) return;
    const [r, p] = await Promise.allSettled([
      listRemindersForScope(familyId, uid),
      listPetsForScope(familyId, uid),
    ]);
    if (r.status === "fulfilled") setReminders(dueReminders(r.value, endOfTodayMs()));
    if (p.status === "fulfilled") setPets(p.value);
  }, [uid, familyId, scopeReady]);

  const afterComplete = useCallback(() => {
    markDataChanged(); // Pets / Home refetch on next focus
    void loadReminders();
  }, [markDataChanged, loadReminders]);
  const { complete } = useReminderActions(uid ?? "", afterComplete);

  // Focus: remember old lastSeen (for highlighting) → mark seen; refresh
  // reminders + block list. Blur: mark seen again.
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      void (async () => {
        const prev = await getNotificationsLastSeenMs(uid).catch(() => 0);
        setSeenBefore((s) => s ?? prev);
        await markNotificationsSeen(uid).catch(() => {});
      })();
      getBlockedUids(uid).then(setBlocked, () => {});
      void loadReminders();
      return () => {
        markNotificationsSeen(uid).catch(() => {});
      };
    }, [uid, loadReminders]),
  );

  useEffect(() => {
    if (!uid) return;
    return subscribeNotifications(uid, ACTIVITY_LIMIT, setActivity);
  }, [uid]);

  const rows = useMemo(() => visibleActivity(activity, blocked), [activity, blocked]);

  // Resolve each lead actor's name/avatar once (cached across snapshots).
  useEffect(() => {
    const missing = [...new Set(rows.map((n) => n.actorUids[0]))].filter((u) => !(u in profiles));
    if (missing.length === 0) return;
    // null = profile doc gone (deleted account); a read error isn't cached.
    void Promise.all(missing.map((u) => getUserProfileLite(u).catch(() => undefined))).then((res) =>
      setProfiles((p) => ({
        ...p,
        ...Object.fromEntries(missing.flatMap((u, i) => (res[i] === undefined ? [] : [[u, res[i]]]))),
      })),
    );
  }, [rows, profiles]);
  // Lead actor deleted their account → hide the row (backlog: actor 刪帳號).
  const shown = rows.filter((n) => profiles[n.actorUids[0]] !== null);

  const petName = (id?: string) => pets.find((p) => p.petId === id)?.name;
  const openPetsReminders = () =>
    router.navigate({ pathname: "/(tabs)/pets", params: { tab: "reminders" } });
  const openActivity = (n: AppNotification) => {
    if (n.type === "friendRequest") router.push("/friends");
    else router.push({ pathname: "/feed", params: { postId: n.postId ?? "" } });
  };

  const empty = reminders.length === 0 && shown.length === 0;

  return (
    <SafeAreaView edges={["top"]} style={styles.flex}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <RouteHeader title={tN("title")} onBack={() => router.back()} />

        {empty ? <EmptyState icon={Bell} title={tN("empty")} /> : null}

        {reminders.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {tN("sections.reminders")}
            </Text>
            {reminders.map((r) => (
              <Pressable
                key={r.reminderId}
                onPress={openPetsReminders}
                accessibilityRole="button"
                accessibilityLabel={[r.title, petName(r.petId)].filter(Boolean).join("，")}
                accessibilityHint={tN("openReminders")}
                accessibilityActions={[{ name: "markDone", label: t("Reminder.markDone") }]}
                onAccessibilityAction={(e) => {
                  if (e.nativeEvent.actionName === "markDone") void complete(r);
                }}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <PetReminderCard
                  reminder={r}
                  petName={petName(r.petId)}
                  onComplete={() => void complete(r)}
                />
              </Pressable>
            ))}
          </View>
        ) : null}

        {shown.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {tN("sections.activity")}
            </Text>
            {shown.map((n) => {
              const actor = profiles[n.actorUids[0]];
              const name = actor?.displayName ?? "…";
              const text = activityText(n, name);
              const time = relativeTime(n.createdAt);
              const fresh = seenBefore !== null && (n.createdAt?.toMillis?.() ?? 0) > seenBefore;
              return (
                <Pressable
                  key={n.notificationId}
                  onPress={() => openActivity(n)}
                  accessibilityRole="button"
                  accessibilityLabel={`${text}，${time}`}
                  style={({ pressed }) => [styles.row, fresh && styles.rowFresh, pressed && styles.pressed]}
                >
                  <UserAvatar name={name} photoURL={actor?.photoURL} size={40} />
                  <View style={styles.rowBody}>
                    <Text style={styles.rowText} numberOfLines={3}>
                      {text}
                    </Text>
                    <Text style={styles.rowTime}>{time}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: 20,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
    gap: spacing.xl,
  },
  section: { gap: spacing.md },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: colors.ink },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 44,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
  },
  rowFresh: { backgroundColor: colors.cardSoft, borderColor: colors.brandTint },
  rowBody: { flex: 1, gap: 2 },
  rowText: { fontSize: 14, lineHeight: 20, color: colors.ink },
  rowTime: { fontSize: 12, color: colors.ink3 },
  pressed: { opacity: 0.7 },
});
