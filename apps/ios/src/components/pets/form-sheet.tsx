/**
 * Reusable form shell + field primitives for the Pets forms (D-modal: RN Modal
 * pageSheet, no react-native-modal dep). FormSheet provides the cancel/title/
 * save header + keyboard-aware scroll body; the field primitives keep the four
 * forms (pet / reminder / expense / health) consistent and DRY.
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
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";

import { scoped } from "@/lib/i18n";
import { toLocalDateInput } from "@mango/shared-business";
import { colors, radius, spacing } from "@/theme/theme";

const tC = scoped("Common");

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
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <SafeAreaView style={styles.sheet} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={onCancel} hitSlop={8} disabled={saving}>
            <Text style={styles.cancel}>{tC("cancel")}</Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Pressable onPress={onSave} hitSlop={8} disabled={saving || saveDisabled}>
            {saving ? (
              <ActivityIndicator color={colors.brandDeep} />
            ) : (
              <Text style={[styles.save, saveDisabled && styles.saveDisabled]}>
                {tC("save")}
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
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "decimal-pad";
  multiline?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.ink3}
        keyboardType={keyboardType ?? "default"}
        multiline={multiline}
        autoFocus={autoFocus}
      />
    </View>
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
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pillRow}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={[styles.optPill, active && styles.optPillActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
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

export function DateField({
  label,
  value,
  onChange,
  mode = "date",
}: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  mode?: "date" | "datetime";
}) {
  const [open, setOpen] = useState(false);
  const display =
    mode === "datetime"
      ? `${toLocalDateInput(value)} ${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`
      : toLocalDateInput(value);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={styles.input}
        accessibilityRole="button"
      >
        <Text style={styles.dateText}>{display}</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={value}
          mode={mode}
          display="spinner"
          onChange={(_e, d) => {
            if (d) onChange(d);
          }}
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
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable
          onPress={() => onChange(clamp(value - step))}
          style={styles.stepBtn}
          accessibilityRole="button"
          accessibilityLabel="−"
        >
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <Text style={styles.stepValue}>
          {value}
          {unit ? ` ${unit}` : ""}
        </Text>
        <Pressable
          onPress={() => onChange(clamp(value + step))}
          style={styles.stepBtn}
          accessibilityRole="button"
          accessibilityLabel="＋"
        >
          <Text style={styles.stepBtnText}>＋</Text>
        </Pressable>
      </View>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  cancel: { fontSize: 16, color: colors.ink2 },
  title: { fontSize: 16, fontWeight: "800", color: colors.ink, flex: 1, textAlign: "center" },
  save: { fontSize: 16, fontWeight: "800", color: colors.brandDeep },
  saveDisabled: { color: colors.ink3 },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "700", color: colors.ink2 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.ink,
    minHeight: 46,
    justifyContent: "center",
  },
  inputMultiline: { minHeight: 80, textAlignVertical: "top" },
  dateText: { fontSize: 15, color: colors.ink },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  optPill: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  optPillActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  optLabel: { fontSize: 14, fontWeight: "600", color: colors.ink2 },
  optLabelActive: { color: colors.card, fontWeight: "800" },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { fontSize: 22, fontWeight: "800", color: colors.brandDeep },
  stepValue: { fontSize: 18, fontWeight: "800", color: colors.ink },
});
