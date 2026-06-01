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
