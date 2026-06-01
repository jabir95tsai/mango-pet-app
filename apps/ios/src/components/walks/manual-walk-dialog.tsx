/**
 * Manual walk log — parity of web manual-walk-dialog. Pet + duration (+ optional
 * distance + notes), NO GPS → writes via createWalk with isManual:true and no
 * path. Score uses @mango/shared-business (same formula as GPS walks) so the
 * leaderboard stays consistent.
 *
 * P1b note: web also exposes start/end datetime pickers. iOS date pickers need
 * @react-native-community/datetimepicker (a new native dep → branch+gate), so
 * P1b derives startedAt = now − duration, endedAt = now. Explicit date entry is
 * a follow-up (see ship note). zh-TW strings inline (shared-i18n pending).
 */
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { computeWalkScore } from "@mango/shared-business";
import type { Pet } from "@mango/shared-types";

import { createWalk } from "@/lib/walks";
import { useAuth } from "@/state/auth-context";
import { colors, radius, spacing } from "@/theme/theme";

type Props = {
  visible: boolean;
  pets: Pet[];
  streakDays: number;
  familyId: string | null;
  onClose: () => void;
  onSaved: () => void;
};

export function ManualWalkDialog({
  visible,
  pets,
  streakDays,
  familyId,
  onClose,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const [petId, setPetId] = useState("");
  const [duration, setDuration] = useState("30");
  const [distance, setDistance] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setPetId(pets[0]?.petId ?? "");
    setDuration("30");
    setDistance("");
    setNotes("");
    setError(null);
  }, [visible, pets]);

  async function handleSave() {
    const durNum = Number(duration);
    const distNum = distance.trim() === "" ? 0 : Number(distance);
    if (!petId || !Number.isFinite(durNum) || durNum <= 0) {
      setError("請選擇寵物並填寫時長");
      return;
    }
    if (!Number.isFinite(distNum) || distNum < 0) {
      setError("距離格式不正確");
      return;
    }
    if (!user) return;

    const pet = pets.find((p) => p.petId === petId) ?? null;
    const endedAt = new Date();
    const startedAt = new Date(endedAt.getTime() - durNum * 60_000);

    setSaving(true);
    setError(null);
    try {
      await createWalk({
        scorePet: pet,
        streakDays,
        familyId,
        walkerUid: user.uid,
        walkerName: user.displayName ?? user.email?.split("@")[0] ?? "Friend",
        walkerPhotoURL: user.photoURL,
        petId,
        petName: pet?.name ?? null,
        startedAt,
        endedAt,
        distanceKm: distNum,
        durationMin: durNum,
        path: undefined,
        isManual: true,
        notes: notes.trim() || undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "存檔失敗");
    } finally {
      setSaving(false);
    }
  }

  // Live score preview so the user sees manual logs are scored too.
  const previewScore = (() => {
    const durNum = Number(duration);
    const distNum = distance.trim() === "" ? 0 : Number(distance);
    if (!Number.isFinite(durNum) || durNum <= 0) return null;
    const pet = pets.find((p) => p.petId === petId) ?? null;
    return computeWalkScore({
      distanceKm: Number.isFinite(distNum) ? distNum : 0,
      durationMin: durNum,
      pet,
      streakDays,
    });
  })();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <SafeAreaView edges={["bottom"]} style={styles.sheetWrap}>
          <Pressable style={styles.sheet}>
            <Text style={styles.title}>手動補登遛狗</Text>

            <Text style={styles.label}>寵物</Text>
            <View style={styles.petRow}>
              {pets.map((p) => {
                const selected = p.petId === petId;
                return (
                  <Pressable
                    key={p.petId}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setPetId(p.petId)}
                    style={[styles.petChip, selected && styles.petChipOn]}
                  >
                    <Text
                      style={[styles.petChipText, selected && styles.petChipTextOn]}
                    >
                      {p.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.fieldRow}>
              <View style={styles.field}>
                <Text style={styles.label}>時長（分鐘）</Text>
                <TextInput
                  style={styles.input}
                  value={duration}
                  onChangeText={setDuration}
                  keyboardType="number-pad"
                  placeholder="30"
                  placeholderTextColor={colors.ink3}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>距離（km，選填）</Text>
                <TextInput
                  style={styles.input}
                  value={distance}
                  onChangeText={setDistance}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.ink3}
                />
              </View>
            </View>

            <Text style={styles.label}>備註（選填）</Text>
            <TextInput
              style={[styles.input, styles.notes]}
              value={notes}
              onChangeText={setNotes}
              placeholder="今天走去公園…"
              placeholderTextColor={colors.ink3}
              multiline
              maxLength={300}
            />

            {previewScore !== null ? (
              <Text style={styles.score}>{`預估分數 +${previewScore}`}</Text>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.actions}>
              <Pressable
                onPress={onClose}
                disabled={saving}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelText}>取消</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={handleSave}
                disabled={saving}
                style={({ pressed }) => [
                  styles.saveBtn,
                  pressed && styles.pressed,
                  saving && styles.disabled,
                ]}
              >
                {saving ? (
                  <ActivityIndicator color={colors.card} />
                ) : (
                  <Text style={styles.saveText}>儲存</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheetWrap: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  sheet: { padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: 18, fontWeight: "800", color: colors.ink, marginBottom: spacing.xs },
  label: { fontSize: 12, fontWeight: "700", color: colors.ink2 },
  petRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  petChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  petChipOn: { backgroundColor: colors.brandTint, borderColor: colors.brand },
  petChipText: { fontSize: 14, fontWeight: "600", color: colors.ink2 },
  petChipTextOn: { color: colors.brandDeep, fontWeight: "800" },
  fieldRow: { flexDirection: "row", gap: spacing.md },
  field: { flex: 1, gap: 4 },
  input: {
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.ink,
  },
  notes: { minHeight: 64, textAlignVertical: "top" },
  score: { fontSize: 13, fontWeight: "700", color: colors.leaf },
  error: { fontSize: 13, color: colors.cookie },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "flex-end",
    marginTop: spacing.sm,
  },
  cancelBtn: {
    height: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontSize: 15, fontWeight: "600", color: colors.ink2 },
  saveBtn: {
    height: 48,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { fontSize: 15, fontWeight: "800", color: colors.card },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
});
