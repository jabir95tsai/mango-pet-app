import type { Timestamp } from "firebase/firestore";
import type {
  Achievement,
  AchievementCategory,
  AchievementGrant,
  AchievementMetric,
  Comment,
  Expense,
  ExpenseCategory,
  ExpenseInput,
  ExpenseSource,
  ExtractedReceipt,
  FeedingData,
  Gender,
  LifetimeStats,
  HealthRecord,
  HealthRecordData,
  HealthRecordInput,
  HealthRecordType,
  MedicationData,
  Pet,
  PetInput,
  Post,
  ReactionEmoji,
  Reminder,
  ReminderInput,
  ReminderRepeat,
  Species,
  VaccineData,
  VetData,
  Visibility,
  Walk,
  WalkGoal,
  WalkPathPoint,
  WeightData,
} from "@mango/shared-types";
import {
  ACHIEVEMENTS,
  COMMENT_MAX_LEN,
  EXPENSE_CATEGORIES,
  NOTIFY_BEFORE_MINUTES,
  REACTION_EMOJIS,
} from "@mango/shared-types";

// These domain types now live in @mango/shared-types (cross-platform single
// source of truth). Re-exported here so existing `@/lib/types` imports keep
// working unchanged. The P2 batch (Pet edit / reminders / expenses / health)
// joined Pet/Walk/Post here on 2026-06-02.
export type {
  Achievement,
  AchievementCategory,
  AchievementGrant,
  AchievementMetric,
  Comment,
  Expense,
  ExpenseCategory,
  ExpenseInput,
  ExpenseSource,
  ExtractedReceipt,
  FeedingData,
  Gender,
  LifetimeStats,
  HealthRecord,
  HealthRecordData,
  HealthRecordInput,
  HealthRecordType,
  MedicationData,
  Pet,
  PetInput,
  Post,
  ReactionEmoji,
  Reminder,
  ReminderInput,
  ReminderRepeat,
  Species,
  VaccineData,
  VetData,
  Visibility,
  Walk,
  WalkGoal,
  WalkPathPoint,
  WeightData,
};
export {
  ACHIEVEMENTS,
  COMMENT_MAX_LEN,
  EXPENSE_CATEGORIES,
  NOTIFY_BEFORE_MINUTES,
  REACTION_EMOJIS,
};

export type AuthProviderKind = "google" | "apple" | "facebook";

export type AppUser = {
  uid: string;
  displayName: string;
  /** Lowercase, trimmed mirror of `displayName` for case-insensitive
   *  prefix search (Firestore range queries are case-sensitive and only
   *  support prefix-match — Chinese chars are unaffected by lowercase, so
   *  one field handles "jabir"/"Jabir"/"蔡" alike). Optional until the
   *  backfillDisplayNameLower migration completes for every existing doc;
   *  after that all new writes set it. See spec
   *  docs/features/friends-search-lowercase.md. */
  displayNameLower?: string;
  /** @deprecated PII moved to users/{uid}/private/contact (security-hardening
   *  #2). No longer on the public profile doc; optional only so transitional
   *  reads during migration still type-check. Read `email` from the Auth
   *  object or the private subdoc, not here. */
  email?: string | null;
  photoURL: string | null;
  /** `"anonymous"` for guest (anonymous-auth) users — see `isGuest`. */
  authProvider: AuthProviderKind | "anonymous";
  /** True for anonymous/guest accounts (signInAnonymously). Guests can use
   *  personal features (pets/walks) but are excluded from community
   *  (posts/comments/reactions/family/friends) and from the leaderboards
   *  (walker + dog aggregation skips them). Set on guest profile create;
   *  cleared automatically by `upsertUser` when the user upgrades via
   *  linkWithCredential (uid unchanged). Absent = a real (non-guest) user.
   *  Spec docs/features/guest-login.md. */
  isGuest?: boolean;
  locale: "zh-TW" | "en";
  city?: string;
  createdAt: Timestamp;
  lastSeenAt: Timestamp;
  defaultPostVisibility: Visibility;
  allowFriendRequests: boolean;
  /** @deprecated PII moved to users/{uid}/private/contact (security-hardening
   *  #2). Managed by messaging.ts (private subdoc) + read server-side by
   *  Cloud Functions. Not on the public profile doc anymore. */
  fcmTokens?: string[];
  /** Families the user belongs to. Empty array before first migration. */
  familyIds?: string[];
  /** Active family for filtering reads/writes. Falls back to familyIds[0]. */
  currentFamilyId?: string;
  /** Engagement-push prefs. Namespace reserved so future additions
   *  (quietHours, perPetOptOut, etc.) don't break existing reads.
   *  See docs/features/engagement-push-notifications.md Phase 4. */
  pushPrefs?: {
    /** Push-type ids the user has opted OUT of. Absent / empty array =
     *  all engagement pushes enabled. Strings, NOT enums, so adding a
     *  new push type doesn't require a schema migration — the new id
     *  just defaults to "ON" for everyone until they opt out. Current
     *  values: "evening-walk-reminder", "streak-warning",
     *  "rank-overtake", "family-milestone". */
    engagementOptOut?: string[];
    /** Explicit "user turned push OFF" intent. Absent/false = on. Set
     *  true by disablePush so the Settings probe stops re-minting an FCM
     *  token via reconcileCurrentToken (which otherwise re-enables push
     *  on every Settings open while the OS permission stays "granted").
     *  Cleared by enablePush. */
    globalDisabled?: boolean;
  };
  /** Walks-related preferences. Namespace reserved so future
   *  per-walk toggles (e.g., quiet hours, GPS-off mode) don't
   *  break existing reads. Spec docs/features/walks-auto-photo-
   *  share.md. */
  walkPrefs?: {
    /** Show the "拍張開始/結束照?" prompt at walk start + walk end.
     *  Absent = treated as TRUE (default ON for everyone, matching
     *  the spec's "預設 ON" decision). User can toggle in
     *  Settings → 遛狗自動拍照. */
    autoPhotoShare?: boolean;
  };
  /** Per-user master switch for the dog-centric leaderboard (v2). Controls
   *  whether THIS user's dogs appear on the all-app / friends dog boards.
   *  Absent = treated as `'public'` (default opt-in). Changing it fans the
   *  new value out to every dog entry's denormalised `ownerVisibility` via
   *  the `syncDogEntryVisibility` function. Spec
   *  docs/features/leaderboard-v2-dog-centric.md ③. */
  leaderboardVisibility?: LeaderboardVisibility;
};

