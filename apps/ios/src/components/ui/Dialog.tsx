/**
 * Dialog — the iOS equivalent of web apps/web/src/components/ui/dialog.tsx.
 *
 * Web renders a bottom sheet on phones (`items-end`, `rounded-t-*`,
 * `max-h-[90vh]`, black/50 backdrop that closes on tap) and a centred card
 * from `sm:` up. Here `size="sheet"` (default) is the phone sheet and
 * `size="center"` the centred card (max-w-lg = 512, capped to CONTENT_MAX_WIDTH).
 *
 *  - header (only when `title` is set, like web): title 16/600 ink + X close
 *    (lucide X, a11y label Common.close), p-5, hairline bottom border
 *  - body: ScrollView, p-5; optional `description` (14 ink2) first
 *  - footer: optional pinned area below the scroll body (actions)
 *  - KeyboardAvoidingView so inputs are never covered; safe-area bottom pad
 *  - accessibilityViewIsModal + VoiceOver escape gesture closes
 *
 * Motion: the scrim fades and the sheet slides up (center: fades + scales)
 * with RN Animated; under Reduce Motion everything appears instantly (no
 * slide) per docs/design-system.md §5. The RN Modal itself uses
 * animationType "none" so the scrim never slides in with the sheet.
 *
 * `dismissible={false}` disables backdrop tap, the X button, the escape
 * gesture and the hardware back request (e.g. while a write is in flight).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";

import { t } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { colors, radius, spacing, CONTENT_MAX_WIDTH } from "@/theme/theme";

export type DialogSize = "sheet" | "center";

export type DialogProps = {
  visible?: boolean;
  /** Alias of `visible` (web prop name). */
  open?: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: ReactNode;
  /** Pinned below the scrolling body (e.g. the submit / cancel buttons). */
  footer?: ReactNode;
  /** Default true. False = no backdrop / X / escape dismissal. */
  dismissible?: boolean;
  size?: DialogSize;
  /** Called once the dialog has fully disappeared (after the exit animation). */
  onClosed?: () => void;
  /** Style for the ScrollView content container (default padding 20, gap 12). */
  contentStyle?: StyleProp<ViewStyle>;
  /** Style for the sheet/card surface. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** True while the software keyboard is up (drops the home-indicator pad). */
function useKeyboardShown(active: boolean): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) return;
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const a = Keyboard.addListener(showEvt, () => setShown(true));
    const b = Keyboard.addListener(hideEvt, () => setShown(false));
    return () => {
      a.remove();
      b.remove();
      setShown(false);
    };
  }, [active]);
  return shown;
}

const ENTER_MS = 260;
const EXIT_MS = 200;
// web p-5
const BODY_PAD = 20;
// web sm:max-w-lg
const CENTER_MAX_WIDTH = Math.min(512, CONTENT_MAX_WIDTH);

export function Dialog({
  visible,
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dismissible = true,
  size = "sheet",
  onClosed,
  contentStyle,
  style,
  testID,
}: DialogProps) {
  const isOpen = visible ?? open ?? false;
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const isSheet = size === "sheet";

  const [mounted, setMounted] = useState(isOpen);
  // Always start hidden so a dialog that mounts already-open still animates in.
  const [progress] = useState(() => new Animated.Value(0));
  const keyboardShown = useKeyboardShown(mounted);
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      if (reduceMotion) {
        progress.setValue(1);
        return;
      }
      Animated.timing(progress, {
        toValue: 1,
        duration: ENTER_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    if (reduceMotion) {
      progress.setValue(0);
      setMounted(false);
      return;
    }
    Animated.timing(progress, {
      toValue: 0,
      duration: EXIT_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      // A re-open during the exit animation interrupts it (finished=false).
      if (finished) setMounted(false);
    });
  }, [isOpen, reduceMotion, progress]);

  const requestClose = () => {
    if (dismissible) onClose();
  };

  const surfaceMotion = isSheet
    ? {
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [windowHeight, 0],
            }),
          },
        ],
      }
    : {
        opacity: progress,
        transform: [
          {
            scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }),
          },
        ],
      };

  // Sheet: clear the home indicator, unless the keyboard already covers it.
  const bottomPad = isSheet && !keyboardShown ? insets.bottom : 0;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={requestClose}
      onDismiss={() => onClosedRef.current?.()}
      testID={testID}
    >
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: progress }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={requestClose}
            accessible={false}
            importantForAccessibility="no"
          />
        </Animated.View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          pointerEvents="box-none"
        >
          <View
            pointerEvents="box-none"
            style={[
              styles.frame,
              { paddingTop: Math.max(insets.top, spacing.lg) + spacing.md },
              isSheet ? styles.frameSheet : [styles.frameCenter, { paddingBottom: insets.bottom + spacing.lg }],
            ]}
          >
            <Animated.View
              accessibilityViewIsModal
              onAccessibilityEscape={requestClose}
              style={[
                styles.surface,
                isSheet ? styles.surfaceSheet : styles.surfaceCenter,
                surfaceMotion,
                style,
              ]}
            >
              {title ? (
                <View style={styles.header}>
                  <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
                    {title}
                  </Text>
                  {dismissible ? (
                    <Pressable
                      onPress={onClose}
                      accessibilityRole="button"
                      accessibilityLabel={t("Common.close")}
                      hitSlop={4}
                      style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
                    >
                      <X size={20} color={colors.ink} strokeWidth={2} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <ScrollView
                style={styles.scroll}
                contentContainerStyle={[
                  styles.body,
                  { paddingBottom: footer ? spacing.md : BODY_PAD + bottomPad },
                  contentStyle,
                ]}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {description ? <Text style={styles.description}>{description}</Text> : null}
                {children}
              </ScrollView>

              {footer ? (
                <View style={[styles.footer, { paddingBottom: BODY_PAD + bottomPad }]}>
                  {footer}
                </View>
              ) : null}
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  // web bg-black/50
  scrim: { backgroundColor: "rgba(0,0,0,0.5)" },
  frame: { flex: 1, width: "100%" },
  frameSheet: { justifyContent: "flex-end" },
  frameCenter: { justifyContent: "center", paddingHorizontal: spacing.lg },
  surface: {
    backgroundColor: colors.card,
    overflow: "hidden",
    width: "100%",
    alignSelf: "center",
    // % of the frame's content box (frame padding keeps it off the status bar).
    maxHeight: "100%",
  },
  surfaceSheet: {
    maxWidth: CONTENT_MAX_WIDTH,
    borderTopLeftRadius: radius.xl2,
    borderTopRightRadius: radius.xl2,
  },
  surfaceCenter: {
    maxWidth: CENTER_MAX_WIDTH,
    borderRadius: radius.xl2,
  },
  // web: sticky top-0 flex items-center justify-between border-b p-5
  // 12 + 44pt close button + 12 = web's p-5 + 28px X button (68).
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: BODY_PAD,
    paddingVertical: 12,
    minHeight: 68,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  title: { flex: 1, fontSize: 16, fontWeight: "600", color: colors.ink },
  // glyph lands 24 from the edge like web's p-5 + p-1 button.
  close: {
    width: 44,
    height: 44,
    marginRight: -8,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  closePressed: { backgroundColor: colors.bgAlt },
  scroll: { flexGrow: 0, flexShrink: 1 },
  // web p-5
  body: { padding: BODY_PAD, gap: spacing.md },
  description: { fontSize: 14, lineHeight: 20, color: colors.ink2 },
  footer: {
    paddingHorizontal: BODY_PAD,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
});
