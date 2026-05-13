"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Heart, MapPin, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { distanceKm } from "@/lib/firebase/restaurants";
import type { PetFriendlyLevel, Restaurant } from "@/lib/types";

type Props = {
  restaurant: Restaurant;
  origin?: { lat: number; lng: number };
  isFavorite: boolean;
  onToggleFavorite: () => void;
  selected?: boolean;
  onClick?: () => void;
};

const LEVEL_LABEL: Record<PetFriendlyLevel, string> = {
  indoor_ok: "可進室內",
  outdoor_only: "戶外座位",
  restricted: "限制條件",
};

const LEVEL_COLOR: Record<PetFriendlyLevel, string> = {
  indoor_ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  outdoor_only: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  restricted: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export function RestaurantCard({
  restaurant,
  origin,
  isFavorite,
  onToggleFavorite,
  selected,
  onClick,
}: Props) {
  const tCommon = useTranslations("Common");
  const dist = origin ? distanceKm(origin, restaurant.location) : null;

  return (
    <article
      onClick={onClick}
      className={cn(
        "rounded-2xl border bg-white p-4 dark:bg-zinc-950 transition-colors cursor-pointer",
        selected
          ? "border-amber-400 bg-amber-50/40 dark:bg-amber-500/5"
          : "border-amber-200/60 hover:border-amber-300 dark:border-zinc-800",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/app/restaurants/${restaurant.restaurantId}`}
          className="flex-1 min-w-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-semibold truncate">{restaurant.name}</h3>
            <span
              className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                LEVEL_COLOR[restaurant.petFriendlyLevel],
              )}
            >
              {LEVEL_LABEL[restaurant.petFriendlyLevel]}
            </span>
          </div>
          <p className="text-xs text-zinc-500 truncate mt-0.5 flex items-center gap-1">
            <MapPin className="size-3 shrink-0" />
            {restaurant.address}
          </p>
          <div className="flex gap-3 text-xs text-zinc-600 dark:text-zinc-400 mt-2 items-center">
            {restaurant.reviewCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <Star className="size-3 fill-amber-400 text-amber-400" />
                {restaurant.averageRating.toFixed(1)} ({restaurant.reviewCount})
              </span>
            )}
            {dist != null && <span>📍 {dist.toFixed(1)} km</span>}
            {restaurant.hasWaterBowl && <span>💧</span>}
            {restaurant.hasPetMenu && <span>🍽️</span>}
            {restaurant.allowsLargeDogs && <span>🐕‍🦺</span>}
          </div>
        </Link>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          aria-label={isFavorite ? tCommon("delete") : tCommon("add")}
          className={cn(
            "p-2 rounded-full transition-colors shrink-0",
            isFavorite
              ? "bg-red-100 text-red-600 dark:bg-red-950"
              : "hover:bg-zinc-100 text-zinc-400 hover:text-red-600 dark:hover:bg-zinc-800",
          )}
        >
          <Heart className={cn("size-4", isFavorite && "fill-current")} />
        </button>
      </div>
    </article>
  );
}
