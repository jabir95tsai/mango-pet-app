import type { Timestamp } from "firebase/firestore";

// ── Shared domain types (P0 seed: web + ios import the same source) ──
// This package is the cross-platform single source of truth for Firestore
// document shapes. P0 extracts only `Pet` (+ its two enums) to prove the
// sharing mechanism end to end; remaining types migrate out of
// apps/web/src/lib/types.ts incrementally in P1+.

export type Species = "dog" | "cat" | "other";
export type Gender = "male" | "female" | "unknown";

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
  /** Free-text animal type when `species === "other"` (e.g. 兔 / 鸚鵡 /
   *  倉鼠). Absent for dog/cat. Optional + additive so legacy pets and the
   *  iOS Pets P2 build stay compatible; display falls back to the localized
   *  "其他" label when empty. Set from the pet form's custom-species input. */
  speciesOther?: string;
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
   *  ever writes `'manual'`. */
  walkGoal?: { minutes: number; source: "manual" | "computed" };
};

// ── Visibility + reactions (shared by Post/feed; P1a extraction) ──
export type Visibility = "private" | "friends" | "public";

export const REACTION_EMOJIS = ["❤️", "😂", "🐶", "👍", "🎉"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

// ── Walks (P1a — cross-platform single source of truth) ──
// iOS writes walks/{walkId} with EXACTLY these fields so the existing
// leaderboard Cloud Functions + web feed keep working. Spec data contract:
// docs/features/ios-p1-walks.md §Data contract.
export type WalkPathPoint = { lat: number; lng: number; t: number };

export type Walk = {
  walkId: string;
  /** Family the pet belongs to. Optional during migration window.
   *  `null` for personal-mode walks — permission gated by
   *  `walkerUid == request.auth.uid` instead of family membership.
   *  ⚠️ `familyId == null` → recomputeWalkerLeaderboards short-circuits
   *  (personal walks are NOT on the leaderboard). */
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
  /** ≤500 sampled points {lat,lng,t}. */
  path?: WalkPathPoint[];
  isManual: boolean;
  /** Weighted score — computed at write time via the SHARED formula in
   *  `@mango/shared-business` (computeWalkScore). iOS + web must use the
   *  same formula or the leaderboard diverges. */
  score: number;
  notes?: string;
  /** Up to 5 Storage download URLs backed by
   *  `users/{walkerUid}/walks/{sessionId}/photos/{idx}-{ts}.{ext}`. */
  photoURLs?: string[];
  createdAt: Timestamp;
};

// ── Posts (feed + auto-photo-share; P1a extraction) ──
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
  /** Denormalised count of `posts/{postId}/comments/*`. Maintained ONLY by
   *  the Cloud Functions onCreate/onDelete comment triggers (the post
   *  `update` rule forbids non-authors touching the post doc, so a commenter
   *  can't bump it client-side — server-authoritative by design). Absent on
   *  posts created before comments shipped → readers treat `undefined` as 0.
   *  Spec docs/features/feed-comments-and-reactions-v2.md §A. */
  commentCount?: number;
  /** Optional cross-link to a walks/{walkId} doc. Set by the auto-photo-
   *  share flow. May point at a future walk doc (START post is created
   *  before the walk is saved) — readers must tolerate a missing/cancelled
   *  referenced doc. */
  walkId?: string;
};

// ── Comments (feed interaction v2) ──
/** One row of `posts/{postId}/comments/{commentId}`. Flat (no nested
 *  replies) in v1. Author identity is denormalised so the reader doesn't
 *  reverse-look-up the user doc. Read/create/delete permission mirrors the
 *  parent post's visibility (see firestore.rules). Spec
 *  docs/features/feed-comments-and-reactions-v2.md §A. */
export type Comment = {
  commentId: string;
  authorUid: string;
  authorName: string;
  authorPhotoURL: string | null;
  /** Trimmed, non-empty, ≤ COMMENT_MAX_LEN chars (enforced in rules + client). */
  text: string;
  createdAt: Timestamp;
};

/** Hard cap on comment `text` length (post-trim). Mirrored in
 *  firestore.rules `create` guard so the server rejects over-length writes
 *  even if a client skips validation. */
export const COMMENT_MAX_LEN = 500;

// ─────────────────────────────────────────────────────────────────────────
// P2 Pets batch (2026-06-02) — pet edit / reminders / expenses / health.
// Extracted out of apps/web/src/lib/types.ts so apps/web and apps/ios share
// ONE definition (web now re-exports these). Shapes are byte-for-byte the
// web originals; only their home moved. Firestore docs are written by both
// platforms + the existing callables, so field names must NOT drift.
// ─────────────────────────────────────────────────────────────────────────

// ── Walk goal (per-pet daily target) ──
/** Per-pet daily walk-minute goal. Structurally identical to the inline
 *  object historically on `Pet.walkGoal`; named here so `PetInput` and the
 *  iOS pet-edit form reuse one definition. Read sites still resolve the
 *  legacy-absent fallback via `getPetWalkGoalMinutes()`
 *  (@mango/shared-business). */
export type WalkGoal = { minutes: number; source: "manual" | "computed" };

// ── PetInput (create/update payload) ──
export type PetInput = {
  name: string;
  species: Species;
  /** Free-text animal type, only meaningful when `species === "other"`
   *  (e.g. 兔 / 鸚鵡). The form sends it only for "other"; cleared/omitted
   *  otherwise. See `Pet.speciesOther`. */
  speciesOther?: string;
  breed?: string;
  birthday?: Date;
  gender?: Gender;
  weightKg?: number;
  bio?: string;
  /** Optional in the form; absent value preserves the existing pet's
   *  walkGoal on update (the form just doesn't touch the field). */
  walkGoal?: WalkGoal;
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
export type ReminderRepeat =
  | "none"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly";

/** Allowed `notifyBeforeMinutes` presets (0 = at trigger time, 15m, 1h, 1d,
 *  1w). Drives the reminder-form picker on both platforms; the scheduled
 *  `scanReminders` function reads whatever value is stored, so adding a
 *  preset here is purely a client-UX change. */
export const NOTIFY_BEFORE_MINUTES = [0, 15, 60, 1440, 10080] as const;
export type NotifyBeforeMinutes = (typeof NOTIFY_BEFORE_MINUTES)[number];

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

// ── Expenses ──
export type ExpenseCategory =
  | "food"
  | "medical"
  | "grooming"
  | "toy"
  | "training"
  | "insurance"
  | "other";

/** Ordered category list for legend pills / category filters / form selects.
 *  Single source so the web donut legend and the iOS donut legend can't
 *  drift. (`Expense.category` is typed by `ExpenseCategory`, not this array.) */
export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  "food",
  "medical",
  "grooming",
  "toy",
  "training",
  "insurance",
  "other",
];

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
  amount: number; // in TWD
  currency: "TWD";
  vendor?: string;
  category: ExpenseCategory;
  spentAt: Timestamp;
  notes?: string;
  receiptURL?: string; // optional Storage path
  items?: string[]; // line items from receipt
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

/** AI-extracted receipt data before the user confirms (returned by the
 *  `extractReceipt` callable; gemini-2.5-flash). `spentAt` is a YYYY-MM-DD
 *  string the form parses into a Date. */
export type ExtractedReceipt = {
  amount?: number;
  vendor?: string;
  spentAt?: string; // YYYY-MM-DD
  category?: ExpenseCategory;
  items?: string[];
};
