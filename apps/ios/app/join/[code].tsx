/**
 * Family join deep-link — 1:1 with web apps/web/src/app/join/[code]/page.tsx
 * (SHELL-7). Validates the 6-digit code, calls joinFamilyByCode, then bounces
 * home ("/(tabs)", web "/app"). Reachable via mangopet://join/123456 and the
 * https invite URL.
 *
 * Signed-out visitors are sent to sign-in by the root navigator, which keeps
 * the code and brings them back here afterwards (SHELL-6) — so nothing runs
 * here without a user. Guests can't join a family (the callable rejects
 * anonymous auth), so they get the GuestLockedNotice instead; after binding an
 * account the root navigator resumes this screen and the join runs.
 */
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AlertTriangle, Check, Users } from "lucide-react-native";

import { Button } from "@/components/ui";
import { GuestLockedNotice } from "@/components/auth/guest-upgrade";
import { useAuth } from "@/state/auth-context";
import { useFamily } from "@/state/family-context";
import { joinFamilyByCode } from "@/lib/families-write";
import { normalizeJoinCode } from "@/lib/onboarding";
import { t, useLocale } from "@/lib/i18n";
import { colors, radius, spacing, CONTENT_MAX_WIDTH } from "@/theme/theme";

type Status =
  | { kind: "joining" }
  | { kind: "joined" }
  | { kind: "alreadyMember" }
  | { kind: "invalidCode"; raw: string }
  | { kind: "error" }
  | { kind: "guest" };

// web max-w-md
const COLUMN_MAX_WIDTH = Math.min(448, CONTENT_MAX_WIDTH);
const HOME = "/(tabs)";

/** Callable error code without the optional "functions/" prefix. */
function callableCode(err: unknown): string {
  const code = (err as { code?: unknown } | null | undefined)?.code;
  return typeof code === "string" ? code.replace(/^functions\//, "") : "";
}

export default function JoinScreen() {
  useLocale();
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string }>();
  const raw = normalizeJoinCode(params.code) ?? "";
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const isGuest = !!user?.isAnonymous;
  const { refresh } = useFamily();
  const [status, setStatus] = useState<Status>({ kind: "joining" });

  // Run the join once per (account, code) — not again when refresh/router
  // identities change (that would re-call the callable and flip the result
  // to "already a member").
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (!uid) return; // root navigator → sign-in (code kept for later)
    if (isGuest) {
      setStatus({ kind: "guest" });
      return;
    }
    // Same code-shape check as web / JoinFamilyDialog — skip a guaranteed 400.
    if (!/^\d{6}$/.test(raw)) {
      setStatus({ kind: "invalidCode", raw });
      return;
    }
    setStatus({ kind: "joining" });
    let alive = true;
    let bounce: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      try {
        const res = await joinFamilyByCode(raw);
        if (!alive) return;
        if (res.alreadyMember) {
          setStatus({ kind: "alreadyMember" });
          return;
        }
        await refreshRef.current();
        if (!alive) return;
        setStatus({ kind: "joined" });
        // Auto-bounce home after a beat so the success copy registers (web).
        bounce = setTimeout(() => {
          if (alive) routerRef.current.replace(HOME);
        }, 1200);
      } catch (err) {
        if (!alive) return;
        const code = callableCode(err);
        // not-found = no family owns this code (server: 邀請碼無效或已過期).
        if (code === "not-found" || code === "invalid-argument") {
          setStatus({ kind: "invalidCode", raw });
        } else {
          setStatus({ kind: "error" });
        }
      }
    })();
    return () => {
      alive = false;
      if (bounce) clearTimeout(bounce);
    };
  }, [uid, isGuest, raw]);

  const title =
    status.kind === "joining"
      ? t("JoinFamily.joining")
      : status.kind === "joined"
        ? t("JoinFamily.joinedTitle")
        : status.kind === "alreadyMember"
          ? t("JoinFamily.alreadyMemberTitle")
          : status.kind === "invalidCode"
            ? t("JoinFamily.invalidCodeTitle")
            : status.kind === "guest"
              ? t("Onboarding.joinTitle")
              : t("JoinFamily.errorTitle");

  const hint =
    status.kind === "joining"
      ? t("JoinFamily.joiningHint")
      : status.kind === "joined"
        ? t("JoinFamily.joinedHint")
        : status.kind === "alreadyMember"
          ? t("JoinFamily.alreadyMemberHint")
          : status.kind === "invalidCode"
            ? t("JoinFamily.invalidCodeHint", { code: status.raw })
            : status.kind === "error"
              ? t("Join.error")
              : null;

  const showGoToApp =
    status.kind === "alreadyMember" ||
    status.kind === "invalidCode" ||
    status.kind === "error" ||
    status.kind === "guest";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.column}>
        <View style={styles.tile}>
          {status.kind === "joining" ? (
            <ActivityIndicator color={colors.brandDeep} size="large" />
          ) : status.kind === "joined" ? (
            <Check size={32} color={colors.brandDeep} strokeWidth={2} />
          ) : status.kind === "alreadyMember" || status.kind === "guest" ? (
            <Users size={32} color={colors.brandDeep} strokeWidth={2} />
          ) : (
            <AlertTriangle size={32} color={colors.brandDeep} strokeWidth={2} />
          )}
        </View>

        <View style={styles.text} accessibilityLiveRegion="polite">
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>

        {status.kind === "guest" ? (
          <GuestLockedNotice feature="family" style={styles.locked} />
        ) : null}

        {showGoToApp ? (
          <Button label={t("JoinFamily.goToApp")} onPress={() => router.replace(HOME)} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  // web: mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center
  //      gap-6 px-6 py-10 text-center
  column: {
    flex: 1,
    width: "100%",
    maxWidth: COLUMN_MAX_WIDTH,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: 40,
  },
  // web: grid size-16 place-items-center rounded-2xl bg-amber-100 text-amber-700
  tile: {
    width: 64,
    height: 64,
    borderRadius: radius.xl2,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  // web: flex flex-col gap-2
  text: { alignItems: "center", gap: spacing.sm },
  // web: text-2xl font-bold
  title: { fontSize: 24, lineHeight: 32, fontWeight: "700", color: colors.ink, textAlign: "center" },
  // web: text-sm text-zinc-500
  hint: { fontSize: 14, lineHeight: 20, color: colors.ink2, textAlign: "center" },
  locked: { alignSelf: "stretch" },
});