/** Dog-leaderboard visibility (leaderboard v2). `'public'` = all-app +
 *  friends; `'friends'` = friends tab only; `'off'` = neither (owner still
 *  sees their own dog). */
export type LeaderboardVisibility = "public" | "friends" | "off";

/** Engagement push type ids, kept in sync with cron / event-trigger
 *  function names in functions/src/index.ts. Used as the value space
 *  for `AppUser.pushPrefs.engagementOptOut`. */
export const ENGAGEMENT_PUSH_TYPES = [
  "evening-walk-reminder",
  "streak-warning",
  "rank-overtake",
  "family-milestone",
  "post-comment",
  "post-reaction",
  "achievement",
] as const;
export type EngagementPushType = (typeof ENGAGEMENT_PUSH_TYPES)[number];

// ── Families ──
export type Family = {
  familyId: string;
  name: string;
  ownerUid: string;
  memberUids: string[];
  /** 6-digit numeric code shared out-of-band to invite new members. */
  inviteCode: string;
  inviteCodeExpiresAt?: Timestamp;
  createdAt: Timestamp;
};

export type FamilyMember = {
  uid: string;
  displayName: string;
  photoURL: string | null;
  /** When this user joined the family. */
  joinedAt: Timestamp;
};

// `PetInput` now lives in @mango/shared-types (re-exported at top of file).

// `Post` now lives in @mango/shared-types (re-exported at top of file).

export type PostInput = {
  text: string;
  petIds: string[];
  visibility: Visibility;
  photoURLs: string[];
  /** See `Post.walkId`. Passed through `createPost`. */
  walkId?: string;
};

// Health records + Reminders now live in @mango/shared-types
// (re-exported at top of file).

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
// `Walk` + `WalkPathPoint` now live in @mango/shared-types (re-exported above).

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
  /** Pre-uploaded Storage download URLs (spec docs/features/
   *  walks-photo-and-celebration.md). Up to 5 entries; pre-uploaded
   *  during tracking so the create call only persists the references. */
  photoURLs?: string[];
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
  /** Rank in the same period the previous aggregation produced. Used
   *  by the rank-overtake engagement push (Phase 2 B1) to detect
   *  yesterday-vs-today regressions. Absent on first aggregation. */
  previousRank?: number;
  /** Wall-clock stamp on the last score-changing write — set by both
   *  the daily cron AND the realtime recomputeWalkerLeaderboards
   *  trigger. Frontend `useLeaderboardEntryGlow` diffs this across
   *  Firestore snapshots to flash a brand-color highlight on the row
   *  when a family member's score just jumped. Optional so legacy
   *  entries written before this field existed don't trip the diff. */
  lastUpdatedAt?: Timestamp;
};

// ── Dog-centric leaderboard (v2) ──
/** One row of `dogLeaderboards/{period}/entries/{petId}`. Written only by
 *  Cloud Functions (cron + realtime triggers). `ownerUid` / `ownerName` are
 *  denormalised so the client can build the friends/all-app tabs without
 *  cross-family pet reads; `ownerVisibility` (denormalised from the owner's
 *  `users/{uid}.leaderboardVisibility`) decides which tab the dog shows on.
 *  Spec docs/features/leaderboard-v2-dog-centric.md ②. */
export type DogLeaderboardEntry = {
  petId: string;
  petName: string;
  petPhotoURL: string | null;
  breed: string | null;
  species: Species;
  ownerUid: string;
  ownerName: string;
  /** `null` for personal-mode dogs (no family). */
  familyId: string | null;
  totalScore: number;
  totalDistanceKm: number;
  totalDurationMin: number;
  walkCount: number;
  /** Consecutive days this dog was walked by ANY walker. */
  streakDays: number;
  ownerVisibility: LeaderboardVisibility;
  updatedAt: Timestamp;
  lastUpdatedAt?: Timestamp;
  previousRank?: number;
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

// Expenses (Expense / ExpenseInput / ExpenseCategory / ExpenseSource) now
// live in @mango/shared-types (re-exported at top of file).

// ── Photo gallery ──
export type GalleryPhotoSource =
  | "post"
  | "walk"
  | "pet-avatar"
  | "expense-receipt";

export type GalleryPhotoAsset = {
  /** Stable per-photo id. Used as the downloaded-state document id. */
  id: string;
  source: GalleryPhotoSource;
  url: string;
  title: string;
  createdAt: Timestamp;
  sourceId: string;
  petId?: string;
  petName?: string;
  fileName: string;
};

export type PhotoDownloadMode = "share" | "download";

export type PhotoDownloadState = {
  assetId: string;
  source: GalleryPhotoSource;
  sourceId: string;
  urlHash: string;
  downloadedAt: Timestamp;
  mode: PhotoDownloadMode;
};

// `ExtractedReceipt` now lives in @mango/shared-types (re-exported at top of
// file).
