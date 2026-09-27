/**
 * "⋯" menu attached to a post or comment — report content / block author.
 * Spec docs/features/ugc-moderation.md (App Store Guideline 1.2: UGC apps
 * must offer report + block). Hidden entirely for the viewer's own content
 * (nothing to report/block about yourself) — callers gate that, mirroring
 * web's post-menu.tsx.
 *
 * Native ActionSheetIOS/Alert instead of web's custom dropdown+Dialog —
 * this app is iOS-only, so the native primitives are the idiomatic choice
 * and need zero new deps.
 */
import { ActionSheetIOS, Alert, Pressable, StyleSheet } from "react-native";
import { MoreVertical } from "lucide-react-native";
import { REPORT_REASONS, type ReportReason, type ReportTargetType } from "@mango/shared-types";
import { createReport } from "@/lib/posts";
import { blockUser } from "@/lib/user-prefs";
import { t } from "@/lib/i18n";
import { colors } from "@/theme/theme";

const REASON_KEY: Record<ReportReason, string> = {
  spam: "Moderation.reportReasonSpam",
  harassment: "Moderation.reportReasonHarassment",
  inappropriate: "Moderation.reportReasonInappropriate",
  other: "Moderation.reportReasonOther",
};

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

  function openReasonSheet() {
    const labels = REPORT_REASONS.map((r) => t(REASON_KEY[r]));
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: t("Moderation.reportTitle"),
        options: [...labels, "取消"],
        cancelButtonIndex: labels.length,
      },
      (index) => {
        if (index >= labels.length) return;
        void submitReport(REPORT_REASONS[index]);
      },
    );
  }

  async function submitReport(reason: ReportReason) {
    try {
      await createReport({
        reporterUid: currentUid,
        targetType,
        targetId,
        targetAuthorUid,
        reason,
        ...(targetType === "comment" ? { postId } : {}),
      });
      Alert.alert(t("Moderation.reportSubmitted"));
    } catch {
      Alert.alert(t("Moderation.reportFailed"));
    }
  }

  function confirmBlock() {
    Alert.alert(
      t("Moderation.blockConfirmTitle", { name: targetAuthorName }),
      t("Moderation.blockConfirmMessage"),
      [
        { text: "取消", style: "cancel" },
        {
          text: t("Moderation.blockConfirmAction"),
          style: "destructive",
          onPress: async () => {
            try {
              await blockUser(currentUid, targetAuthorUid);
              onBlocked?.(targetAuthorUid);
            } catch {
              Alert.alert(t("Moderation.blockFailed"));
            }
          },
        },
      ],
    );
  }

  function openMenu() {
    const reportLabel =
      targetType === "comment" ? t("Moderation.reportComment") : t("Moderation.reportPost");
    const options = isMine
      ? [reportLabel, "取消"]
      : [reportLabel, t("Moderation.block", { name: targetAuthorName }), "取消"];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: isMine ? undefined : options.length - 2,
      },
      (index) => {
        if (index === 0) openReasonSheet();
        else if (!isMine && index === 1) confirmBlock();
      },
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("Moderation.menu")}
      onPress={openMenu}
      hitSlop={8}
      style={styles.btn}
    >
      <MoreVertical size={16} color={colors.ink3} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { paddingHorizontal: 6, paddingVertical: 2 },
});
