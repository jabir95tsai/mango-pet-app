/**
 * Bottom sheet "拍張開始/結束照?" with [拍照] / [略過]. Mirrors web
 * photo-prompt-sheet (walks-auto-photo-share flows A + B). Backdrop = skip.
 */
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius, spacing } from "@/theme/theme";

type Props = {
  visible: boolean;
  phase: "start" | "end";
  petName: string;
  walkMinutes?: number;
  onTake: () => void;
  onSkip: () => void;
};

export function PhotoPromptSheet({
  visible,
  phase,
  petName,
  walkMinutes,
  onTake,
  onSkip,
}: Props) {
  const title = phase === "start" ? "出發前拍一張？" : "遛完拍一張紀念？";
  const body =
    phase === "start"
      ? `分享 ${petName} 出發的瞬間給家人`
      : `${petName} 今天走了 ${walkMinutes ?? 0} 分，留個紀念`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onSkip}>
      <Pressable style={styles.backdrop} onPress={onSkip}>
        <SafeAreaView edges={["bottom"]} style={styles.sheetWrap}>
          <Pressable style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.headerRow}>
              <View style={styles.iconBox}>
                <Text style={styles.icon}>📸</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.body}>{body}</Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onTake}
              style={({ pressed }) => [styles.takeBtn, pressed && styles.pressed]}
            >
              <Text style={styles.takeText}>📷  拍照</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onSkip} style={styles.skipBtn}>
              <Text style={styles.skipText}>略過</Text>
            </Pressable>
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheetWrap: {
    backgroundColor: colors.cardSoft,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  sheet: { padding: spacing.lg, gap: spacing.md },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.hairline,
  },
  headerRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  flex: { flex: 1 },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: 24 },
  title: { fontSize: 17, fontWeight: "800", color: colors.ink },
  body: { marginTop: 2, fontSize: 14, color: colors.ink2 },
  takeBtn: {
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  takeText: { fontSize: 16, fontWeight: "800", color: colors.ink },
  skipBtn: { height: 44, alignItems: "center", justifyContent: "center" },
  skipText: { fontSize: 14, fontWeight: "600", color: colors.ink2 },
  pressed: { opacity: 0.85 },
});
