"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  ExternalLink,
  Heart,
  MapPin,
  Phone,
  Plus,
  Star,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RestaurantMap } from "@/components/restaurants/restaurant-map";
import { ReviewCard } from "@/components/restaurants/review-card";
import { ReviewFormDialog } from "@/components/restaurants/review-form-dialog";
import {
  addReview,
  deleteReview,
  getRestaurant,
  listFavoriteIds,
  listReviews,
  toggleFavorite,
} from "@/lib/firebase/restaurants";
import { cn } from "@/lib/utils";
import type {
  PetFriendlyLevel,
  Restaurant,
  RestaurantReview,
  RestaurantReviewInput,
} from "@/lib/types";

const LEVEL_LABEL: Record<PetFriendlyLevel, string> = {
  indoor_ok: "可進室內",
  outdoor_only: "僅戶外座位",
  restricted: "限制條件",
};

export default function RestaurantDetailPage() {
  const router = useRouter();
  const params = useParams<{ restaurantId: string }>();
  const restaurantId = params.restaurantId;
  const { user } = useAuth();
  const tC = useTranslations("Common");

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [reviews, setReviews] = useState<RestaurantReview[]>([]);
  const [isFav, setIsFav] = useState(false);
  const [loading, setLoading] = useState(true);
  const [writing, setWriting] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [r, rs, favs] = await Promise.all([
        getRestaurant(restaurantId),
        listReviews(restaurantId),
        listFavoriteIds(user.uid),
      ]);
      setRestaurant(r);
      setReviews(rs);
      setIsFav(favs.has(restaurantId));
    } finally {
      setLoading(false);
    }
  }, [user, restaurantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleToggleFav() {
    if (!user) return;
    const next = !isFav;
    setIsFav(next);
    try {
      await toggleFavorite(user.uid, restaurantId, isFav);
    } catch {
      setIsFav(!next);
    }
  }

  async function handleAddReview(input: RestaurantReviewInput) {
    if (!user) return;
    await addReview({
      ...input,
      restaurantId,
      authorUid: user.uid,
      authorName: user.displayName ?? "Friend",
      authorPhotoURL: user.photoURL,
    });
    await refresh();
  }

  async function handleDeleteReview(review: RestaurantReview) {
    if (!confirm(`${tC("delete")}?`)) return;
    await deleteReview(restaurantId, review.reviewId, review.rating);
    await refresh();
  }

  if (loading) return <p className="text-sm text-zinc-500">{tC("loading")}</p>;

  if (!restaurant) {
    return (
      <EmptyState
        icon={MapPin}
        title="找不到餐廳"
        action={
          <Button variant="secondary" onClick={() => router.push("/app/restaurants")}>
            <ArrowLeft className="size-4" />
            {tC("back")}
          </Button>
        }
      />
    );
  }

  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${restaurant.location.lat},${restaurant.location.lng}&query_place_id=${restaurant.googlePlaceId ?? ""}`;

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => router.push("/app/restaurants")}
          aria-label={tC("back")}
          className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <ArrowLeft className="size-5" />
        </button>
      </div>

      <header className="rounded-2xl border border-amber-200/60 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold tracking-tight">{restaurant.name}</h1>
            <p className="text-sm text-zinc-500 mt-1 flex items-center gap-1">
              <MapPin className="size-3.5" />
              {restaurant.address}
            </p>
            <div className="flex flex-wrap gap-2 mt-3 text-xs">
              <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full dark:bg-amber-900/40 dark:text-amber-200">
                {LEVEL_LABEL[restaurant.petFriendlyLevel]}
              </span>
              {restaurant.hasWaterBowl && (
                <span className="bg-zinc-100 px-2 py-0.5 rounded-full dark:bg-zinc-800">
                  💧 水碗
                </span>
              )}
              {restaurant.hasPetMenu && (
                <span className="bg-zinc-100 px-2 py-0.5 rounded-full dark:bg-zinc-800">
                  🍽️ 寵物餐
                </span>
              )}
              {restaurant.allowsLargeDogs && (
                <span className="bg-zinc-100 px-2 py-0.5 rounded-full dark:bg-zinc-800">
                  🐕‍🦺 大型犬 OK
                </span>
              )}
            </div>
            {restaurant.reviewCount > 0 && (
              <div className="flex items-center gap-1 mt-2 text-sm">
                <Star className="size-4 fill-amber-400 text-amber-400" />
                <span className="font-medium">
                  {restaurant.averageRating.toFixed(1)}
                </span>
                <span className="text-zinc-500">({restaurant.reviewCount})</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleToggleFav}
            aria-label="favorite"
            className={cn(
              "p-2 rounded-full shrink-0",
              isFav
                ? "bg-red-100 text-red-600 dark:bg-red-950"
                : "hover:bg-zinc-100 text-zinc-400 hover:text-red-600 dark:hover:bg-zinc-800",
            )}
          >
            <Heart className={cn("size-5", isFav && "fill-current")} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <a
            href={mapsLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-700"
          >
            <ExternalLink className="size-3.5" />
            開 Google Maps
          </a>
          {restaurant.phone && (
            <a
              href={`tel:${restaurant.phone}`}
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800"
            >
              <Phone className="size-3.5" />
              {restaurant.phone}
            </a>
          )}
          {restaurant.website && (
            <a
              href={restaurant.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800"
            >
              <ExternalLink className="size-3.5" />
              網站
            </a>
          )}
        </div>
      </header>

      <RestaurantMap
        restaurants={[restaurant]}
        center={restaurant.location}
        className="h-56 w-full rounded-2xl overflow-hidden border border-amber-200/60 dark:border-zinc-800 mb-6"
      />

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">評論 ({reviews.length})</h2>
          <Button size="sm" onClick={() => setWriting(true)}>
            <Plus className="size-4" />
            寫評論
          </Button>
        </div>
        {reviews.length === 0 ? (
          <p className="text-sm text-zinc-500 py-4 text-center">第一個來寫評論的就是你！</p>
        ) : (
          reviews.map((r) => (
            <ReviewCard
              key={r.reviewId}
              review={r}
              currentUid={user?.uid ?? ""}
              onDelete={() => handleDeleteReview(r)}
            />
          ))
        )}
      </section>

      <ReviewFormDialog
        open={writing}
        onClose={() => setWriting(false)}
        onSubmit={handleAddReview}
      />
    </>
  );
}
