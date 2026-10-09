/**
 * Health-record add form — 1:1 with apps/web/src/components/health/
 * health-record-form-dialog.tsx, polymorphic by type:
 *  - weight     kg (> 0)
 *  - feeding    brand, amount (g), food type
 *  - vaccine    name + optional next-due date (data.nextDueAt)
 *  - vet        clinic + doctor, diagnosis, prescription
 *  - medication name, frequency, optional start / end dates
 *    (data.startsAt / data.endsAt)
 * then notes. Dates are stored as Timestamps of the picked local day (web's
 * date inputs); empty optionals are omitted (Firestore rules: data keys are
 * whitelisted per type, optional dates must be timestamps).
 *
 * Writes via health-write createRecord (a weight record also syncs
 * pet.weightKg, like web). A failed save is surfaced (alertError) and the sheet
 * stays open for a retry.
 */
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Plus, X } from "lucide-react-native";
import type { HealthRecordData, HealthRecordType } from "@mango/shared-types";

import { Button, Field, Input, Textarea } from "@/components/ui";
import { alertError } from "@/lib/confirm";
import { createRecord } from "@/lib/health-write";
import { t } from "@/lib/i18n";
import { tsFromDate } from "@/lib/write-utils";
import { DateField, FormSheet, SelectField } from "./form-sheet";

const TYPES: HealthRecordType[] = ["weight", "feeding", "vaccine", "vet", "medication"];

/** Drop undefined / empty values so Firestore never sees `undefined`. */
function defined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== ""),
  ) as T;
}

/** Local midnight of the picked day (web fromLocalDateInput / date inputs). */
function dayOf(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseNum(raw: string): number {
  return Number(raw.replace(/,/g, "").trim());
}

/**
 * Optional date (web: an empty `<input type="date">`). Unset → a "+ label"
 * chip (pet-form birthday pattern); set → the date field + a clear button.
 */
function OptionalDateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date | null;
  onChange: (d: Date | null) => void;
}) {
  if (!value) {
    return (
      <Button
        label={label}
        variant="secondary"
        size="sm"
        pill
        icon={Plus}
        onPress={() => onChange(new Date())}
        style={styles.addDate}
      />
    );
  }
  return (
    <View>
      <DateField label={label} value={value} onChange={onChange} />
      <Button
        label={t("Common.delete")}
        variant="ghost"
        size="sm"
        icon={X}
        onPress={() => onChange(null)}
        accessibilityLabel={`${t("Common.delete")} ${label}`}
        style={styles.clearDate}
      />
    </View>
  );
}

