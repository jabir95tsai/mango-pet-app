/**
 * Health-record add form — polymorphic by type (weight / feeding / vaccine /
 * vet / medication). Builds the typed `data` payload + writes via the
 * health-write layer (createRecord); a weight record also syncs pet.weightKg.
 * Mirrors web's health form. Optional nested dates (vaccine nextDue, med
 * start/end) are deferred to a later polish pass; core fields per type ship now.
 */
import { useState } from "react";
import {
  type HealthRecordData,
  type HealthRecordType,
} from "@mango/shared-types";

import { createRecord } from "@/lib/health-write";
import { scoped } from "@/lib/i18n";
import { FormSheet, DateField, SelectField, TextField } from "./form-sheet";

const tH = scoped("Health");

const TYPES: HealthRecordType[] = [
  "weight",
  "feeding",
  "vaccine",
  "vet",
  "medication",
];

/** Drop undefined / empty values so Firestore never sees `undefined`. */
function defined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== ""),
  ) as T;
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
  const [clinic, setClinic] = useState("");
  const [doctor, setDoctor] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [prescription, setPrescription] = useState("");
  const [medName, setMedName] = useState("");
  const [frequency, setFrequency] = useState("");

  function buildData(): HealthRecordData | null {
    switch (type) {
      case "weight": {
        const v = parseFloat(kg);
        return Number.isFinite(v) && v > 0 ? { kg: v } : null;
      }
      case "feeding":
        return defined({
          brand: brand.trim(),
          amountG: amountG ? parseFloat(amountG) : undefined,
          foodType: foodType.trim(),
        }) as HealthRecordData;
      case "vaccine":
        return vaccineName.trim() ? { name: vaccineName.trim() } : null;
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
            }) as HealthRecordData)
          : null;
      default:
        return null;
    }
  }

  const data = buildData();
  const valid = data !== null;

  async function save() {
    if (!data) return;
    setSaving(true);
    try {
      await createRecord(petId, uid, {
        type,
        recordedAt,
        data,
        notes: notes.trim() || undefined,
      });
      onSaved();
      onClose();
    } catch {
      // surfaced via no-op; the form stays open for retry
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormSheet
      visible
      title={tH("addRecord")}
      onCancel={onClose}
      onSave={save}
      saving={saving}
      saveDisabled={!valid}
    >
      <SelectField
        label={tH("type")}
        value={type}
        onChange={setType}
        options={TYPES.map((t) => ({ value: t, label: tH(`types.${t}`) }))}
      />
      <DateField
        label={tH("fields.recordedAt")}
        value={recordedAt}
        onChange={setRecordedAt}
      />

      {type === "weight" ? (
        <TextField
          label={tH("fields.kg")}
          value={kg}
          onChangeText={setKg}
          keyboardType="decimal-pad"
          placeholder={tH("kgExample")}
          autoFocus
        />
      ) : null}

      {type === "feeding" ? (
        <>
          <TextField label={tH("fields.brand")} value={brand} onChangeText={setBrand} />
          <TextField
            label={tH("fields.amountG")}
            value={amountG}
            onChangeText={setAmountG}
            keyboardType="decimal-pad"
          />
          <TextField
            label={tH("fields.foodType")}
            value={foodType}
            onChangeText={setFoodType}
          />
        </>
      ) : null}

      {type === "vaccine" ? (
        <TextField
          label={tH("fields.vaccineName")}
          value={vaccineName}
          onChangeText={setVaccineName}
          autoFocus
        />
      ) : null}

      {type === "vet" ? (
        <>
          <TextField label={tH("fields.clinic")} value={clinic} onChangeText={setClinic} />
          <TextField label={tH("fields.doctor")} value={doctor} onChangeText={setDoctor} />
          <TextField
            label={tH("fields.diagnosis")}
            value={diagnosis}
            onChangeText={setDiagnosis}
          />
          <TextField
            label={tH("fields.prescription")}
            value={prescription}
            onChangeText={setPrescription}
          />
        </>
      ) : null}

      {type === "medication" ? (
        <>
          <TextField label={tH("fields.medName")} value={medName} onChangeText={setMedName} />
          <TextField
            label={tH("fields.frequency")}
            value={frequency}
            onChangeText={setFrequency}
          />
        </>
      ) : null}

      <TextField
        label={tH("fields.notes")}
        value={notes}
        onChangeText={setNotes}
        multiline
      />
    </FormSheet>
  );
}
