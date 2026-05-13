"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Filter, Heart, MapIcon, MapPin, Plus } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { RouteHeader } from "@/components/nav/route-header";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { RestaurantMap } from "@/components/restaurants/restaurant-map";
import { RestaurantCard } from "@/components/restaurants/restaurant-card";
import { AddRestaurantDialog } from "@/components/restaurants/add-restaurant-dialog";
import {
  createRestaurant,
  distanceKm,
  listFavoriteIds,
  listRestaurants,
  toggleFavorite,
} from "@/lib/firebase/restaurants";
import { getCurrentLocation, DEFAULT_LOCATION } from "@/lib/maps";
import { cn } from "@/lib/utils";
import type { PetFriendlyLevel, Restaurant, RestaurantInput } from "@/lib/types";

type View = "list" | "map";
type LevelFilter = PetFriendlyLevel | "all";

const LEVELS: { value: LevelFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "indoor_ok", label: "可進室內" },
  { value: "outdoor_only", label: "戶外" },
  { value: "restricted", label: "限制" },
];

export default function RestaurantsPage() {
  const tNav = useTranslations("Nav");
  const tC = useTranslations("Common");
  const { user } = useAuth();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [origin, setOrigin] = useState(DEFAULT_LOCATION);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("list");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [favOnly, setFavOnly] = useState(false);
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [list, favs] = await Promise.all([
        listRestaurants(),
        listFavoriteIds(user.uid),
      ]);
      setRestaurants(list);
      setFavorites(favs);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
    getCurrentLocation().then((loc) =>
      setOrigin({ lat: loc.lat, lng: loc.lng }),
    );
  }, [refresh]);

  const filtered = useMemo(() => {
    let out = [...restaurants];
    if (levelFilter !== "all")
      out = out.filter((r) => r.petFriendlyLevel === levelFilter);
    if (favOnly) out = out.filter((r) => favorites.has(r.restaurantId));
    out.sort(
      (a, b) => distanceKm(origin, a.location) - distanceKm(origin, b.location),
    );
    return out;
  }, [restaurants, levelFilter, favOnly, favorites, origin]);

  async function handleAdd(input: RestaurantInput) {
    if (!user) return;
    await createRestaurant(user.uid, input);
    await refresh();
  }

  async function handleToggleFav(restaurantId: string) {
    if (!user) return;
    const isFav = favorites.has(restaurantId);
    const next = new Set(favorites);
    if (isFav) next.delete(restaurantId);
    else next.add(restaurantId);
    setFavorites(next);
    try {
      await toggleFavorite(user.uid, restaurantId, isFav);
    } catch {
      setFavorites(favorites); // rollback
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <RouteHeader title={tNav("restaurants")} subtitle="寵物友善餐廳地圖" />
        <Button onClick={() => setAdding(true)} size="sm">
          <Plus className="size-4" />
          新增
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <Tabs<View>
          value={view}
          onChange={setView}
          options={[
            { value: "list", label: "清單" },
            { value: "map", label: "地圖" },
          ]}
        />
        <button
          type="button"
          onClick={() => setFavOnly(!favOnly)}
          className={cn(
            "h-8 px-3 rounded-full text-xs font-medium inline-flex items-center gap-1 transition-colors",
            favOnly
              ? "bg-red-100 text-red-600 dark:bg-red-950"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800",
          )}
        >
          <Heart className={cn("size-3.5", favOnly && "fill-current")} />
          {favOnly ? "只看收藏" : "全部"}
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 mb-4">
        <Filter className="size-3.5 text-zinc-400 shrink-0 self-center" />
        {LEVELS.map((l) => {
          const active = levelFilter === l.value;
          return (
            <button
              key={l.value}
              type="button"
              onClick={() => setLevelFilter(l.value)}
              className={cn(
                "shrink-0 px-3 h-7 rounded-full text-xs font-medium transition-colors",
                active
                  ? "bg-amber-500 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400",
              )}
            >
              {l.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">{tC("loading")}</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="尚無餐廳"
          description={
            favOnly
              ? "你還沒有收藏任何餐廳。"
              : "新增第一筆寵物友善餐廳，或調整篩選條件。"
          }
          action={
            !favOnly && (
              <Button onClick={() => setAdding(true)}>
                <Plus className="size-4" />
                新增餐廳
              </Button>
            )
          }
        />
      ) : view === "map" ? (
        <div className="flex flex-col gap-3">
          <RestaurantMap
            restaurants={filtered}
            center={origin}
            selectedId={selectedId}
            onSelect={setSelectedId}
            className="h-96 w-full rounded-2xl overflow-hidden border border-amber-200/60 dark:border-zinc-800"
          />
          {selectedId &&
            (() => {
              const selected = filtered.find(
                (r) => r.restaurantId === selectedId,
              );
              return selected ? (
                <RestaurantCard
                  restaurant={selected}
                  origin={origin}
                  isFavorite={favorites.has(selected.restaurantId)}
                  onToggleFavorite={() => handleToggleFav(selected.restaurantId)}
                  selected
                />
              ) : null;
            })()}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((r) => (
            <RestaurantCard
              key={r.restaurantId}
              restaurant={r}
              origin={origin}
              isFavorite={favorites.has(r.restaurantId)}
              onToggleFavorite={() => handleToggleFav(r.restaurantId)}
              onClick={() => setSelectedId(r.restaurantId)}
              selected={selectedId === r.restaurantId}
            />
          ))}
        </div>
      )}

      <AddRestaurantDialog
        open={adding}
        onClose={() => setAdding(false)}
        onSubmit={handleAdd}
      />
    </>
  );
}
