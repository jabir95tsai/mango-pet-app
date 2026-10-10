/**
 * "Move personal data into the family?" — 1:1 with web
 * apps/web/src/components/family/import-wizard-dialog.tsx, shown after a
 * successful create / join. Counts this user's personal-mode pets / walks /
 * reminders / expenses (same caps as web), one checkbox row per type
 * (32pt brand-tint icon tile + label + tabular count; 0 = disabled at 50%),
 * Skip (ghost) / "Move in (n)" via the importPersonalToFamily callable.
 * When nothing personal exists it completes immediately without rendering.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Bell, Check, Footprints, PawPrint, Wallet, type LucideIcon } from "lucide-react-native";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useAuth } from "@/state/auth-context";
import {
  importPersonalToFamily,
  type ImportPersonalCounts,
  type ImportPersonalType,
} from "@/lib/families-write";
import { listPetsForScope, listWalksForScope } from "@/lib/walk-data";
import { listExpensesForScope, listRemindersForScope } from "@/lib/pets-data";
import { t } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

const ZERO: ImportPersonalCounts = { pets: 0, walks: 0, reminders: 0, expenses: 0 };
const TYPES: { key: ImportPersonalType; Icon: LucideIcon }[] = [
  { key: "pets", Icon: PawPrint },
  { key: "walks", Icon: Footprints },
  { key: "reminders", Icon: Bell },
  { key: "expenses", Icon: Wallet },
];

export function ImportWizardSheet({
  familyId,
  onClose,
}: {
  familyId: string;
  /** Skip, done, or nothing to import — the caller refreshes its state. */
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<ImportPersonalCounts>(ZERO);
  const [selected, setSelected] = useState<Record<ImportPersonalType, boolean>>({
    pets: true,
    walks: true,
    reminders: true,
    expenses: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    void Promise.allSettled([
      listPetsForScope(null, user.uid),
      listWalksForScope(null, user.uid, 500),
      listRemindersForScope(null, user.uid),
      listExpensesForScope(null, user.uid, 500),
    ]).then(([pets, walks, reminders, expenses]) => {
      if (cancelled) return;
      const len = (r: PromiseSettledResult<unknown[]>) => (r.status === "fulfilled" ? r.value.length : 0);
      const c: ImportPersonalCounts = {
        pets: len(pets),
        walks: len(walks),
        reminders: len(reminders),
        expenses: len(expenses),
      };
      setCounts(c);
      setLoading(false);
      if (c.pets + c.walks + c.reminders + c.expenses === 0) onCloseRef.current();
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const selectedTypes = useMemo(
    () => TYPES.map((x) => x.key).filter((k) => selected[k] && counts[k] > 0),
    [selected, counts],
  );
  const selectedTotal = selectedTypes.reduce((sum, k) => sum + counts[k], 0);
  const hasAnything = counts.pets + counts.walks + counts.reminders + counts.expenses > 0;

  async function handleImport() {
    if (busy || selectedTotal === 0) return;
    setBusy(true);
    setError(null);
    try {
      await importPersonalToFamily(familyId, selectedTypes);
      onClose();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t("Family.actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (!loading && !hasAnything) return null;

  return (
    <Dialog
      visible
      onClose={onClose}
      title={t("ImportWizard.title")}
      dismissible={!busy}
      footer={
        <View style={styles.actions}>
          <Button label={t("ImportWizard.skip")} variant="ghost" onPress={onClose} disabled={busy} />
          <Button
            label={
              busy
                ? t("ImportWizard.importing")
                : selectedTotal > 0
                  ? t("ImportWizard.importN", { n: selectedTotal })
                  : t("ImportWizard.importEmpty")
            }
            onPress={() => void handleImport()}
            disabled={busy || loading || selectedTotal === 0}
          />
        </View>
      }
    >
      <Text style={styles.body}>{t("ImportWizard.subtitle")}</Text>
      {loading ? (
        <Text style={styles.muted}>{t("ImportWizard.loading")}</Text>
      ) : (
        <View style={styles.list}>
          {TYPES.map(({ key, Icon }) => {
            const count = counts[key];
            const disabled = count === 0;
            const checked = selected[key] && !disabled;
            return (
              <Pressable
                key={key}
                accessibilityRole="checkbox"
                accessibilityState={{ checked, disabled }}
                disabled={disabled || busy}
                onPress={() => setSelected((s) => ({ ...s, [key]: !s[key] }))}
                style={({ pressed }) => [
                  styles.row,
                  disabled && styles.rowDisabled,
                  pressed && styles.rowPressed,
                ]}
              >
                <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                  {checked ? <Check size={12} color="#ffffff" strokeWidth={3} /> : null}
                </View>
                <View style={styles.tile}>
                  <Icon size={16} color={colors.brandDeep} strokeWidth={2} />
                </View>
                <Text style={styles.label}>{t(`ImportWizard.${key}`)}</Text>
                <Text style={styles.count}>{count}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 14, lineHeight: 20, color: colors.ink2 },
  muted: { fontSize: 14, color: colors.ink3 },
  list: { gap: spacing.sm },
  // web: flex items-center gap-3 rounded-lg border px-3 py-2.5
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 44,
  },
  rowDisabled: { opacity: 0.5 },
  rowPressed: { backgroundColor: colors.bgAlt },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.ink3,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.brandDeep, borderColor: colors.brandDeep },
  tile: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { flex: 1, fontSize: 14, fontWeight: "500", color: colors.ink },
  count: { fontSize: 14, color: colors.ink3, fontVariant: ["tabular-nums"] },
  error: { fontSize: 14, color: colors.danger },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.md },
});
