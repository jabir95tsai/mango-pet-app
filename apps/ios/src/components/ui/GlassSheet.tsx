/**
 * GlassSheet — a bottom sheet on a thick-glass panel. The Modal is transparent
 * so the blur frosts the app content behind it; a dimmed backdrop closes on tap.
 * Optional cancel/title/confirm header. Reduce-transparency → opaque warm panel
 * (via GlassSurface).
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

import { GlassSurface } from "./GlassSurface";
import { colors, glassRadius, spacing, type } from "@/theme/theme";

export function GlassSheet({
  visible,
  onClose,
  title,
  headerRight,
  cancelLabel = "取消",
  children,
  keyboardAvoiding = false,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  headerRight?: ReactNode;
  cancelLabel?: string;
  children: ReactNode;
  keyboardAvoiding?: boolean;
}) {
  const panel = (
    <GlassSurface level="thick" radius={glassRadius.sheet} contentStyle={styles.panel}>
      <SafeAreaView edges={["bottom"]}>
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
        {children}
      </SafeAreaView>
    </GlassSurface>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {keyboardAvoiding ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.dock}
          >
            <Pressable>{panel}</Pressable>
          </KeyboardAvoidingView>
        ) : (
          <Pressable style={styles.dock}>{panel}</Pressable>
        )}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(35,27,20,0.35)", justifyContent: "flex-end" },
  dock: { width: "100%" },
  panel: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  cancel: { fontSize: 16, color: colors.ink2 },
  title: { ...type.title, color: colors.ink, flex: 1, textAlign: "center" },
  headerRight: { minWidth: 48, alignItems: "flex-end" },
});
