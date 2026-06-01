"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { MapPin } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, FieldLabel } from "@/components/ui/select";
import { getCurrentLocation } from "@/lib/maps";
import type { PetFriendlyLevel, RestaurantInput } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: RestaurantInput) => Promise<void>;
};

export function AddRestaurantDialog({ open, onClose, onSubmit }: Props) {
  const tC = useTranslations("Common");
  const tR = useTranslations("Restaurant");

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [level, setLevel] = useState<PetFriendlyLevel>("indoor_ok");
  const [hasWater, setHasWater] = useState(false);
  const [hasMenu, setHasMenu] = useState(false);
  const [largeOk, setLargeOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setAddress("");
    setLat("");
    setLng("");
    setPhone("");
    setWebsite("");
    setLevel("indoor_ok");
    setHasWater(false);
    setHasMenu(false);
    setLargeOk(false);
    setError(null);
  }, [open]);

  async function useCurrentLocation() {
    const loc = await getCurrentLocation();
    setLat(loc.lat.toFixed(6));
    setLng(loc.lng.toFixed(6));
    if (!loc.fromBrowser) setError(tR("locationError"));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!name.trim() || !address.trim() || Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      setError(`${tR("fields.name")} / ${tR("fields.address")} / ${tR("fields.latitude")} / ${tR("fields.longitude")}`);
      return;
    }
    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      setError(`${tR("fields.latitude")} / ${tR("fields.longitude")}`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        address: address.trim(),
        location: { lat: latNum, lng: lngNum },
        phone: phone.trim() || undefined,
        website: website.trim() || undefined,
        petFriendlyLevel: level,
        hasWaterBowl: hasWater || undefined,
        hasPetMenu: hasMenu || undefined,
        allowsLargeDogs: largeOk || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={tR("addRestaurant")}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <FieldLabel>{tR("fields.name")}</FieldLabel>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tR("namePlaceholder")}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <FieldLabel>{tR("fields.address")}</FieldLabel>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={tR("addressPlaceholder")}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <FieldLabel>{tR("fields.latitude")}</FieldLabel>
            <Input
              type="number"
              step="0.000001"
              min="-90"
              max="90"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="25.0339"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>{tR("fields.longitude")}</FieldLabel>
            <Input
              type="number"
              step="0.000001"
              min="-180"
              max="180"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="121.5644"
              required
            />
          </div>
        </div>

        <Button type="button" variant="ghost" size="sm" onClick={useCurrentLocation}>
          <MapPin className="size-4" />
          {tR("fields.useCurrentLocation")}
        </Button>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <FieldLabel>{tR("fields.petLevel")}</FieldLabel>
            <Select
              value={level}
              onChange={(e) => setLevel(e.target.value as PetFriendlyLevel)}
            >
              <option value="indoor_ok">{tR("level.indoor_ok")}</option>
              <option value="outdoor_only">{tR("level.outdoor_only")}</option>
              <option value="restricted">{tR("level.restricted")}</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>{tR("fields.phone")}</FieldLabel>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="02-XXX-XXXX"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <FieldLabel>{tR("fields.website")}</FieldLabel>
          <Input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://..."
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Toggle
            on={hasWater}
            onChange={setHasWater}
            label={tR("fields.waterBowl")}
          />
          <Toggle
            on={hasMenu}
            onChange={setHasMenu}
            label={tR("fields.petMenu")}
          />
          <Toggle
            on={largeOk}
            onChange={setLargeOk}
            label={tR("fields.largeDogsOk")}
          />
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

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className={`px-3 h-8 rounded-full text-xs font-medium transition-colors ${
        on
          ? "bg-amber-500 text-white"
          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
      }`}
    >
      {label}
    </button>
  );
}
