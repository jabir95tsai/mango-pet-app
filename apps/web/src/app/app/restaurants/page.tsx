"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Filter, Heart, MapPin, Plus } from "lucide-react";
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

const LEVEL_VALUES: LevelFilter[] = [
  "all",
  "indoor_ok",
  "outdoor_only",
  "restricted",
];

export default function RestaurantsPage() {
  const tNav = useTranslations("Nav");
  const tC = useTranslations("Common");
  const tR = useTranslations("Restaurant");
  const { user } = useAuth();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [origin, setOrigin] = useState(DEFAULT_LOCATION);
  const [originFromBrowser, setOriginFromBrowser] = useState<boolean | null>(null);
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
    getCurrentLocation().then((loc) => {
      setOrigin({ lat: loc.lat, lng: loc.lng });
      setOriginFromBrowser(loc.fromBrowser);
    });
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
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <RouteHeader
          title={tNav("restaurants")}
          subtitle={tR("subtitle")}
          className="mb-0"
        />
        <Button onClick={() => setAdding(true)} size="sm" className="w-full sm:w-auto">
          <Plus className="size-4" />
          {tR("add")}
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <Tabs<View>
          value={view}
          onChange={setView}
          options={[
            { value: "list", label: tR("view.list") },
            { value: "map", label: tR("view.map") },
          ]}
        />
        <button
          type="button"
          onClick={() => setFavOnly(!favOnly)}
          className={cn(
            "inline-flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
            favOnly
              ? "bg-red-100 text-red-600 dark:bg-red-950"
              : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:ring-zinc-800",
          )}
        >
          <Heart className={cn("size-3.5", favOnly && "fill-current")} />
          {favOnly ? tR("favOnly") : tR("all")}
        </button>
      </div>

      {originFromBrowser === false && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>{tR("geoWarning")}</span>
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 mb-4">
        <Filter className="size-3.5 text-zinc-400 shrink-0 self-center" />
        {LEVEL_VALUES.map((value) => {
          const active = levelFilter === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setLevelFilter(value)}
              aria-pressed={active}
              className={cn(
                "h-8 shrink-0 rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
                active
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                  : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800",
              )}
            >
              {tR(`level.${value}`)}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">{tC("loading")}</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={tR("empty.title")}
          description={favOnly ? tR("empty.favSubtitle") : tR("empty.subtitle")}
          action={
            !favOnly && (
              <Button onClick={() => setAdding(true)}>
                <Plus className="size-4" />
                {tR("addRestaurant")}
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
            className="h-96 w-full overflow-hidden rounded-lg border border-zinc-200/80 dark:border-zinc-800"
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
        <div className="grid gap-3 xl:grid-cols-2">
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
