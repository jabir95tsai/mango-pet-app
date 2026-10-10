/**
 * Bottom sheet "拍張開始/結束照？" with [拍照] / [跳過] — 1:1 with web
 * apps/web/src/components/walks/photo-prompt-sheet.tsx (walks-auto-photo-share
 * flows A + B). Built on the shared Dialog (scrim tap / VoiceOver escape =
 * skip, reduced motion = no slide, safe-area handled).
 *
 * Web sheet: max-w-md (448), rounded-t-3xl (→ radius.xl2), 1px hairline
 * border without bottom edge, card-soft surface, px-6 pt-6 pb-safe+6, grabber,
 * 📸 tile + 18/700 title + 14 ink2 body, then a btn-mango h-12 pill (WHITE
 * bold text + Camera icon) and an h-11 ghost pill skip (14/600 ink2).
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Camera } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { t } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

type Props = {
  visible: boolean;
  phase: "start" | "end";
  petName: string;
  walkMinutes?: number;
  onTake: () => void;
  onSkip: () => void;
  /** The sheet has fully disappeared (sequence the next modal from here). */
  onClosed?: () => void;
};

export function PhotoPromptSheet({
  visible,
  phase,
  petName,
  walkMinutes,
  onTake,
  onSkip,
  onClosed,
}: Props) {
  const insets = useSafeAreaInsets();
  const title =
    phase === "start" ? t("WalksPhotoPrompt.start.title") : t("WalksPhotoPrompt.end.title");
  const body =
    phase === "start"
      ? t("WalksPhotoPrompt.start.body", { pet: petName })
      : t("WalksPhotoPrompt.end.body", { pet: petName, min: walkMinutes ?? 0 });

  return (
    <Dialog
      visible={visible}
      onClose={onSkip}
      onClosed={onClosed}
      style={styles.surface}
      contentStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
    >
      <View style={styles.grabber} />
      <View style={styles.headerRow}>
        <View style={styles.iconBox} accessibilityElementsHidden importantForAccessibility="no">
          <Text style={styles.icon}>📸</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.body}>{body}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          label={t("WalksPhotoPrompt.take")}
          icon={<Camera size={20} />}
          size="lg"
          pill
          fullWidth
          labelStyle={styles.takeLabel}
          onPress={onTake}
        />
        <Pressable
          accessibilityRole="button"
          onPress={onSkip}
          style={({ pressed }) => [styles.skipBtn, pressed && styles.skipPressed]}
        >
          <Text style={styles.skipText}>{t("WalksPhotoPrompt.skip")}</Text>
        </Pressable>
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  surface: {
    maxWidth: 448,
    backgroundColor: colors.cardSoft,
    borderTopLeftRadius: radius.xl2,
    borderTopRightRadius: radius.xl2,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.hairline,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: 0,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.hairline,
    marginBottom: spacing.md,
  },
  headerRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  flex: { flex: 1, minWidth: 0 },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: 24 },
  title: { fontSize: 18, fontWeight: "700", lineHeight: 22, color: colors.ink },
  body: { marginTop: 4, fontSize: 14, lineHeight: 20, color: colors.ink2 },
  actions: { marginTop: 20, gap: spacing.sm },
  takeLabel: { fontWeight: "700" },
  skipBtn: {
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  skipPressed: { backgroundColor: colors.bgAlt },
  skipText: { fontSize: 14, fontWeight: "600", color: colors.ink2 },
});
