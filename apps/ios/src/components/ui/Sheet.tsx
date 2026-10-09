/**
 * Sheet — generic bottom/page modal wrapper (UX-0). Wraps the RN Modal
 * (pageSheet, no react-native-modal dep) with a safe-area body + an optional
 * cancel/title/confirm header. The Pets forms use the specialised FormSheet;
 * lighter surfaces (pickers, confirms, info sheets) use this.
 *
 * `fullScreen` switches to a formSheet-free full-screen presentation for
 * immersive surfaces (e.g. lightbox) that draw their own chrome.
 *
 * Reduce Motion (docs/design-system.md §5): the slide-up presentation becomes
 * an instant appear (animationType "none").
 *
 * For the web ui/dialog look (scrim + rounded sheet + X close) use Dialog.
 */
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { t } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { colors, spacing, type } from "@/theme/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Right-side action in the header (e.g. a Save Button or text). */
  headerRight?: ReactNode;
  /** Left-side close label shown when a title is set. Default t("Common.cancel"). */
  cancelLabel?: string;
  children: ReactNode;
  fullScreen?: boolean;
  keyboardAvoiding?: boolean;
};

export function Sheet({
  visible,
  onClose,
  title,
  headerRight,
  cancelLabel,
  children,
  fullScreen = false,
  keyboardAvoiding = false,
}: Props) {
  const reduceMotion = useReducedMotion();
  const closeLabel = cancelLabel ?? t("Common.cancel");
  const body = (
    <SafeAreaView
      style={styles.safe}
      edges={fullScreen ? ["top", "bottom"] : ["top", "bottom"]}
    >
      {title != null ? (
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            style={styles.cancelBtn}
          >
            <Text style={styles.cancel}>{closeLabel}</Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
          <View style={styles.headerRight}>{headerRight}</View>
        </View>
      ) : null}
      <View style={styles.flex}>{children}</View>
    </SafeAreaView>
  );

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? "none" : "slide"}
      presentationStyle={fullScreen ? "fullScreen" : "pageSheet"}
      onRequestClose={onClose}
      transparent={false}
    >
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    // the 44pt cancel target supplies the height (≈ previous 12 + text + 12)
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  cancelBtn: { minWidth: 48, minHeight: 44, justifyContent: "center" },
  cancel: { fontSize: 16, color: colors.ink2 },
  title: { ...type.title, color: colors.ink, flex: 1, textAlign: "center" },
  headerRight: { minWidth: 48, alignItems: "flex-end" },
});
