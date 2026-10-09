/**
 * "⋯" menu attached to a post or comment — report content / block author.
 * Spec docs/features/ugc-moderation.md (App Store Guideline 1.2: UGC apps
 * must offer report + block). Mirrors web apps/web/src/components/feed/
 * post-menu.tsx. Callers hide it for guests and for the viewer's own content.
 *
 *  - menu: native ActionSheetIOS (accepted platform equivalent of web's
 *    dropdown) — "report post/comment" + destructive "block {name}"
 *  - report: a Dialog like web — reason radio list (spam default), optional
 *    note (≤300 chars, written to reports/{id}.note only when non-empty, same
 *    field web writes) and a primary submit button
 *  - block: confirm() (destructive) → blockUser → onBlocked
 * Feedback for submit / failure uses native alerts (web shows a tiny inline
 * bubble).
 */
import { useRef, useState } from "react";
import { ActionSheetIOS, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { MoreVertical } from "lucide-react-native";
import { REPORT_REASONS, type ReportReason, type ReportTargetType } from "@mango/shared-types";

import { createReport, type CreateReportArgs } from "@/lib/posts";
import { blockUser } from "@/lib/user-prefs";
import { confirm } from "@/lib/confirm";
import { t } from "@/lib/i18n";
import { Button, Dialog, Textarea } from "@/components/ui";
import { colors, radius, spacing } from "@/theme/theme";

const REASON_KEY: Record<ReportReason, string> = {
  spam: "Moderation.reportReasonSpam",
  harassment: "Moderation.reportReasonHarassment",
  inappropriate: "Moderation.reportReasonInappropriate",
  other: "Moderation.reportReasonOther",
};

const NOTE_MAX = 300;

export function PostMenu({
  currentUid,
  targetType,
  postId,
  targetId,
  targetAuthorUid,
  targetAuthorName,
  onBlocked,
}: {
  currentUid: string;
  targetType: ReportTargetType;
  /** postId of the parent post; equals targetId when reporting a post. */
  postId: string;
  targetId: string;
  targetAuthorUid: string;
  targetAuthorName: string;
  onBlocked?: (blockedUid: string) => void;
}) {
  const isMine = targetAuthorUid === currentUid;
  const [reportOpen, setReportOpen] = useState(false);
  // Keep the Dialog mounted through its exit animation, then drop it so a
  // long feed doesn't hold one idle Modal per post/comment.
  const [reportMounted, setReportMounted] = useState(false);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // The "report received" alert waits until the dialog has fully dismissed —
  // an alert presented on a modal that is mid-dismissal disappears with it.
  const submittedRef = useRef(false);

  function openReport() {
    setReason("spam");
    setNote("");
    setReportMounted(true);
    setReportOpen(true);
  }

  async function submitReport() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const trimmed = note.trim().slice(0, NOTE_MAX);
      const args: CreateReportArgs = {
        reporterUid: currentUid,
        targetType,
        targetId,
        targetAuthorUid,
        reason,
        ...(trimmed ? { note: trimmed } : {}),
        ...(targetType === "comment" ? { postId } : {}),
      };
      await createReport(args);
      submittedRef.current = true;
      setReportOpen(false);
    } catch {
      Alert.alert(t("Moderation.reportFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBlock() {
    const ok = await confirm({
      title: t("Moderation.blockConfirmTitle", { name: targetAuthorName }),
      message: t("Moderation.blockConfirmMessage"),
      confirmLabel: t("Moderation.blockConfirmAction"),
      destructive: true,
    });
    if (!ok) return;
    try {
      await blockUser(currentUid, targetAuthorUid);
      onBlocked?.(targetAuthorUid);
    } catch {
      Alert.alert(t("Moderation.blockFailed"));
    }
  }

  function openMenu() {
    const reportLabel =
      targetType === "comment" ? t("Moderation.reportComment") : t("Moderation.reportPost");
    const cancel = t("Common.cancel");
    const options = isMine
      ? [reportLabel, cancel]
      : [reportLabel, t("Moderation.block", { name: targetAuthorName }), cancel];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: isMine ? undefined : options.length - 2,
      },
      (index) => {
        if (index === 0) openReport();
        else if (!isMine && index === 1) void handleBlock();
      },
    );
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("Moderation.menu")}
        onPress={openMenu}
        hitSlop={6}
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
      >
        <MoreVertical size={16} color={colors.ink3} strokeWidth={2} />
      </Pressable>

      {reportMounted ? (
        <Dialog
          visible={reportOpen}
          onClose={() => setReportOpen(false)}
          onClosed={() => {
            setReportMounted(false);
            if (submittedRef.current) {
              submittedRef.current = false;
              Alert.alert(t("Moderation.reportSubmitted"));
            }
          }}
          title={t("Moderation.reportTitle")}
          dismissible={!submitting}
        >
          <View accessibilityRole="radiogroup" style={styles.reasons}>
            {REPORT_REASONS.map((r) => {
              const on = reason === r;
              return (
                <Pressable
                  key={r}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => setReason(r)}
                  style={[styles.reason, on && styles.reasonOn]}
                >
                  <View style={[styles.radio, on && styles.radioOn]}>
                    {on ? <View style={styles.radioDot} /> : null}
                  </View>
                  <Text style={styles.reasonText}>{t(REASON_KEY[r])}</Text>
                </Pressable>
              );
            })}
          </View>
          <Textarea
            value={note}
            onChangeText={setNote}
            placeholder={t("Moderation.reportNotePlaceholder")}
            accessibilityLabel={t("Moderation.reportNotePlaceholder")}
            maxLength={NOTE_MAX}
            style={styles.note}
          />
          <Button
            label={t("Moderation.reportSubmit")}
            onPress={() => void submitReport()}
            loading={submitting}
            disabled={submitting}
            style={styles.submit}
          />
        </Dialog>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  // web grid size-8 place-items-center rounded-full text-zinc-400
  btn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPressed: { backgroundColor: colors.bgAlt },
  // web fieldset flex flex-col gap-2
  reasons: { gap: spacing.sm },
  // web flex items-center gap-2 rounded-lg border px-3 py-2 text-sm
  reason: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  // web border-mango-brand-deep bg-mango-brand-tint
  reasonOn: { borderColor: colors.brandDeep, backgroundColor: colors.brandTint },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.ink3,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: colors.brandDeep },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandDeep },
  reasonText: { flex: 1, fontSize: 14, color: colors.ink },
  // web rows={2}
  note: { minHeight: 64 },
  // web self-end
  submit: { alignSelf: "flex-end" },
});
