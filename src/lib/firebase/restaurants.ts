import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDb } from "./config";
import type {
  Restaurant,
  RestaurantInput,
  RestaurantReview,
  RestaurantReviewInput,
} from "@/lib/types";

const COL = "restaurants";

function restaurantsCol() {
  return collection(getDb(), COL);
}

function restaurantDoc(id: string) {
  return doc(getDb(), COL, id);
}

function reviewsCol(restaurantId: string) {
  return collection(getDb(), COL, restaurantId, "reviews");
}

function favoritesCol(uid: string) {
  return collection(getDb(), "users", uid, "favoriteRestaurants");
}

function favoriteDoc(uid: string, restaurantId: string) {
  return doc(getDb(), "users", uid, "favoriteRestaurants", restaurantId);
}

function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== ""),
  ) as Partial<T>;
}

export async function listRestaurants(max = 100): Promise<Restaurant[]> {
  const snap = await getDocs(
    query(restaurantsCol(), orderBy("createdAt", "desc"), limit(max)),
  );
  return snap.docs.map((d) => ({
    ...(d.data() as Restaurant),
    restaurantId: d.id,
  }));
}

export async function getRestaurant(id: string): Promise<Restaurant | null> {
  const snap = await getDoc(restaurantDoc(id));
  return snap.exists()
    ? ({ ...(snap.data() as Restaurant), restaurantId: snap.id })
    : null;
}

export async function createRestaurant(
  uid: string,
  input: RestaurantInput,
): Promise<Restaurant> {
  // Skip duplicates by googlePlaceId
  if (input.googlePlaceId) {
    const dupSnap = await getDocs(
      query(
        restaurantsCol(),
        where("googlePlaceId", "==", input.googlePlaceId),
        limit(1),
      ),
    );
    if (!dupSnap.empty) {
      return {
        ...(dupSnap.docs[0].data() as Restaurant),
        restaurantId: dupSnap.docs[0].id,
      };
    }
  }

  const data = clean({
    ...input,
    averageRating: 0,
    reviewCount: 0,
    submittedByUid: uid,
    verified: false,
    createdAt: serverTimestamp(),
  });

  const docRef = await addDoc(restaurantsCol(), data);
  const snap = await getDoc(docRef);
  return { ...(snap.data() as Restaurant), restaurantId: snap.id };
}

// ── Favorites ──

export async function listFavoriteIds(uid: string): Promise<Set<string>> {
  const snap = await getDocs(favoritesCol(uid));
  return new Set(snap.docs.map((d) => d.id));
}

export async function toggleFavorite(
  uid: string,
  restaurantId: string,
  isFav: boolean,
): Promise<void> {
  if (isFav) {
    await deleteDoc(favoriteDoc(uid, restaurantId));
  } else {
    await setDoc(favoriteDoc(uid, restaurantId), {
      addedAt: serverTimestamp(),
    });
  }
}

// ── Reviews ──

export async function listReviews(
  restaurantId: string,
  max = 50,
): Promise<RestaurantReview[]> {
  const snap = await getDocs(
    query(reviewsCol(restaurantId), orderBy("createdAt", "desc"), limit(max)),
  );
  return snap.docs.map((d) => ({
    ...(d.data() as RestaurantReview),
    reviewId: d.id,
  }));
}

export type AddReviewArgs = RestaurantReviewInput & {
  restaurantId: string;
  authorUid: string;
  authorName: string;
  authorPhotoURL: string | null;
};

export async function addReview(args: AddReviewArgs): Promise<RestaurantReview> {
  const ratingNum = Math.max(1, Math.min(5, Math.round(args.rating)));
  const docRef = await addDoc(reviewsCol(args.restaurantId), {
    restaurantId: args.restaurantId,
    authorUid: args.authorUid,
    authorName: args.authorName,
    authorPhotoURL: args.authorPhotoURL,
    rating: ratingNum,
    text: args.text.trim(),
    photoURLs: args.photoURLs ?? [],
    createdAt: serverTimestamp(),
  });

  // Recompute average rating + count
  const restRef = restaurantDoc(args.restaurantId);
  const restSnap = await getDoc(restRef);
  if (restSnap.exists()) {
    const current = restSnap.data() as Restaurant;
    const newCount = (current.reviewCount ?? 0) + 1;
    const newAvg =
      ((current.averageRating ?? 0) * (current.reviewCount ?? 0) + ratingNum) /
      newCount;
    await updateDoc(restRef, {
      reviewCount: increment(1),
      averageRating: Math.round(newAvg * 10) / 10,
    });
  }

  return {
    reviewId: docRef.id,
    restaurantId: args.restaurantId,
    authorUid: args.authorUid,
    authorName: args.authorName,
    authorPhotoURL: args.authorPhotoURL,
    rating: ratingNum,
    text: args.text.trim(),
    photoURLs: args.photoURLs ?? [],
    createdAt: Timestamp.now(),
  };
}

export async function deleteReview(
  restaurantId: string,
  reviewId: string,
  rating: number,
): Promise<void> {
  await deleteDoc(doc(getDb(), COL, restaurantId, "reviews", reviewId));
  const restRef = restaurantDoc(restaurantId);
  const restSnap = await getDoc(restRef);
  if (restSnap.exists()) {
    const current = restSnap.data() as Restaurant;
    const newCount = Math.max(0, (current.reviewCount ?? 1) - 1);
    const newAvg =
      newCount === 0
        ? 0
        : ((current.averageRating ?? 0) * (current.reviewCount ?? 1) - rating) /
          newCount;
    await updateDoc(restRef, {
      reviewCount: increment(-1),
      averageRating: Math.round(Math.max(0, newAvg) * 10) / 10,
    });
  }
}

// ── Distance helper (haversine, km) ──

export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}
