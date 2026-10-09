/**
 * Guest upgrade — 1:1 with apps/web/src/components/auth/guest-upgrade.tsx
 * (provider + bind dialog + GuestLockedNotice) and guest-upgrade-nudge.tsx
 * (GuestUpgradeNudge). Spec docs/features/guest-login.md §C/§E/§5.
 *
 *  - GuestUpgradeProvider: one app-wide "bind your account" dialog, mounted in
 *    app/_layout.tsx inside AuthProvider. Any CTA calls useGuestUpgrade()
 *    .openUpgrade() so the feed gate, settings card, nudge banner, … all share
 *    the same link / conflict handling.
 *  - On `linked` (same uid, data kept) the dialog just closes: the auth
 *    listener (onUserChanged) sees isAnonymous flip, re-runs the profile
 *    bootstrap (de-flags the guest) and the root navigator brings the user
 *    back to the screen they were on — the native equivalent of web's reload.
 *  - On `switched` (the Google/Apple account already existed; no merge) the
 *    dialog shows the conflict notice until acknowledged.
 *  - A cancelled Google / Apple sheet is silent (SETTINGS-19).
 *
 * Google + Apple only (no Facebook), like web.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Lock, ShieldCheck, Sparkles, X } from "lucide-react-native";

import { Button, Dialog } from "@/components/ui";
import {
  isAppleSignInAvailable,
  upgradeGuestWithApple,
  upgradeGuestWithGoogle,
  type GuestUpgradeResult,
} from "@/lib/auth";
import { t, useLocale } from "@/lib/i18n";
import { listPetsForScope } from "@/lib/walk-data";
import { useAuth } from "@/state/auth-context";
import { colors, radius, spacing } from "@/theme/theme";

import { upgradeErrorMessage } from "./auth-errors";
import { withAlpha } from "./color";
import { AppleIcon } from "./provider-icons";

// ────────────────────────────────────────────────────────────────────
// Context
// ────────────────────────────────────────────────────────────────────

export type GuestUpgradeContextValue = {
  /** Open the "bind your account" dialog from anywhere (no-op for non-guests). */
  openUpgrade: () => void;
};

const GuestUpgradeContext = createContext<GuestUpgradeContextValue>({
  openUpgrade: () => {},
});

export function useGuestUpgrade(): GuestUpgradeContextValue {
  return useContext(GuestUpgradeContext);
}

export function GuestUpgradeProvider({ children }: { children: ReactNode }) {
  const { isGuest } = useAuth();
  const isGuestRef = useRef(isGuest);
  isGuestRef.current = isGuest;
  const [open, setOpen] = useState(false);

  const openUpgrade = useCallback(() => {
    // Linking only makes sense for an anonymous session; a stale CTA rendered
    // during the post-upgrade remount must not reopen the dialog.
    if (isGuestRef.current) setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ openUpgrade }), [openUpgrade]);

  return (
    <GuestUpgradeContext.Provider value={value}>
      {children}
      <UpgradeAccountDialog open={open} onClose={close} />
    </GuestUpgradeContext.Provider>
  );
}

// ────────────────────────────────────────────────────────────────────
// Bind dialog
// ────────────────────────────────────────────────────────────────────

type UpgradeProvider = "google" | "apple";

function UpgradeAccountDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useLocale();
  const [pending, setPending] = useState<UpgradeProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The chosen account already existed → we switched into it (no merge).
  const [switched, setSwitched] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Fresh state every time the dialog opens (web resets on close; resetting
  // on open avoids the content swapping while the sheet slides out).
  useEffect(() => {
    if (!open) return;
    setError(null);
    setSwitched(false);
    let alive = true;
    isAppleSignInAvailable()
      .then((ok) => {
        if (alive) setAppleAvailable(ok);
      })
      .catch(() => {
        if (alive) setAppleAvailable(false);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  async function handleUpgrade(kind: UpgradeProvider) {
    if (pending) return;
    setPending(kind);
    setError(null);
    try {
      const result: GuestUpgradeResult =
        kind === "google" ? await upgradeGuestWithGoogle() : await upgradeGuestWithApple();
      if (!mountedRef.current) return;
      setPending(null);
      if (result.status === "switched") {
        setSwitched(true);
      } else {
        onClose();
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setPending(null);
      setError(upgradeErrorMessage(err));
    }
  }

  return (
    <Dialog
      visible={open}
      onClose={onClose}
      title={t("Guest.upgrade.title")}
      dismissible={pending === null}
      contentStyle={styles.dialogBody}
    >
      {switched ? (
        <>
          <Text style={styles.conflictBody}>{t("Guest.upgrade.conflictBody")}</Text>
          <Button
            label={t("Guest.upgrade.conflictAck")}
            onPress={onClose}
            fullWidth
            labelStyle={styles.semibold}
          />
        </>
      ) : (
        <>
          <View style={styles.introRow}>
            <View style={styles.introTile}>
              <ShieldCheck size={20} color={colors.brandDeep} strokeWidth={2} />
            </View>
            <Text style={styles.introBody}>{t("Guest.upgrade.body")}</Text>
          </View>

          <View style={styles.providers}>
            <ProviderButton
              kind="google"
              label={t("Guest.upgrade.withGoogle")}
              pending={pending === "google"}
              disabled={pending !== null}
              onPress={() => handleUpgrade("google")}
            />
            {appleAvailable ? (
              <ProviderButton
                kind="apple"
                label={t("Guest.upgrade.withApple")}
                pending={pending === "apple"}
                disabled={pending !== null}
                onPress={() => handleUpgrade("apple")}
              />
            ) : null}
          </View>

          {error ? (
            <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
        </>
      )}
    </Dialog>
  );
}

/** web: `flex h-12 items-center justify-center gap-3 rounded-lg font-medium`
 *  Google = white + zinc border, Apple = black. The Apple mark is added on
 *  iOS so the custom button follows Apple's Sign in with Apple HIG. */
function ProviderButton({
  kind,
  label,
  pending,
  disabled,
  onPress,
}: {
  kind: UpgradeProvider;
  label: string;
  pending: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const isApple = kind === "apple";
  const fg = isApple ? APPLE_FG : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: pending }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.provider,
        isApple ? styles.providerApple : styles.providerGoogle,
        pressed && !disabled && (isApple ? styles.providerApplePressed : styles.providerGooglePressed),
        disabled && styles.providerDisabled,
      ]}
    >
      {pending ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {isApple ? <AppleIcon size={18} color={fg} /> : null}
          <Text style={[styles.providerLabel, { color: fg }]} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

// ────────────────────────────────────────────────────────────────────
// GuestLockedNotice — inline "this needs a real account" + upgrade CTA.
// ────────────────────────────────────────────────────────────────────

/** Picks the explanatory line `Guest.locked.<feature>` (both catalogs). */
export type GuestLockedFeature = "post" | "reactions" | "friends" | "family";

export function GuestLockedNotice({
  feature,
  style,
}: {
  feature: GuestLockedFeature;
  style?: StyleProp<ViewStyle>;
}) {
  useLocale();
  const { openUpgrade } = useGuestUpgrade();
  return (
    <View style={[styles.locked, style]}>
      <View style={styles.lockedRow}>
        <View style={styles.lockedIcon}>
          <Lock size={16} color={colors.brandDeep} strokeWidth={2} />
        </View>
        <Text style={styles.lockedText}>{t(`Guest.locked.${feature}`)}</Text>
      </View>
      <Button
        size="sm"
        label={t("Guest.upgradeCta")}
        onPress={openUpgrade}
        labelStyle={styles.semibold}
      />
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────
// GuestUpgradeNudge — one-time dismissible banner for guests with ≥1 pet.
// ────────────────────────────────────────────────────────────────────

/** AsyncStorage flag set once the nudge was dismissed (web localStorage key). */
export const GUEST_NUDGE_DISMISS_KEY = "mango.guestNudgeDismissed";

/**
 * Web mounts this at the top of every /app page (app/layout.tsx). iOS has no
 * shared content wrapper, so render it at the top of a tab's scroll content
 * (walks / home). Must be rendered below the root navigator (uses
 * useFocusEffect): it re-checks on every focus, so the banner appears as soon
 * as the guest's first pet exists. Dismissal persists per device, like web.
 */
export function GuestUpgradeNudge({ style }: { style?: StyleProp<ViewStyle> }) {
  useLocale();
  const { user, isGuest } = useAuth();
  const { openUpgrade } = useGuestUpgrade();
  const [show, setShow] = useState(false);
  const uid = user?.uid ?? null;
  const showRef = useRef(show);
  showRef.current = show;

  useEffect(() => {
    if (!isGuest || !uid) setShow(false);
  }, [isGuest, uid]);

  useFocusEffect(
    useCallback(() => {
      if (!isGuest || !uid || showRef.current) return undefined;
      let cancelled = false;
      (async () => {
        try {
          if (await AsyncStorage.getItem(GUEST_NUDGE_DISMISS_KEY)) return;
        } catch {
          // Unreadable storage → treat as not dismissed.
        }
        try {
          const pets = await listPetsForScope(null, uid);
          if (!cancelled && pets.length > 0) setShow(true);
        } catch {
          // Non-critical surface — stay hidden on read failure.
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [isGuest, uid]),
  );

  const dismiss = useCallback(() => {
    setShow(false);
    AsyncStorage.setItem(GUEST_NUDGE_DISMISS_KEY, "1").catch(() => {});
  }, []);

  if (!show || !isGuest) return null;

  return (
    <View style={[styles.nudge, style]}>
      <View style={styles.nudgeTile}>
        <Sparkles size={20} color={WHITE} strokeWidth={2} />
      </View>
      <View style={styles.nudgeText}>
        <Text style={styles.nudgeTitle}>{t("Guest.nudge.title")}</Text>
        <Text style={styles.nudgeBody}>{t("Guest.nudge.body")}</Text>
        <View style={styles.nudgeActions}>
          <Button
            size="sm"
            label={t("Guest.nudge.cta")}
            onPress={openUpgrade}
            labelStyle={styles.semibold}
          />
          <Button
            size="sm"
            variant="ghost"
            label={t("Guest.nudge.dismiss")}
            onPress={dismiss}
            labelStyle={styles.semibold}
          />
        </View>
      </View>
      <Pressable
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel={t("Guest.nudge.dismiss")}
        hitSlop={10}
        style={({ pressed }) => [styles.nudgeClose, pressed && styles.nudgeClosePressed]}
      >
        <X size={16} color={colors.ink2} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

// web text-white / bg-black
const WHITE = "#ffffff";
const APPLE_BG = "#000000";
const APPLE_FG = WHITE;

const styles = StyleSheet.create({
  semibold: { fontWeight: "600" },
  // web: flex flex-col gap-4
  dialogBody: { gap: spacing.lg },
  // web: text-sm text-zinc-700
  conflictBody: { fontSize: 14, lineHeight: 20, color: colors.ink },
  // web: flex items-start gap-3
  introRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  // web: grid size-10 rounded-xl bg-mango-brand-tint text-mango-brand-deep
  introTile: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  // web: text-sm text-zinc-600
  introBody: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.ink2 },
  // web: flex flex-col gap-2
  providers: { gap: spacing.sm },
  provider: {
    height: 48,
    borderRadius: radius.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  providerGoogle: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  providerGooglePressed: { backgroundColor: colors.cardSoft },
  providerApple: { backgroundColor: APPLE_BG },
  providerApplePressed: { opacity: 0.85 },
  providerDisabled: { opacity: 0.6 },
  providerLabel: { fontSize: 16, fontWeight: "500" },
  // web: text-center text-sm text-red-600
  error: { fontSize: 14, lineHeight: 20, color: colors.danger, textAlign: "center" },

  // GuestLockedNotice — web: flex flex-col items-start gap-3 rounded-lg
  // border border-amber-200/70 bg-amber-50 p-4 text-sm text-amber-900
  // (mango-ized per docs/design-system.md §1).
  locked: {
    alignItems: "flex-start",
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.brandTint,
    backgroundColor: colors.cardSoft,
    padding: spacing.lg,
  },
  lockedRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  lockedIcon: { marginTop: 2 },
  lockedText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.ink },

  // GuestUpgradeNudge — web: mb-4 flex items-start gap-3 rounded-lg border
  // border-mango-brand/40 bg-mango-brand-tint/60 p-4
  nudge: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: withAlpha(colors.brand, 0.4),
    backgroundColor: withAlpha(colors.brandTint, 0.6),
    padding: spacing.lg,
  },
  // web: grid size-9 rounded-lg bg-mango-brand text-white
  nudgeTile: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  nudgeText: { flex: 1, minWidth: 0 },
  // web: text-sm font-semibold text-mango-ink
  nudgeTitle: { fontSize: 14, lineHeight: 20, fontWeight: "600", color: colors.ink },
  // web: mt-0.5 text-sm text-mango-ink-2
  nudgeBody: { marginTop: 2, fontSize: 14, lineHeight: 20, color: colors.ink2 },
  // web: mt-3 flex flex-wrap gap-2
  nudgeActions: { marginTop: spacing.md, flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  // web: shrink-0 rounded-lg p-1 (X size-4); hitSlop lifts it to 44pt.
  nudgeClose: { padding: spacing.xs, borderRadius: radius.sm },
  nudgeClosePressed: { backgroundColor: colors.bgAlt },
});
