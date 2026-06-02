/**
 * Delete account (P5a) — danger zone button → dialog: impact preview +
 * typed-displayName confirm + callable. On success signs out (root navigator
 * routes to login). Mirrors web delete-account-dialog.tsx.
 */
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { DeleteAccountImpact } from "@mango/shared-types";

import { useAuth } from "@/state/auth-context";
import { deleteUserAccount, previewDeleteAccountImpact } from "@/lib/account";
import { signOut } from "@/lib/auth";
import { getUserPrefs } from "@/lib/user-prefs";
import { t } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

export function DeleteAccountSection() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState<DeleteAccountImpact | null>(null);
  const [expectedName, setExpectedName] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    setConfirmName("");
    setError(null);
    setImpact(null);
    previewDeleteAccountImpact().then(setImpact).catch(() => setImpact(null));
    // expected name: prefer the Firestore profile displayName, fall back to auth
    getUserPrefs(user.uid)
      .then((p) => setExpectedName((p.displayName ?? user.displayName ?? "").trim()))
      .catch(() => setExpectedName((user.displayName ?? "").trim()));
  }, [open, user]);

  const canDelete = confirmName.trim().length > 0 && confirmName.trim() === expectedName;

  async function doDelete() {
    if (!canDelete || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteUserAccount(confirmName.trim());
      await signOut();
      // root navigator redirects to sign-in once auth clears
    } catch (e) {
      setDeleting(false);
      setError(`${t("DeleteAccount.errorPrefix")}: ${e instanceof Error ? e.message : ""}`);
    }
  }

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={styles.dangerBtn}>
        <Text style={styles.dangerText}>{t("DeleteAccount.warning")}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => !deleting && setOpen(false)}>
          <Pressable style={styles.sheet}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.title}>{t("DeleteAccount.dialogTitle")}</Text>
              <Text style={styles.cannotUndo}>{t("DeleteAccount.cannotUndo")}</Text>

              <Text style={styles.impactHeader}>{t("DeleteAccount.impactHeader")}</Text>
              {impact === null ? (
                <Text style={styles.previewLoading}>{t("DeleteAccount.previewLoading")}</Text>
              ) : (
                <View style={styles.impactBox}>
                  <Text style={styles.impactLine}>
                    {t("DeleteAccount.personalDataSection")}: {t("DeleteAccount.personalDataCount", { n: impact.personalPets })}
                  </Text>
                  <Text style={styles.impactLine}>
                    {t("DeleteAccount.familyDataSection")}: {t("DeleteAccount.familyDataCount", { n: impact.familyPets })}
                  </Text>
                  <Text style={styles.impactLine}>
                    {t("DeleteAccount.socialDataSection")}: {t("DeleteAccount.socialDataCount", { n: impact.posts })}
                  </Text>
                </View>
              )}

              <Text style={styles.confirmLabel}>
                {t("DeleteAccount.confirmInputLabel", { name: expectedName || "—" })}
              </Text>
              <TextInput
                style={styles.input}
                value={confirmName}
                onChangeText={setConfirmName}
                placeholder={expectedName}
                placeholderTextColor={colors.ink3}
                autoCapitalize="none"
              />
              <Text style={styles.confirmHint}>{t("DeleteAccount.confirmInputHint")}</Text>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.actions}>
                <Pressable onPress={() => !deleting && setOpen(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>{t("DeleteAccount.cancelButton")}</Text>
                </Pressable>
                <Pressable
                  onPress={doDelete}
                  disabled={!canDelete || deleting}
                  style={[styles.confirmBtn, (!canDelete || deleting) && styles.disabled]}
                >
                  {deleting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.confirmBtnText}>{t("DeleteAccount.confirmButton")}</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  dangerBtn: {
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cookie,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerText: { fontSize: 14, fontWeight: "800", color: colors.cookie },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: "88%",
  },
  title: { fontSize: 18, fontWeight: "800", color: colors.ink },
  cannotUndo: { fontSize: 13, color: colors.cookie, marginTop: spacing.sm },
  impactHeader: { fontSize: 13, fontWeight: "800", color: colors.ink2, marginTop: spacing.lg },
  previewLoading: { fontSize: 12, color: colors.ink3, marginTop: spacing.xs },
  impactBox: { marginTop: spacing.sm, gap: spacing.xs },
  impactLine: { fontSize: 13, color: colors.ink2 },
  confirmLabel: { fontSize: 13, fontWeight: "700", color: colors.ink, marginTop: spacing.lg },
  input: {
    height: 48,
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.ink,
    marginTop: spacing.sm,
  },
  confirmHint: { fontSize: 11, color: colors.ink3, marginTop: spacing.xs },
  error: { fontSize: 12, color: colors.cookie, marginTop: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg, marginBottom: spacing.md },
  cancelBtn: { flex: 1, height: 48, borderRadius: radius.pill, backgroundColor: colors.bgAlt, alignItems: "center", justifyContent: "center" },
  cancelText: { fontSize: 15, fontWeight: "700", color: colors.ink2 },
  confirmBtn: { flex: 1, height: 48, borderRadius: radius.pill, backgroundColor: colors.cookie, alignItems: "center", justifyContent: "center" },
  confirmBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },
  disabled: { opacity: 0.5 },
});
