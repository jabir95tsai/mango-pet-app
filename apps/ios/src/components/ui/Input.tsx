/**
 * Input / Textarea / FieldLabel / Field — 1:1 with web
 * apps/web/src/components/ui/input.tsx, textarea.tsx and select.tsx FieldLabel.
 *
 *  Input    web `h-10 w-full rounded-lg border border-zinc-200 bg-white px-3
 *           text-sm placeholder:text-zinc-400 focus:ring-2 focus:ring-amber-500`
 *           → mango: card fill, 1px hairline border, radius sm (8), px 12,
 *           14pt ink text, ink3 placeholder; focus = 2px brand border (the
 *           ring). Height 44 (native tap floor; web 40).
 *  Textarea web `min-h-[88px] p-3` (same look), multiline, text top-aligned.
 *  FieldLabel web `text-xs font-medium text-zinc-600` → 12/500 ink2.
 *  Field    web `flex flex-col gap-1` wrapper: label + control + error.
 *
 * Both controls forwardRef to the underlying TextInput and pass every
 * TextInputProps through. `error` (string) turns the border danger and renders
 * the message under the control; `invalid` only colours the border.
 *
 * Layout styles (flex, margins, width, alignSelf, position…) passed via
 * `style` are applied to the outer wrapper so the control can sit in rows; use
 * `containerStyle` to style the wrapper explicitly.
 */
import { forwardRef, useEffect, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextInputFocusEventData,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { colors, radius, spacing } from "@/theme/theme";

export type InputProps = TextInputProps & {
  /** Error message under the control (also turns the border danger). */
  error?: string | null;
  /** Danger border without a message. */
  invalid?: boolean;
  /** Style for the outer wrapper View. */
  containerStyle?: StyleProp<ViewStyle>;
};

const LAYOUT_KEYS = new Set<string>([
  "flex",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "alignSelf",
  "width",
  "minWidth",
  "maxWidth",
  "margin",
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "marginHorizontal",
  "marginVertical",
  "marginStart",
  "marginEnd",
  "position",
  "top",
  "bottom",
  "left",
  "right",
  "zIndex",
]);

/** Splits caller styles into wrapper (layout) and control (visual) parts. */
function splitStyle(style: StyleProp<TextStyle>): { outer: ViewStyle; inner: TextStyle } {
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flat)) {
    (LAYOUT_KEYS.has(k) ? outer : inner)[k] = v;
  }
  return { outer: outer as ViewStyle, inner: inner as TextStyle };
}

function useFocusRing(props: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return {
    focused,
    onFocus: (e: NativeSyntheticEvent<TextInputFocusEventData>) => {
      setFocused(true);
      props.onFocus?.(e);
    },
    onBlur: (e: NativeSyntheticEvent<TextInputFocusEventData>) => {
      setFocused(false);
      props.onBlur?.(e);
    },
  };
}

/** VoiceOver has no live regions; announce a newly shown error instead. */
function useAnnounce(message: string | null | undefined) {
  useEffect(() => {
    if (message) AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
}

function borderFor(focused: boolean, bad: boolean): TextStyle {
  // 1px → 2px on focus; padding compensates so the text never shifts.
  const borderColor = bad ? colors.danger : focused ? colors.brand : colors.hairline;
  return { borderWidth: focused ? 2 : 1, borderColor };
}

const Control = forwardRef<TextInput, InputProps & { multiline?: boolean; kind: "input" | "textarea" }>(
  function Control({ error, invalid, containerStyle, style, kind, editable, ...rest }, ref) {
    const ring = useFocusRing(rest);
    useAnnounce(error);
    const bad = !!error || !!invalid;
    const { outer, inner } = splitStyle(style);
    const isArea = kind === "textarea";
    // web px-3 / p-3; minus the extra 1px of the focus border.
    const pad = 12 - (ring.focused ? 1 : 0);

    return (
      <View style={[styles.wrap, outer, containerStyle]}>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.ink3}
          selectionColor={colors.brandDeep}
          cursorColor={colors.brandDeep}
          editable={editable}
          multiline={isArea ? true : rest.multiline}
          textAlignVertical={isArea ? "top" : rest.textAlignVertical}
          accessibilityState={{ disabled: editable === false }}
          {...rest}
          onFocus={ring.onFocus}
          onBlur={ring.onBlur}
          style={[
            isArea ? styles.textarea : styles.input,
            borderFor(ring.focused, bad),
            isArea ? { padding: pad } : { paddingHorizontal: pad },
            editable === false && styles.disabled,
            inner,
          ]}
        />
        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </View>
    );
  },
);

/** Single-line text field (web ui/input). */
export const Input = forwardRef<TextInput, InputProps>(function Input(props, ref) {
  return <Control ref={ref} {...props} kind="input" />;
});

/** Multi-line text field (web ui/textarea, min-h 88). */
export const Textarea = forwardRef<TextInput, InputProps>(function Textarea(props, ref) {
  return <Control ref={ref} {...props} kind="textarea" />;
});

/** Small label above a control (web select.tsx FieldLabel). */
export function FieldLabel({
  children,
  style,
  required,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  /** Appends a decorative " *". */
  required?: boolean;
}) {
  return (
    <Text style={[styles.label, style]}>
      {children}
      {required ? <Text style={styles.required}> *</Text> : null}
    </Text>
  );
}

/** Label + control + optional hint/error, stacked with web's `gap-1`. */
export function Field({
  label,
  hint,
  error,
  required,
  children,
  style,
}: {
  label?: string;
  hint?: string;
  /** Prefer passing `error` to the Input itself; this is for custom controls. */
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  useAnnounce(error);
  return (
    <View style={[styles.field, style]}>
      {label ? <FieldLabel required={required}>{label}</FieldLabel> : null}
      {children}
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "stretch", gap: spacing.xs },
  input: {
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    fontSize: 14,
    color: colors.ink,
  },
  textarea: {
    minHeight: 88,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  disabled: { opacity: 0.6 },
  error: { fontSize: 12, color: colors.danger },
  hint: { fontSize: 12, color: colors.ink3 },
  label: { fontSize: 12, fontWeight: "500", color: colors.ink2 },
  required: { color: colors.danger },
  field: { gap: spacing.xs },
});
