/**
 * Manual walk log — 1:1 with apps/web/src/components/walks/manual-walk-dialog.tsx
 * on the shared Dialog (keyboard-safe bottom sheet, reduced motion):
 *
 *   Pet → Start / End (default now−1h / now; duration re-derived whenever the
 *   times change) → Distance (km) | Duration (min) → Notes → error →
 *   Cancel (ghost) / Save (primary mango button).
 *
 * Validation is web's: pet, distance > 0 and duration > 0 are required, and
 * the end must be after the start. NO GPS → createWalk with isManual: true and
 * no path; the score comes from @mango/shared-business like tracked walks.
 * iOS difference: the two time pickers stack (the inline spinner needs the
 * full width) instead of web's two-column grid.
 */
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { Pet } from "@mango/shared-types";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { DateField, SelectField } from "@/components/pets/form-sheet";
import { t } from "@/lib/i18n";
import { createWalk } from "@/lib/walks";
import { useAuth } from "@/state/auth-context";
import { colors, spacing } from "@/theme/theme";

type Props = {
  visible: boolean;
  pets: Pet[];
  streakDays: number;
  familyId: string | null;
  /** Pre-selected pet (the walks home's active pet). */
  defaultPetId?: string | null;
  onClose: () => void;
  onSaved: () => void;
};

/** Minute precision, like web's datetime-local input. */
function toMinute(d: Date): Date {
  const out = new Date(d);
  out.setSeconds(0, 0);
  return out;
}

function parseNumber(v: string): number {
  return Number(v.trim().replace(/,/g, "."));
}

export function ManualWalkDialog({
  visible,
  pets,
  streakDays,
  familyId,
  defaultPetId,
  onClose,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const [petId, setPetId] = useState("");
  const [startedAt, setStartedAt] = useState(() => toMinute(new Date(Date.now() - 3_600_000)));
  const [endedAt, setEndedAt] = useState(() => toMinute(new Date()));
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("60");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const end = toMinute(new Date());
    const start = new Date(end.getTime() - 3_600_000);
    const fallback = pets[0]?.petId ?? "";
    setPetId(defaultPetId && pets.some((p) => p.petId === defaultPetId) ? defaultPetId : fallback);
    setStartedAt(start);
    setEndedAt(end);
    setDistance("");
    setDuration(String(Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000))));
    setNotes("");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Web: re-compute the duration whenever the user changes start / end.
  function changeTimes(start: Date, end: Date) {
    setStartedAt(start);
    setEndedAt(end);
    const ms = end.getTime() - start.getTime();
    if (ms > 0) setDuration(String(Math.round(ms / 60_000)));
  }

  async function handleSave() {
    if (saving || !user) return;
    const distNum = parseNumber(distance);
    const durNum = parseNumber(duration);
    if (!petId || !Number.isFinite(distNum) || distNum <= 0 || !Number.isFinite(durNum) || durNum <= 0) {
      setError(t("Walks.manual.errRequired"));
      return;
    }
    if (endedAt.getTime() <= startedAt.getTime()) {
      setError(t("Walks.manual.errEndAfterStart"));
      return;
    }

    const pet = pets.find((p) => p.petId === petId) ?? null;
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
      if (__DEV__) console.warn("[manual-walk] save failed", err);
      setError(t("Walks.core.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const now = new Date();

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title={t("Walks.manual.title")}
      dismissible={!saving}
      footer={
        <View style={styles.actions}>
          <Button label={t("Common.cancel")} variant="ghost" onPress={onClose} disabled={saving} />
          <Button label={t("Common.save")} onPress={handleSave} loading={saving} disabled={saving} />
        </View>
      }
    >
      {pets.length > 0 ? (
        <SelectField
          label={t("Walks.manual.pet")}
          value={petId}
          onChange={setPetId}
          options={pets.map((p) => ({ value: p.petId, label: p.name }))}
        />
      ) : (
        <Field label={t("Walks.manual.pet")} hint={t("Walks.manual.noPet")}>
          {null}
        </Field>
      )}

      <DateField
        label={t("Walks.manual.start")}
        value={startedAt}
        mode="datetime"
        maximumDate={now}
        onChange={(d) => changeTimes(toMinute(d), endedAt)}
      />
      <DateField
        label={t("Walks.manual.end")}
        value={endedAt}
        mode="datetime"
        maximumDate={now}
        onChange={(d) => changeTimes(startedAt, toMinute(d))}
      />

      <View style={styles.row}>
        <Field label={t("Walks.manual.distance")} style={styles.col}>
          <Input
            value={distance}
            onChangeText={setDistance}
            keyboardType="decimal-pad"
            placeholder="0.00"
            accessibilityLabel={t("Walks.manual.distance")}
          />
        </Field>
        <Field label={t("Walks.manual.duration")} style={styles.col}>
          <Input
            value={duration}
            onChangeText={setDuration}
            keyboardType="number-pad"
            accessibilityLabel={t("Walks.manual.duration")}
          />
        </Field>
      </View>

      <Field label={t("Walks.manual.notes")}>
        <Textarea
          value={notes}
          onChangeText={setNotes}
          maxLength={500}
          accessibilityLabel={t("Walks.manual.notes")}
        />
      </Field>

      {error ? (
        <Field style={styles.errorWrap} error={error}>
          {null}
        </Field>
      ) : null}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.md },
  col: { flex: 1 },
  errorWrap: { marginTop: -spacing.xs },
  // web: flex justify-end gap-2
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    borderTopWidth: 0,
    backgroundColor: colors.card,
  },
});
