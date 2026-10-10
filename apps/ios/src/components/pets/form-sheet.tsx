/**
 * Reusable form shell + field primitives for the Pets forms (pet / reminder /
 * expense / health). FormSheet is a full-screen RN Modal (pageSheet) with a
 * Cancel / title / Save header and a keyboard-aware scroll body — the iOS
 * presentation of web's form Dialogs (apps/web/src/components/ui/dialog.tsx).
 *
 * Fields share the ui primitives' look (apps/ios/src/components/ui/Input.tsx ↔
 * web ui/input + select.tsx FieldLabel): 12/500 ink2 label, 44pt control,
 * radius 8, 1px hairline border (2px brand while active), 14pt ink text.
 *
 *  - TextField     → ui Field + Input / Textarea (thin wrapper, kept for callers)
 *  - SelectField   → label + wrapping option pills (web <Select>; pills are the
 *                    native-friendly equivalent for 2–7 options)
 *  - DateField     → Input-styled button toggling an inline spinner picker
 *                    (locale follows the in-app language)
 *  - OptionalDateField → "+ label" chip when empty (web empty date input),
 *                    else DateField + a clear button
 *  - StepperField  → web pet-walk-goal-input: [−] [value unit] [+] with 40pt
 *                    radius-8 hairline buttons, disabled at the bounds, and an
 *                    optional 11pt hint; VoiceOver "adjustable" on the value.
 *
 * Motion: the sheet slides in, or appears instantly under Reduce Motion
 * (docs/design-system.md §5).
 */
import { type ReactNode, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type KeyboardTypeOptions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Minus, Plus, X } from "lucide-react-native";

import { Button, Field, FieldLabel, Input, Textarea } from "@/components/ui";
import { getActiveLocale, t } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { toLocalDateInput } from "@mango/shared-business";
import { colors, radius, spacing } from "@/theme/theme";

export function FormSheet({
  visible,
  title,
  onCancel,
  onSave,
  saving = false,
  saveDisabled = false,
  children,
}: {
  visible: boolean;
  title: string;
  onCancel: () => void;
  onSave: () => void;
  saving?: boolean;
  saveDisabled?: boolean;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const saveBlocked = saving || saveDisabled;
  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? "none" : "slide"}
      presentationStyle="pageSheet"
      onRequestClose={saving ? undefined : onCancel}
    >
      <SafeAreaView style={styles.sheet} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable
            onPress={onCancel}
            hitSlop={8}
            disabled={saving}
            accessibilityRole="button"
            accessibilityState={{ disabled: saving }}
            style={styles.headerBtn}
          >
            <Text style={[styles.cancel, saving && styles.saveDisabled]}>{t("Common.cancel")}</Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
          <Pressable
            onPress={onSave}
            hitSlop={8}
            disabled={saveBlocked}
            accessibilityRole="button"
            accessibilityLabel={t("Common.save")}
            accessibilityState={{ disabled: saveBlocked, busy: saving }}
            style={[styles.headerBtn, styles.headerBtnEnd]}
          >
            {saving ? (
              <ActivityIndicator color={colors.brandDeep} />
            ) : (
              <Text style={[styles.save, saveDisabled && styles.saveDisabled]}>
                {t("Common.save")}
              </Text>
            )}
          </Pressable>
        </View>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  autoFocus,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  autoFocus?: boolean;
  error?: string | null;
}) {
  const Control = multiline ? Textarea : Input;
  return (
    <Field label={label}>
      <Control
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType ?? "default"}
        autoFocus={autoFocus}
        accessibilityLabel={label}
        error={error}
      />
    </Field>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.pillRow} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value || "__none"}
              onPress={() => onChange(opt.value)}
              hitSlop={{ top: 4, bottom: 4 }}
              style={({ pressed }) => [
                styles.optPill,
                active && styles.optPillActive,
                pressed && !active && styles.optPillPressed,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active, checked: active }}
            >
              <Text style={[styles.optLabel, active && styles.optLabelActive]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function formatDateDisplay(value: Date, mode: "date" | "datetime"): string {
  if (mode === "date") return toLocalDateInput(value);
  const hh = String(value.getHours()).padStart(2, "0");
  const mm = String(value.getMinutes()).padStart(2, "0");
  return `${toLocalDateInput(value)} ${hh}:${mm}`;
}

export function DateField({
  label,
  value,
  onChange,
  mode = "date",
  minimumDate,
  maximumDate,
}: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  mode?: "date" | "datetime";
  minimumDate?: Date;
  maximumDate?: Date;
}) {
  const [open, setOpen] = useState(false);
  const display = formatDateDisplay(value, mode);
  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={[styles.dateBox, open && styles.dateBoxOpen]}
        accessibilityRole="button"
        accessibilityLabel={`${label} ${display}`}
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.dateText}>{display}</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={value}
          mode={mode}
          display="spinner"
          locale={getActiveLocale()}
          themeVariant="light"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(_e, d) => {
            if (d) onChange(d);
          }}
        />
      ) : null}
    </View>
  );
}

/**
 * Optional date (web: an empty `<input type="date">`). Unset → a "+ label"
 * chip; set → the DateField + a clear button (Common.delete).
 */
