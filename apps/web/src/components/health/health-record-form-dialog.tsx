"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Timestamp } from "firebase/firestore";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, FieldLabel } from "@/components/ui/select";
import {
  fromLocalDateInput,
  todayLocalISO,
  toLocalDateInput,
} from "@/lib/dates";
import type {
  HealthRecordData,
  HealthRecordInput,
  HealthRecordType,
} from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: HealthRecordInput) => Promise<void>;
};

const TYPES: HealthRecordType[] = ["weight", "feeding", "vaccine", "vet", "medication"];

function emptyDataFor(type: HealthRecordType): HealthRecordData {
  switch (type) {
    case "weight":
      return {} as { kg: number };
    case "feeding":
      return {};
    case "vaccine":
      return { name: "" };
    case "vet":
      return { clinic: "", diagnosis: "" };
    case "medication":
      return { name: "" };
  }
}

export function HealthRecordFormDialog({ open, onClose, onSubmit }: Props) {
  const tH = useTranslations("Health");
  const tC = useTranslations("Common");

  const [type, setType] = useState<HealthRecordType>("weight");
  const [recordedAt, setRecordedAt] = useState(todayLocalISO());
  const [notes, setNotes] = useState("");
  const [data, setData] = useState<HealthRecordData>(emptyDataFor("weight"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setType("weight");
      setRecordedAt(todayLocalISO());
      setNotes("");
      setData(emptyDataFor("weight"));
      setError(null);
    }
  }, [open]);

  function switchType(next: HealthRecordType) {
    setType(next);
    setData(emptyDataFor(next));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Type-specific validation
    if (type === "weight") {
      const kg = (data as { kg?: number }).kg;
      if (!kg || kg <= 0) {
        setError(tH("weightPositive"));
        return;
      }
    } else if (type === "vaccine") {
      const name = (data as { name?: string }).name;
      if (!name?.trim()) {
        setError(tH("fields.vaccineName"));
        return;
      }
    } else if (type === "vet") {
      const d = data as { clinic?: string; diagnosis?: string };
      if (!d.clinic?.trim() || !d.diagnosis?.trim()) {
        setError(tH("fields.clinic"));
        return;
      }
    } else if (type === "medication") {
      const name = (data as { name?: string }).name;
      if (!name?.trim()) {
        setError(tH("fields.medName"));
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        type,
        recordedAt: fromLocalDateInput(recordedAt),
        data,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={tH("addRecord")}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <FieldLabel>{tH("type")}</FieldLabel>
          <Select
            value={type}
            onChange={(e) => switchType(e.target.value as HealthRecordType)}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {tH(`types.${t}`)}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <FieldLabel>{tH("fields.recordedAt")}</FieldLabel>
          <Input
            type="date"
            value={recordedAt}
            onChange={(e) => setRecordedAt(e.target.value)}
            required
          />
        </div>

        <TypeFields type={type} data={data} setData={setData} tH={tH} />

        <div className="flex flex-col gap-1">
          <FieldLabel>{tH("fields.notes")}</FieldLabel>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {tC("cancel")}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "..." : tC("save")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

type FieldsProps = {
  type: HealthRecordType;
  data: HealthRecordData;
  setData: (d: HealthRecordData) => void;
  tH: (key: string) => string;
};

function TypeFields({ type, data, setData, tH }: FieldsProps) {
  switch (type) {
    case "weight":
      return (
        <div className="flex flex-col gap-1">
          <FieldLabel>{tH("fields.kg")}</FieldLabel>
          <Input
            type="number"
            step="0.1"
            min="0.1"
            value={(data as { kg?: number }).kg || ""}
            onChange={(e) => setData({ kg: Number(e.target.value) })}
            placeholder="例如 8.5"
            required
          />
        </div>
      );

    case "feeding": {
      const d = data as { brand?: string; amountG?: number; foodType?: string };
      return (
        <>
          <div className="flex flex-col gap-1">
            <FieldLabel>{tH("fields.brand")}</FieldLabel>
            <Input
              value={d.brand ?? ""}
              onChange={(e) => setData({ ...d, brand: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <FieldLabel>{tH("fields.amountG")}</FieldLabel>
              <Input
                type="number"
                value={d.amountG ?? ""}
                onChange={(e) =>
                  setData({ ...d, amountG: Number(e.target.value) || undefined })
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <FieldLabel>{tH("fields.foodType")}</FieldLabel>
              <Input
                value={d.foodType ?? ""}
                onChange={(e) => setData({ ...d, foodType: e.target.value })}
              />
            </div>
          </div>
        </>
      );
    }

    case "vaccine": {
      const d = data as { name: string; nextDueAt?: Timestamp };
      const nextDue = d.nextDueAt
        ? new Date(d.nextDueAt.toMillis()).toISOString().slice(0, 10)
        : "";
      return (
        <>
          <div className="flex flex-col gap-1">
            <FieldLabel>{tH("fields.vaccineName")}</FieldLabel>
            <Input
              value={d.name}
              onChange={(e) => setData({ ...d, name: e.target.value })}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>{tH("fields.nextDue")}</FieldLabel>
            <Input
              type="date"
              value={nextDue}
              onChange={(e) =>
                setData({
                  ...d,
                  nextDueAt: e.target.value
                    ? Timestamp.fromDate(new Date(e.target.value))
                    : undefined,
                })
              }
            />
          </div>
        </>
      );
    }

    case "vet": {
      const d = data as {
        clinic: string;
        doctor?: string;
        diagnosis: string;
        prescription?: string;
      };
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <FieldLabel>{tH("fields.clinic")}</FieldLabel>
              <Input
                value={d.clinic}
                onChange={(e) => setData({ ...d, clinic: e.target.value })}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <FieldLabel>{tH("fields.doctor")}</FieldLabel>
              <Input
                value={d.doctor ?? ""}
                onChange={(e) => setData({ ...d, doctor: e.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>{tH("fields.diagnosis")}</FieldLabel>
            <Input
              value={d.diagnosis}
              onChange={(e) => setData({ ...d, diagnosis: e.target.value })}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>{tH("fields.prescription")}</FieldLabel>
            <Textarea
              value={d.prescription ?? ""}
              onChange={(e) => setData({ ...d, prescription: e.target.value })}
            />
          </div>
        </>
      );
    }

    case "medication": {
      const d = data as {
        name: string;
        frequency?: string;
        startsAt?: Timestamp;
        endsAt?: Timestamp;
      };
      const starts = d.startsAt
        ? new Date(d.startsAt.toMillis()).toISOString().slice(0, 10)
        : "";
      const ends = d.endsAt
        ? new Date(d.endsAt.toMillis()).toISOString().slice(0, 10)
        : "";
      return (
        <>
          <div className="flex flex-col gap-1">
            <FieldLabel>{tH("fields.medName")}</FieldLabel>
            <Input
              value={d.name}
              onChange={(e) => setData({ ...d, name: e.target.value })}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>{tH("fields.frequency")}</FieldLabel>
            <Input
              value={d.frequency ?? ""}
              onChange={(e) => setData({ ...d, frequency: e.target.value })}
              placeholder="1 tab / 12hr"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <FieldLabel>{tH("fields.startsAt")}</FieldLabel>
              <Input
                type="date"
                value={starts}
                onChange={(e) =>
                  setData({
                    ...d,
                    startsAt: e.target.value
                      ? Timestamp.fromDate(new Date(e.target.value))
                      : undefined,
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <FieldLabel>{tH("fields.endsAt")}</FieldLabel>
              <Input
                type="date"
                value={ends}
                onChange={(e) =>
                  setData({
                    ...d,
                    endsAt: e.target.value
                      ? Timestamp.fromDate(new Date(e.target.value))
                      : undefined,
                  })
                }
              />
            </div>
          </div>
        </>
      );
    }
  }
}
