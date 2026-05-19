import type { Timestamp } from "firebase/firestore";

export type Species = "dog" | "cat" | "other";
export type Gender = "male" | "female" | "unknown";
export type Visibility = "private" | "friends" | "public";
export type AuthProviderKind = "google" | "apple" | "facebook";

export const REACTION_EMOJIS = ["❤️", "😂", "🐶", "👍", "🎉"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export type AppUser = {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  authProvider: AuthProviderKind;
  locale: "zh-TW" | "en";
  city?: string;
  createdAt: Timestamp;
  lastSeenAt: Timestamp;
  defaultPostVisibility: Visibility;
  allowFriendRequests: boolean;
  fcmTokens?: string[];
};

export type Pet = {
  petId: string;
  ownerUid: string;
  name: string;
  species: Species;
  breed?: string;
  birthday?: Timestamp;
  gender?: Gender;
  weightKg?: number;
  photoURL?: string;
  bio?: string;
  createdAt: Timestamp;
};

export type PetInput = {
  name: string;
  species: Species;
  breed?: string;
  birthday?: Date;
  gender?: Gender;
  weightKg?: number;
  bio?: string;
};

export type Post = {
  postId: string;
  authorUid: string;
  authorName: string;
  authorPhotoURL: string | null;
  petIds: string[];
  text: string;
  photoURLs: string[];
  visibility: Visibility;
  createdAt: Timestamp;
  reactionCounts: Record<ReactionEmoji, number>;
};

export type PostInput = {
  text: string;
  petIds: string[];
  visibility: Visibility;
  photoURLs: string[];
};

// ── Health records ──
export type HealthRecordType =
  | "weight"
  | "feeding"
  | "vaccine"
  | "vet"
  | "medication";

export type WeightData = { kg: number };
export type FeedingData = {
  brand?: string;
  amountG?: number;
  foodType?: string;
};
export type VaccineData = {
  name: string;
  nextDueAt?: Timestamp;
};
export type VetData = {
  clinic: string;
  doctor?: string;
  diagnosis: string;
  prescription?: string;
};
export type MedicationData = {
  name: string;
  frequency?: string;
  startsAt?: Timestamp;
  endsAt?: Timestamp;
};

export type HealthRecordData =
  | WeightData
  | FeedingData
  | VaccineData
  | VetData
  | MedicationData;

export type HealthRecord = {
  recordId: string;
  petId: string;
  type: HealthRecordType;
  recordedAt: Timestamp;
  data: HealthRecordData;
  notes?: string;
  createdAt: Timestamp;
};

export type HealthRecordInput = {
  type: HealthRecordType;
  recordedAt: Date;
  data: HealthRecordData;
  notes?: string;
};

// ── Reminders ──
export type ReminderRepeat = "none" | "daily" | "weekly" | "monthly" | "yearly";

export type Reminder = {
  reminderId: string;
  petId?: string;
  title: string;
  description?: string;
  triggerAt: Timestamp;
  repeat: ReminderRepeat;
  notifyBeforeMinutes: number;
  done: boolean;
  doneAt?: Timestamp;
  /** Set by scheduled function after a push was sent for this trigger. Reset when advancing. */
  notified?: boolean;
  notifiedAt?: Timestamp;
  createdAt: Timestamp;
};

export type ReminderInput = {
  petId?: string;
  title: string;
  description?: string;
  triggerAt: Date;
  repeat: ReminderRepeat;
  notifyBeforeMinutes: number;
};

// ── Restaurants ──
export type PetFriendlyLevel = "indoor_ok" | "outdoor_only" | "restricted";

export type Restaurant = {
  restaurantId: string;
  name: string;
  address: string;
  /** Stored as { lat, lng } object (NOT Firestore GeoPoint, simpler for client). */
  location: { lat: number; lng: number };
  /** Optional: geohash for proximity queries (future). */
  geohash?: string;
  googlePlaceId?: string;
  phone?: string;
  website?: string;
  petFriendlyLevel: PetFriendlyLevel;
  hasWaterBowl?: boolean;
  hasPetMenu?: boolean;
  allowsLargeDogs?: boolean;
  averageRating: number;
  reviewCount: number;
  submittedByUid?: string;
  verified: boolean;
  createdAt: Timestamp;
};

export type RestaurantInput = {
  name: string;
  address: string;
  location: { lat: number; lng: number };
  googlePlaceId?: string;
  phone?: string;
  website?: string;
  petFriendlyLevel: PetFriendlyLevel;
  hasWaterBowl?: boolean;
  hasPetMenu?: boolean;
  allowsLargeDogs?: boolean;
};

export type RestaurantReview = {
  reviewId: string;
  restaurantId: string;
  authorUid: string;
  authorName: string;
  authorPhotoURL: string | null;
  rating: number; // 1-5
  text: string;
  photoURLs?: string[];
  createdAt: Timestamp;
};

export type RestaurantReviewInput = {
  rating: number;
  text: string;
  photoURLs?: string[];
};

// ── Walks ──
export type WalkPathPoint = { lat: number; lng: number; t: number };

export type Walk = {
  walkId: string;
  ownerUid: string;
  petId: string;
  petName?: string;
  startedAt: Timestamp;
  endedAt: Timestamp;
  distanceKm: number;
  durationMin: number;
  path?: WalkPathPoint[];
  isManual: boolean;
  /** Weighted score per scoring formula (see lib/scoring.ts). */
  score: number;
  notes?: string;
  createdAt: Timestamp;
};

export type WalkInput = {
  petId: string;
  petName?: string;
  startedAt: Date;
  endedAt: Date;
  distanceKm: number;
  durationMin: number;
  path?: WalkPathPoint[];
  isManual: boolean;
  notes?: string;
};

// ── Leaderboards ──
export type LeaderboardPeriod = "weekly" | "monthly" | "all_time";

export type LeaderboardEntry = {
  uid: string;
  displayName: string;
  photoURL: string | null;
  city?: string;
  totalScore: number;
  totalDistanceKm: number;
  totalDurationMin: number;
  walkCount: number;
  streakDays: number;
  updatedAt: Timestamp;
};

// ── Knowledge ──
export type KnowledgeCategory =
  | "feeding"
  | "training"
  | "health"
  | "breed"
  | "lifestyle";

export type KnowledgeArticle = {
  articleId: string;
  title: { "zh-TW": string; en: string };
  category: KnowledgeCategory;
  contentMd: { "zh-TW": string; en: string };
  excerpt?: { "zh-TW": string; en: string };
  coverImageURL?: string;
  authorName: string;
  publishedAt: Timestamp;
  tags?: string[];
};

// ── Friends ──
export type FriendRequest = {
  requestId: string;
  fromUid: string;
  fromName: string;
  fromPhotoURL: string | null;
  requestedAt: Timestamp;
};

export type Friend = {
  uid: string;
  displayName: string;
  photoURL: string | null;
  addedAt: Timestamp;
};

// ── Expenses ──
export type ExpenseCategory =
  | "food"
  | "medical"
  | "grooming"
  | "toy"
  | "training"
  | "insurance"
  | "other";

export type ExpenseSource = "manual" | "ai_scan";

export type Expense = {
  expenseId: string;
  ownerUid: string;
  petId: string;
  petName?: string;
  amount: number;          // in TWD
  currency: "TWD";
  vendor?: string;
  category: ExpenseCategory;
  spentAt: Timestamp;
  notes?: string;
  receiptURL?: string;     // optional Storage path
  items?: string[];        // line items from receipt
  source: ExpenseSource;
  createdAt: Timestamp;
};

export type ExpenseInput = {
  petId: string;
  petName?: string;
  amount: number;
  vendor?: string;
  category: ExpenseCategory;
  spentAt: Date;
  notes?: string;
  items?: string[];
  source: ExpenseSource;
};

/** AI-extracted data before user confirms. */
export type ExtractedReceipt = {
  amount?: number;
  vendor?: string;
  spentAt?: string;        // YYYY-MM-DD
  category?: ExpenseCategory;
  items?: string[];
};