export function OptionalDateField({
  label,
  value,
  onChange,
  initialDate,
  maximumDate,
  clearable = true,
}: {
  label: string;
  value: Date | null;
  onChange: (d: Date | null) => void;
  /** Date the picker starts at when the chip is tapped (default today). */
  initialDate?: () => Date;
  maximumDate?: Date;
  /** Show the clear button once a date is set (default true). */
  clearable?: boolean;
}) {
  if (!value) {
    return (
      <View style={styles.field}>
        <FieldLabel>{label}</FieldLabel>
        <Button
          label={label}
          variant="secondary"
          size="sm"
          pill
          icon={Plus}
          onPress={() => onChange(initialDate ? initialDate() : new Date())}
          style={styles.addDate}
        />
      </View>
    );
  }
  return (
    <View>
      <DateField label={label} value={value} onChange={onChange} maximumDate={maximumDate} />
      {clearable ? (
        <Button
          label={t("Common.delete")}
          variant="ghost"
          size="sm"
          icon={X}
          onPress={() => onChange(null)}
          accessibilityLabel={`${t("Common.delete")} ${label}`}
          style={styles.clearDate}
        />
      ) : null}
    </View>
  );
}

export function StepperField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
  /** Small ink3 line under the stepper (web text-[11px]). */
  hint?: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  const safe = clamp(value);
  const atMin = safe <= min;
  const atMax = safe >= max;
  const dec = () => onChange(clamp(safe - step));
  const inc = () => onChange(clamp(safe + step));
  const valueText = unit ? `${safe} ${unit}` : `${safe}`;

  return (
    <View style={styles.stepperField}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.stepper}>
        <Pressable
          onPress={dec}
          disabled={atMin}
          hitSlop={2}
          style={({ pressed }) => [
            styles.stepBtn,
            pressed && styles.stepBtnPressed,
            atMin && styles.stepBtnDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`−${step}`}
          accessibilityState={{ disabled: atMin }}
        >
          <Minus size={16} color={colors.ink2} strokeWidth={2} />
        </Pressable>
        <View
          style={styles.stepValueBox}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ text: valueText }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === "increment") inc();
            else if (e.nativeEvent.actionName === "decrement") dec();
          }}
        >
          <Text style={styles.stepValue}>{safe}</Text>
          {unit ? <Text style={styles.stepUnit}>{unit}</Text> : null}
        </View>
        <Pressable
          onPress={inc}
          disabled={atMax}
          hitSlop={2}
          style={({ pressed }) => [
            styles.stepBtn,
            pressed && styles.stepBtnPressed,
            atMax && styles.stepBtnDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`+${step}`}
          accessibilityState={{ disabled: atMax }}
        >
          <Plus size={16} color={colors.ink2} strokeWidth={2} />
        </Pressable>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  headerBtn: { minWidth: 56, minHeight: 44, justifyContent: "center" },
  headerBtnEnd: { alignItems: "flex-end" },
  cancel: { fontSize: 16, color: colors.ink2 },
  // web Dialog title 16/600
  title: { fontSize: 16, fontWeight: "600", color: colors.ink, flex: 1, textAlign: "center" },
  save: { fontSize: 16, fontWeight: "700", color: colors.brandDeep },
  saveDisabled: { color: colors.ink3 },
  // web Dialog p-5 + form gap-4
  body: { padding: 20, gap: spacing.lg, paddingBottom: spacing.xxl },
  // web flex-col gap-1
  field: { gap: spacing.xs },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  optPill: {
    minHeight: 36,
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
  },
  optPillActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  optPillPressed: { backgroundColor: colors.bgAlt },
  optLabel: { fontSize: 14, fontWeight: "500", color: colors.ink2 },
  optLabelActive: { color: "#ffffff", fontWeight: "700" },
  // ui Input look: h 44, radius 8, 1px hairline (2px brand when active), px 12
  dateBox: {
    height: 44,
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
  },
  dateBoxOpen: { borderWidth: 2, borderColor: colors.brand, paddingHorizontal: 11 },
  dateText: { fontSize: 14, color: colors.ink, fontVariant: ["tabular-nums"] },
  addDate: { alignSelf: "flex-start" },
  clearDate: { alignSelf: "flex-end", marginTop: spacing.xs },
  // web flex-col gap-1.5
  stepperField: { gap: 6 },
  // web flex items-center gap-2
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  // web size-10 rounded-lg border hairline bg-card text-ink-2 disabled:opacity-40
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnPressed: { backgroundColor: colors.bgAlt },
  stepBtnDisabled: { opacity: 0.4 },
  // web flex items-baseline gap-1 rounded-lg border hairline bg-white px-3 py-2
  stepValueBox: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.xs,
    minWidth: 96,
    justifyContent: "center",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: spacing.sm,
  },
  // web text-lg font-bold tabular-nums
  stepValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
    minWidth: 40,
    textAlign: "center",
  },
  // web text-xs font-semibold text-ink-2
  stepUnit: { fontSize: 12, fontWeight: "600", color: colors.ink2 },
  // web text-[11px] text-ink-3
  hint: { fontSize: 11, color: colors.ink3 },
});
