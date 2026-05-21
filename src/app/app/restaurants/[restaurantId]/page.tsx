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
import { useConfirm } from "@/components/ui/confirm-provider";
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
  const askConfirm = useConfirm();

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
    const ok = await askConfirm({
      title: tC("delete"),
      message: review.text.slice(0, 80),
      confirmText: tC("delete"),
      cancelText: tC("cancel"),
      danger: true,
    });
    if (!ok) return;
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
          className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <ArrowLeft className="size-5" />
        </button>
      </div>

      <header className="mb-4 rounded-lg border border-zinc-200/80 bg-white p-5 shadow-sm shadow-zinc-200/40 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold">{restaurant.name}</h1>
            <p className="text-sm text-zinc-500 mt-1 flex items-center gap-1">
              <MapPin className="size-3.5" />
              {restaurant.address}
            </p>
            <div className="flex flex-wrap gap-2 mt-3 text-xs">
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                {LEVEL_LABEL[restaurant.petFriendlyLevel]}
              </span>
              {restaurant.hasWaterBowl && (
                <span className="rounded-md bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                  💧 水碗
                </span>
              )}
              {restaurant.hasPetMenu && (
                <span className="rounded-md bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                  🍽️ 寵物餐
                </span>
              )}
              {restaurant.allowsLargeDogs && (
                <span className="rounded-md bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
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
              "shrink-0 rounded-lg p-2",
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
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <ExternalLink className="size-3.5" />
            開 Google Maps
          </a>
          {restaurant.phone && (
            <a
              href={`tel:${restaurant.phone}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-100 px-3 text-xs font-medium hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:bg-zinc-800"
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
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-100 px-3 text-xs font-medium hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:bg-zinc-800"
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
        className="mb-6 h-56 w-full overflow-hidden rounded-lg border border-zinc-200/80 dark:border-zinc-800"
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
