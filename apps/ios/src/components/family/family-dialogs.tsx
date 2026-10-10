/**
 * Create / join family dialogs — 1:1 with web CreateFamilyDialog /
 * JoinFamilyDialog (apps/web/src/components/family/family-section.tsx), on the
 * shared keyboard-safe Dialog. Used by the settings family card and the
 * /family screen.
 *
 *  - Create: instructions, name (maxLength 40, autoFocus; empty → the
 *    Family.defaultName), inline error, Cancel (ghost) / Submit.
 *  - Join: instructions, a digits-only 6-char code (placeholder 123456,
 *    submit disabled until 6 digits), alreadyMember → errAlready, other
 *    failures show the server message (web), Cancel / Submit.
 *
 * Both hand the new familyId to `onDone` so the caller can chain the import
 * wizard before refreshing.
 */
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Input";
import { createFamily, joinFamilyByCode } from "@/lib/families-write";
import { t } from "@/lib/i18n";
import { colors, spacing } from "@/theme/theme";

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function CreateFamilyDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (familyId: string) => Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setError(null);
    }
  }, [open]);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await createFamily(name.trim() || t("Family.defaultName"));
      await onDone(res.familyId);
      onClose();
    } catch (err) {
      setError(messageOf(err, t("Family.actionFailed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      visible={open}
      onClose={onClose}
      title={t("Family.createDialog.title")}
      dismissible={!busy}
      footer={
        <View style={styles.actions}>
          <Button label={t("Common.cancel")} variant="ghost" onPress={onClose} disabled={busy} />
          <Button
            label={busy ? "..." : t("Family.createDialog.submit")}
            onPress={() => void submit()}
            disabled={busy}
          />
        </View>
      }
    >
      <Text style={styles.body}>{t("Family.createDialog.instructions")}</Text>
      <Field label={t("Family.createDialog.nameLabel")}>
        <Input
          value={name}
          onChangeText={setName}
          placeholder={t("Family.createDialog.namePlaceholder")}
          maxLength={40}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
        />
      </Field>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </Dialog>
  );
}

export function JoinFamilyDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (familyId: string) => Promise<void> | void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCode("");
      setError(null);
    }
  }, [open]);

  async function submit() {
    if (busy) return;
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError(t("Family.joinDialog.errInvalidCode"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await joinFamilyByCode(trimmed);
      if (res.alreadyMember) {
        setError(t("Family.joinDialog.errAlready"));
        return;
      }
      await onDone(res.familyId);
      onClose();
    } catch (err) {
      setError(messageOf(err, t("Join.error")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      visible={open}
      onClose={onClose}
      title={t("Family.joinDialog.title")}
      dismissible={!busy}
      footer={
        <View style={styles.actions}>
          <Button label={t("Common.cancel")} variant="ghost" onPress={onClose} disabled={busy} />
          <Button
            label={busy ? "..." : t("Family.joinDialog.submit")}
            onPress={() => void submit()}
            disabled={busy || code.length !== 6}
          />
        </View>
      }
    >
      <Text style={styles.body}>{t("Family.joinDialog.instructions")}</Text>
      <Input
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
        placeholder="123456"
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
        style={styles.codeInput}
        accessibilityLabel={t("Family.inviteCode")}
      />
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
  // web: font-mono text-2xl text-center tracking-widest tabular-nums
  codeInput: {
    fontSize: 24,
    fontWeight: "600",
    letterSpacing: 6,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  error: { fontSize: 14, color: colors.danger },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.md },
});
