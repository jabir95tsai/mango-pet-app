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
  /** Lowercase, trimmed mirror of `displayName` for case-insensitive
   *  prefix search (Firestore range queries are case-sensitive and only
   *  support prefix-match — Chinese chars are unaffected by lowercase, so
   *  one field handles "jabir"/"Jabir"/"蔡" alike). Optional until the
   *  backfillDisplayNameLower migration completes for every existing doc;
   *  after that all new writes set it. See spec
   *  docs/features/friends-search-lowercase.md. */
  displayNameLower?: string;
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
};

/** Engagement push type ids, kept in sync with cron / event-trigger
 *  function names in functions/src/index.ts. Used as the value space
 *  for `AppUser.pushPrefs.engagementOptOut`. */
export const ENGAGEMENT_PUSH_TYPES = [
  "evening-walk-reminder",
  "streak-warning",
  "rank-overtake",
  "family-milestone",
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

export type Pet = {
  petId: string;
  /** Family this pet belongs to. All members of the family can read/write.
   *  `null` means **personal mode** — the pet lives in the creator's
   *  personal namespace; permission gated by `ownerUid == request.auth.uid`
   *  instead of family membership. Created via `createPet(null, uid, …)`. */
  familyId: string | null;
  /** The user who originally created the pet. In family mode this is for
   *  attribution; in personal mode (`familyId === null`) it is **the
   *  permission boundary** — only this user can read/write. */
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
  /** Per-pet daily walk-minute goal. Drives the walks-page dial, week-
   *  strip done flags, A1 evening reminder threshold, and B2 family-
   *  milestone threshold (all of which historically hardcoded 30).
   *
   *  Absent on legacy pets — every read site MUST go through
   *  `getPetWalkGoalMinutes()` in `@/lib/walk-goals` which falls back
   *  to `DEFAULT_WALK_GOAL_MINUTES` (30). Don't read `pet.walkGoal.minutes`
   *  directly without the fallback or legacy pets will throw nil-ptr.
   *
   *  `source: 'computed'` namespace is reserved for a future spec that
   *  derives a recommendation from breed/age/weight; this round only
   *  ever writes `'manual'`. UI may render a "建議值（可覆蓋）" chip on
   *  `'computed'` so user knows it's overridable. */
  walkGoal?: { minutes: number; source: "manual" | "computed" };
};

export type PetInput = {
  name: string;
  species: Species;
  breed?: string;
  birthday?: Date;
  gender?: Gender;
  weightKg?: number;
  bio?: string;
  /** Optional in the form; absent value preserves the existing pet's
   *  walkGoal on update (the form just doesn't touch the field). */
  walkGoal?: { minutes: number; source: "manual" | "computed" };
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
  /** Optional cross-link to a walks/{walkId} doc. Set by the auto-
   *  photo-share flow when the post is created from the start /
   *  end walk prompt (docs/features/walks-auto-photo-share.md). May
   *  point at a future walk doc (start photo is taken before the
   *  walk is saved) — clients reading this field should tolerate
   *  the referenced doc being missing or cancelled. */
  walkId?: string;
};

export type PostInput = {
  text: string;
  petIds: string[];
  visibility: Visibility;
  photoURLs: string[];
  /** See `Post.walkId`. Passed through `createPost`. */
  walkId?: string;
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
  /** Family the pet belongs to. Optional during the migration window —
   *  legacy records still under `users/{uid}/pets/.../healthRecords/` won't
   *  have it; new top-level records always will. `null` for records under
   *  a personal-mode pet (parent pet's `familyId === null`). Permission is
   *  resolved via the parent pet, so this field is informational only. */
  familyId?: string | null;
  petId: string;
  /** User who recorded it (for attribution). Optional for legacy data. */
  recordedByUid?: string;
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
  /** Family that this reminder belongs to. Optional during migration
   *  window. `null` for personal-mode reminders — permission gated by
   *  `createdByUid == request.auth.uid` instead. */
  familyId?: string | null;
  /** User who created the reminder. In family mode this is for
   *  attribution; in personal mode it is the permission boundary. */
  createdByUid?: string;
  petId?: string;
  title: string;
  description?: string;
  triggerAt: Timestamp;
  repeat: ReminderRepeat;
  notifyBeforeMinutes: number;
  done: boolean;
  doneAt?: Timestamp;
  /** User who marked the reminder done (attribution). */
  doneByUid?: string;
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
  /** Family the pet belongs to. Optional during migration window.
   *  `null` for personal-mode walks — permission gated by
   *  `walkerUid == request.auth.uid` instead of family membership. */
  familyId?: string | null;
  /** Member of the family who actually did the walk — drives leaderboard
   *  credit. Optional during migration (legacy walks use `ownerUid`). */
  walkerUid?: string;
  walkerName?: string;
  walkerPhotoURL?: string | null;
  /** Legacy/back-compat: alias of walkerUid. */
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
  /** Up to 5 user-captured photos taken during the walk (spec D2). Each
   *  URL is a Firebase Storage download URL backed by
   *  `users/{walkerUid}/walks/{walkId}/photos/{idx}-{ts}.{ext}`. Old
   *  walks without this field are fine — every render-site treats
   *  `photoURLs?.length` defensively. */
  photoURLs?: string[];
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
  /** Family the pet belongs to. Optional during migration window.
   *  `null` for personal-mode expenses — permission gated by
   *  `payerUid == request.auth.uid` instead of family membership. */
  familyId?: string | null;
  /** Member who paid (for attribution + per-payer breakdowns). */
  payerUid?: string;
  payerName?: string;
  /** Legacy alias of payerUid for back-compat. */
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

/** AI-extracted data before user confirms. */
export type ExtractedReceipt = {
  amount?: number;
  vendor?: string;
  spentAt?: string;        // YYYY-MM-DD
  category?: ExpenseCategory;
  items?: string[];
};
