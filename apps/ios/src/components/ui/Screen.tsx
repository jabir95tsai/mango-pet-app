/**
 * Screen — the standard page wrapper (UX-0). Owns the cream background, the
 * safe-area insets (via react-native-safe-area-context, not the RN SafeAreaView
 * which ignores the dynamic island on notched devices), optional scroll, and
 * keyboard avoidance. Surfaces stop re-declaring `safe: { flex: 1, bg }` +
 * inset math and just wrap their content here.
 *
 * `scroll` (default) renders a ScrollView; pass scroll={false} for screens that
 * own their own list/scroll. `contentBottom` adds padding so content clears the
 * raised tab bar + any docked CTA.
 */
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  SafeAreaView,
  type Edge,
} from "react-native-safe-area-context";

import { colors, spacing } from "@/theme/theme";

type Props = {
  children: ReactNode;
  scroll?: boolean;
  /** Avoid the keyboard (forms). Off by default — most read screens don't need it. */
  keyboardAvoiding?: boolean;
  edges?: readonly Edge[];
  /** Extra bottom padding inside the scroll content (clears tab bar / docked CTA). */
  contentBottom?: number;
  padded?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  scroll = true,
  keyboardAvoiding = false,
  edges = ["top"],
  contentBottom = 0,
  padded = true,
  contentStyle,
  style,
}: Props) {
  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={[
        padded && styles.padded,
        { paddingBottom: contentBottom },
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padded && styles.padded, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.safe, style]} edges={edges}>
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  padded: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
});