export function HealthForm({
  petId,
  uid,
  onClose,
  onSaved,
}: {
  petId: string;
  uid: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<HealthRecordType>("weight");
  const [recordedAt, setRecordedAt] = useState<Date>(new Date());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Per-type fields (flat; only the active type's fields are read at save).
  const [kg, setKg] = useState("");
  const [brand, setBrand] = useState("");
  const [amountG, setAmountG] = useState("");
  const [foodType, setFoodType] = useState("");
  const [vaccineName, setVaccineName] = useState("");
  const [nextDue, setNextDue] = useState<Date | null>(null);
  const [clinic, setClinic] = useState("");
  const [doctor, setDoctor] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [prescription, setPrescription] = useState("");
  const [medName, setMedName] = useState("");
  const [frequency, setFrequency] = useState("");
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [endsAt, setEndsAt] = useState<Date | null>(null);

  const kgNum = parseNum(kg);
  const kgInvalid = kg.trim() !== "" && !(Number.isFinite(kgNum) && kgNum > 0);

  function buildData(): HealthRecordData | null {
    switch (type) {
      case "weight":
        return Number.isFinite(kgNum) && kgNum > 0 ? { kg: kgNum } : null;
      case "feeding": {
        const g = parseNum(amountG);
        return defined({
          brand: brand.trim(),
          amountG: amountG.trim() && Number.isFinite(g) && g > 0 ? g : undefined,
          foodType: foodType.trim(),
        }) as HealthRecordData;
      }
      case "vaccine":
        return vaccineName.trim()
          ? (defined({
              name: vaccineName.trim(),
              nextDueAt: nextDue ? tsFromDate(dayOf(nextDue)) : undefined,
            }) as unknown as HealthRecordData)
          : null;
      case "vet":
        return clinic.trim() && diagnosis.trim()
          ? (defined({
              clinic: clinic.trim(),
              doctor: doctor.trim(),
              diagnosis: diagnosis.trim(),
              prescription: prescription.trim(),
            }) as HealthRecordData)
          : null;
      case "medication":
        return medName.trim()
          ? (defined({
              name: medName.trim(),
              frequency: frequency.trim(),
              startsAt: startsAt ? tsFromDate(dayOf(startsAt)) : undefined,
              endsAt: endsAt ? tsFromDate(dayOf(endsAt)) : undefined,
            }) as unknown as HealthRecordData)
          : null;
      default:
        return null;
    }
  }

  const data = buildData();
  const valid = data !== null;

  async function save() {
    if (!data || saving) return;
    setSaving(true);
    try {
      await createRecord(petId, uid, {
        type,
        recordedAt: dayOf(recordedAt),
        data,
        notes: notes.trim() || undefined,
      });
      onSaved();
      onClose();
    } catch (e) {
      alertError(e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormSheet
      visible
      title={t("Health.addRecord")}
      onCancel={onClose}
      onSave={save}
      saving={saving}
      saveDisabled={!valid}
    >
      <SelectField
        label={t("Health.type")}
        value={type}
        onChange={setType}
        options={TYPES.map((v) => ({ value: v, label: t(`Health.types.${v}`) }))}
      />
      <DateField
        label={t("Health.fields.recordedAt")}
        value={recordedAt}
        onChange={setRecordedAt}
      />

      {type === "weight" ? (
        <Field label={t("Health.fields.kg")}>
          <Input
            value={kg}
            onChangeText={setKg}
            keyboardType="decimal-pad"
            placeholder={t("Health.kgExample")}
            accessibilityLabel={t("Health.fields.kg")}
            error={kgInvalid ? t("Health.weightPositive") : null}
            autoFocus
          />
        </Field>
      ) : null}

      {type === "feeding" ? (
        <>
          <Field label={t("Health.fields.brand")}>
            <Input
              value={brand}
              onChangeText={setBrand}
              accessibilityLabel={t("Health.fields.brand")}
            />
          </Field>
          <View style={styles.row}>
            <Field label={t("Health.fields.amountG")} style={styles.col}>
              <Input
                value={amountG}
                onChangeText={setAmountG}
                keyboardType="decimal-pad"
                accessibilityLabel={t("Health.fields.amountG")}
              />
            </Field>
            <Field label={t("Health.fields.foodType")} style={styles.col}>
              <Input
                value={foodType}
                onChangeText={setFoodType}
                accessibilityLabel={t("Health.fields.foodType")}
              />
            </Field>
          </View>
        </>
      ) : null}

      {type === "vaccine" ? (
        <>
          <Field label={t("Health.fields.vaccineName")}>
            <Input
              value={vaccineName}
              onChangeText={setVaccineName}
              accessibilityLabel={t("Health.fields.vaccineName")}
              autoFocus
            />
          </Field>
          <OptionalDateField
            label={t("Health.fields.nextDue")}
            value={nextDue}
            onChange={setNextDue}
          />
        </>
      ) : null}

      {type === "vet" ? (
        <>
          <View style={styles.row}>
            <Field label={t("Health.fields.clinic")} style={styles.col}>
              <Input
                value={clinic}
                onChangeText={setClinic}
                accessibilityLabel={t("Health.fields.clinic")}
              />
            </Field>
            <Field label={t("Health.fields.doctor")} style={styles.col}>
              <Input
                value={doctor}
                onChangeText={setDoctor}
                accessibilityLabel={t("Health.fields.doctor")}
              />
            </Field>
          </View>
          <Field label={t("Health.fields.diagnosis")}>
            <Input
              value={diagnosis}
              onChangeText={setDiagnosis}
              accessibilityLabel={t("Health.fields.diagnosis")}
            />
          </Field>
          <Field label={t("Health.fields.prescription")}>
            <Textarea
              value={prescription}
              onChangeText={setPrescription}
              accessibilityLabel={t("Health.fields.prescription")}
            />
          </Field>
        </>
      ) : null}

      {type === "medication" ? (
        <>
          <Field label={t("Health.fields.medName")}>
            <Input
              value={medName}
              onChangeText={setMedName}
              accessibilityLabel={t("Health.fields.medName")}
            />
          </Field>
          <Field label={t("Health.fields.frequency")}>
            <Input
              value={frequency}
              onChangeText={setFrequency}
              placeholder="1 tab / 12hr"
              accessibilityLabel={t("Health.fields.frequency")}
            />
          </Field>
          <OptionalDateField
            label={t("Health.fields.startsAt")}
            value={startsAt}
            onChange={setStartsAt}
          />
          <OptionalDateField
            label={t("Health.fields.endsAt")}
            value={endsAt}
            onChange={setEndsAt}
          />
        </>
      ) : null}

      <Field label={t("Health.fields.notes")}>
        <Textarea
          value={notes}
          onChangeText={setNotes}
          accessibilityLabel={t("Health.fields.notes")}
        />
      </Field>
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  // web grid grid-cols-2 gap-3
  row: { flexDirection: "row", gap: 12 },
  col: { flex: 1, minWidth: 0 },
  addDate: { alignSelf: "flex-start" },
  clearDate: { alignSelf: "flex-end", marginTop: 2 },
});
