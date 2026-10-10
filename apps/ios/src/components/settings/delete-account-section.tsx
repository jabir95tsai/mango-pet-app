/**
 * Delete account — the danger-zone button + confirm dialog, 1:1 with web
 * apps/web/src/components/settings/delete-account-dialog.tsx:
 *
 *   red warning box (AlertTriangle + warning + cannotUndo) → impact preview
 *   (loading / previewFailed — the delete stays possible / ImpactSummary with
 *   only non-zero lines, cascade chip, nothing-to-delete) → typed display-name
 *   confirm (hint only while typed and not matching) → error box →
 *   Cancel (ghost) / red confirm (Trash2 + confirmButton, "deleting" while busy).
 *
 * Built on the shared Dialog, so the input and actions stay above the
 * keyboard. On success signs out (root navigator routes to sign-in).
 */
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AlertTriangle, Trash2 } from "lucide-react-native";
import type { DeleteAccountImpact } from "@mango/shared-types";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Input";
import { withAlpha } from "@/components/auth/color";
import { useAuth } from "@/state/auth-context";
import { deleteUserAccount, previewDeleteAccountImpact } from "@/lib/account";
import { signOut } from "@/lib/auth";
import { getUserPrefs } from "@/lib/user-prefs";
import { t } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

const RED_50 = "#fef2f2";
const RED_700 = "#b91c1c";
const RED_900 = "#7f1d1d";

function ImpactSummary({ impact }: { impact: DeleteAccountImpact }) {
  const personal = impact.personalPets;
  const family = impact.familyPets;
  const myActivity = impact.familyWalks + impact.familyReminders + impact.familyExpenses;
  const social = impact.posts;
  if (personal + family + myActivity + social === 0) {
    return <Text style={styles.muted12}>{t("DeleteAccount.nothingToDelete")}</Text>;
  }
  const line = (section: string, body: string) => (
    <Text style={styles.impactLine}>
      <Text style={styles.impactSection}>{`${section}：`}</Text>
      {body}
    </Text>
  );
  return (
    <View style={styles.impact}>
      <Text style={styles.impactHeader}>{t("DeleteAccount.impactHeader")}</Text>
      {personal > 0
        ? line(
            t("DeleteAccount.personalDataSection"),
            t("DeleteAccount.personalDataCount", { n: personal }),
          )
        : null}
      {family > 0 ? (
        <>
          {line(
            t("DeleteAccount.familyDataSection"),
            t("DeleteAccount.familyDataCount", { n: family }),
          )}
          <Text style={styles.cascade}>{`⚠ ${t("DeleteAccount.cascadeWarning")}`}</Text>
        </>
      ) : null}
      {myActivity > 0
        ? line(
            t("DeleteAccount.myActivitySection"),
            t("DeleteAccount.myActivityCount", {
              walks: impact.familyWalks,
              reminders: impact.familyReminders,
              expenses: impact.familyExpenses,
            }),
          )
        : null}
      {social > 0
        ? line(t("DeleteAccount.socialDataSection"), t("DeleteAccount.socialDataCount", { n: social }))
        : null}
    </View>
  );
}

