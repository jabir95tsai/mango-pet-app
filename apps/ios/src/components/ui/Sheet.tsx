/**
 * Sheet — generic bottom/page modal wrapper (UX-0). Wraps the RN Modal
 * (pageSheet, no react-native-modal dep) with a safe-area body + an optional
 * cancel/title/confirm header. The Pets forms use the specialised FormSheet;
 * lighter surfaces (pickers, confirms, info sheets) use this.
 *
 * `fullScreen` switches to a formSheet-free full-screen presentation for
 * immersive surfaces (e.g. lightbox) that draw their own chrome.
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

import { colors, spacing, type } from "@/theme/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Right-side action in the header (e.g. a Save Button or text). */
  headerRight?: ReactNode;
  /** Left-side label; defaults to a 取消 close affordance when a title is set. */
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
  cancelLabel = "取消",
  children,
  fullScreen = false,
  keyboardAvoiding = false,
}: Props) {
  const body = (
    <SafeAreaView
      style={styles.safe}
      edges={fullScreen ? ["top", "bottom"] : ["top", "bottom"]}
    >
      {title != null ? (
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
            <Text style={styles.cancel}>{cancelLabel}</Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
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
      animationType="slide"
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
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  cancel: { fontSize: 16, color: colors.ink2 },
  title: { ...type.title, color: colors.ink, flex: 1, textAlign: "center" },
  headerRight: { minWidth: 48, alignItems: "flex-end" },
});
