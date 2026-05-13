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
    if (!loc.fromBrowser) setError("無法取得 GPS，已填入預設座標 (台北 101)");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!name.trim() || !address.trim() || Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      setError("名稱、地址、座標必填");
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
    <Dialog open={open} onClose={onClose} title="新增餐廳">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <FieldLabel>名稱</FieldLabel>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="芒果咖啡"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <FieldLabel>地址</FieldLabel>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="台北市信義區⋯"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <FieldLabel>緯度 (lat)</FieldLabel>
            <Input
              type="number"
              step="0.000001"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="25.0339"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>經度 (lng)</FieldLabel>
            <Input
              type="number"
              step="0.000001"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="121.5644"
              required
            />
          </div>
        </div>

        <Button type="button" variant="ghost" size="sm" onClick={useCurrentLocation}>
          <MapPin className="size-4" />
          使用我目前位置
        </Button>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <FieldLabel>寵物友善程度</FieldLabel>
            <Select
              value={level}
              onChange={(e) => setLevel(e.target.value as PetFriendlyLevel)}
            >
              <option value="indoor_ok">可進室內</option>
              <option value="outdoor_only">僅戶外座位</option>
              <option value="restricted">限制條件</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>電話 (選填)</FieldLabel>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="02-XXX-XXXX"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <FieldLabel>網站 (選填)</FieldLabel>
          <Input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://..."
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Toggle on={hasWater} onChange={setHasWater} label="💧 提供水碗" />
          <Toggle on={hasMenu} onChange={setHasMenu} label="🍽️ 寵物餐點" />
          <Toggle on={largeOk} onChange={setLargeOk} label="🐕‍🦺 大型犬 OK" />
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
      className={`px-3 h-8 rounded-full text-xs font-medium transition-colors ${
        on
          ? "bg-amber-500 text-white"
          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
      }`}
    >
      {label}
    </button>
  );
}