export function DeleteAccountSection() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState<DeleteAccountImpact | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState(false);
  const [expectedName, setExpectedName] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    let alive = true;
    setConfirmName("");
    setError(null);
    setImpact(null);
    setImpactError(false);
    setImpactLoading(true);
    previewDeleteAccountImpact()
      .then((v) => {
        if (alive) setImpact(v);
      })
      .catch(() => {
        if (alive) setImpactError(true);
      })
      .finally(() => {
        if (alive) setImpactLoading(false);
      });
    // Expected name: the Firestore profile displayName, else auth (web).
    getUserPrefs(user.uid)
      .then((p) => {
        if (alive) setExpectedName((p.displayName ?? user.displayName ?? "").trim());
      })
      .catch(() => {
        if (alive) setExpectedName((user.displayName ?? "").trim());
      });
    return () => {
      alive = false;
    };
  }, [open, user]);

  const matches = confirmName.trim().length > 0 && confirmName.trim() === expectedName;

  async function doDelete() {
    if (!matches || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteUserAccount(confirmName.trim());
      await signOut({ accountDeleted: true });
    } catch (e) {
      setDeleting(false);
      setError(e instanceof Error && e.message ? e.message : "Delete failed");
    }
  }

  return (
    <>
      <Button
        label={t("Settings.dangerZone.deleteAction")}
        variant="danger"
        icon={Trash2}
        onPress={() => setOpen(true)}
        style={styles.openBtn}
      />

      <Dialog
        visible={open}
        onClose={() => setOpen(false)}
        title={t("DeleteAccount.dialogTitle")}
        dismissible={!deleting}
        footer={
          <View style={styles.actions}>
            <Button
              label={t("DeleteAccount.cancelButton")}
              variant="ghost"
              onPress={() => setOpen(false)}
              disabled={deleting}
            />
            <Button
              label={deleting ? t("DeleteAccount.deleting") : t("DeleteAccount.confirmButton")}
              variant="danger"
              icon={deleting ? undefined : Trash2}
              onPress={doDelete}
              disabled={!matches || deleting}
            />
          </View>
        }
      >
        <View style={styles.warning}>
          <AlertTriangle size={20} color={RED_900} strokeWidth={2} style={styles.warningIcon} />
          <View style={styles.warningText}>
            <Text style={styles.warningTitle}>{t("DeleteAccount.warning")}</Text>
            <Text style={styles.warningBody}>{t("DeleteAccount.cannotUndo")}</Text>
          </View>
        </View>

        {impactLoading ? (
          <Text style={styles.muted14}>{t("DeleteAccount.previewLoading")}</Text>
        ) : impactError ? (
          <Text style={styles.muted12}>{t("DeleteAccount.previewFailed")}</Text>
        ) : impact ? (
          <ImpactSummary impact={impact} />
        ) : null}

        <Field
          label={t("DeleteAccount.confirmInputLabel", { name: expectedName || "—" })}
          hint={confirmName.length > 0 && !matches ? t("DeleteAccount.confirmInputHint") : undefined}
        >
          <Input
            value={confirmName}
            onChangeText={setConfirmName}
            placeholder={expectedName}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            editable={!deleting}
          />
        </Field>

        {error ? (
          <Text style={styles.errorBox} accessibilityRole="alert">
            {`${t("DeleteAccount.errorPrefix")}: ${error}`}
          </Text>
        ) : null}
      </Dialog>
    </>
  );
}

const styles = StyleSheet.create({
  openBtn: { alignSelf: "flex-start" },
  // web: flex gap-3 rounded-md border border-red-300/70 bg-red-50 p-3 text-red-900
  warning: {
    flexDirection: "row",
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(252,165,165,0.7)",
    backgroundColor: RED_50,
    padding: spacing.md,
  },
  warningIcon: { marginTop: 2 },
  warningText: { flex: 1, gap: 4 },
  warningTitle: { fontSize: 14, fontWeight: "600", color: RED_900 },
  warningBody: { fontSize: 12, lineHeight: 17, color: RED_900 },
  muted14: { fontSize: 14, color: colors.ink2 },
  muted12: { fontSize: 12, lineHeight: 17, color: colors.ink2 },
  impact: { gap: 6 },
  impactHeader: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.ink2,
  },
  impactLine: { fontSize: 14, lineHeight: 20, color: colors.ink },
  impactSection: { fontWeight: "500" },
  // web: rounded-sm bg-brand-tint/50 px-2 py-1.5 text-xs ink-2
  cascade: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.ink2,
    backgroundColor: withAlpha(colors.brandTint, 0.5),
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    overflow: "hidden",
  },
  // web: rounded-sm bg-red-50 px-2 py-1.5 text-xs text-red-700
  errorBox: {
    fontSize: 12,
    color: RED_700,
    backgroundColor: RED_50,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    overflow: "hidden",
  },
  // web: flex justify-end gap-3
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.md },
});
