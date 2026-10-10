/**
 * Home + Feed data hook. One-shot getDocs + Promise.allSettled (NO onSnapshot —
 * same as web home/feed, so there are no listeners to clean up). Mirrors
 * apps/web/src/app/app/page.tsx (home) and apps/web/src/app/app/feed/page.tsx:
 *   - pets (composer tagging + stories) for the active scope,
 *   - friend uids + blocked uids (in parallel) → listFeedPosts,
 *   - home only: recent walks for today's story-ring status (web
 *     useTodayWalkStatus pulls 50); the full feed screen does not need walks.
 *
 * Scope + family name come from FamilyContext via useScopedData (R08 /
 * HOME-13): no users/{uid} or families/{id} read of its own, reloads when the
 * family changes, stale responses dropped, failures surface as `error`.
 *
 * `home` mode reads at most 10 posts per source (web home passes max=10) and
 * shows 10 + "view all" → /feed; the full feed reads 30 per source (web feed).
 */
import { useCallback, useMemo, useRef } from "react";
import type { Pet, Post, Walk } from "@mango/shared-types";
import { computeTodayWalkStatus, type WalkStatus } from "@mango/shared-business";

import { listPetsForScope, listWalksForScope } from "@/lib/walk-data";
import { listFeedPosts } from "@/lib/posts";
import { listFriendUids } from "@/lib/friends-read";
import { getBlockedUids } from "@/lib/user-prefs";
import { useScopedData, type ScopedFetcher } from "@/lib/use-family-scope";

const HOME_FEED_LIMIT = 10;
const FEED_FETCH_MAX = 30;
/** Same window web's home useTodayWalkStatus reads for "today" filtering. */
const HOME_WALKS_LIMIT = 50;

/**
 * Posts-only invalidation shared by the home + full-feed instances (both live
 * in this module): a local delete/block on one screen makes the other refetch
 * on its next focus without marking pets/walks screens stale.
 */
let postsRevision = 0;

type FeedPayload = {
  pets: Pet[];
  posts: Post[];
  walks: Walk[];
  /** The pets read itself failed (0 pets is then unknown, not "no pets"). */
  petsFailed: boolean;
};

const EMPTY: FeedPayload = { pets: [], posts: [], walks: [], petsFailed: false };

export type FeedData = ReturnType<typeof useFeedData>;

export function useFeedData({ home }: { home: boolean }) {
  const loadedPostsRevision = useRef(-1);

  const fetchFeed = useCallback<ScopedFetcher<FeedPayload>>(
    async ({ uid, familyId }, prev) => {
      loadedPostsRevision.current = postsRevision;
      const fetchMax = home ? HOME_FEED_LIMIT : FEED_FETCH_MAX;
      const postsPromise = (async () => {
        // Friends + blocked in parallel; each degrades to [] like web.
        const [friendsR, blockedR] = await Promise.allSettled([
          listFriendUids(uid),
          getBlockedUids(uid),
        ]);
        const friendUids = friendsR.status === "fulfilled" ? friendsR.value : [];
        const blockedUids = blockedR.status === "fulfilled" ? blockedR.value : [];
        const list = await listFeedPosts(uid, friendUids, fetchMax, blockedUids);
        return home ? list.slice(0, HOME_FEED_LIMIT) : list;
      })();
      const [petsR, postsR, walksR] = await Promise.allSettled([
        listPetsForScope(familyId, uid),
        postsPromise,
        home
          ? listWalksForScope(familyId, uid, HOME_WALKS_LIMIT)
          : Promise.resolve([] as Walk[]),
      ]);
      const error =
        petsR.status === "rejected"
          ? petsR.reason
          : postsR.status === "rejected"
            ? postsR.reason
            : walksR.status === "rejected"
              ? walksR.reason
              : undefined;
      return {
        data: {
          pets: petsR.status === "fulfilled" ? petsR.value : (prev?.pets ?? []),
          posts: postsR.status === "fulfilled" ? postsR.value : (prev?.posts ?? []),
          walks: walksR.status === "fulfilled" ? walksR.value : (prev?.walks ?? []),
          petsFailed: petsR.status === "rejected",
        },
        error,
      };
    },
    [home],
  );

  const scoped = useScopedData<FeedPayload>({
    initial: EMPTY,
    fetch: fetchFeed,
    variant: home ? "home" : "feed",
    isStale: () => loadedPostsRevision.current !== postsRevision,
  });
  const { pets, posts, walks, petsFailed } = scoped.data;
  const { mutate, reload } = scoped;

  const walkStatus = useMemo<Map<string, WalkStatus>>(
    () => computeTodayWalkStatus(pets, walks),
    [pets, walks],
  );

  const bumpPosts = useCallback(() => {
    postsRevision += 1;
    loadedPostsRevision.current = postsRevision;
  }, []);

  /** Local optimistic removal after deletePost (avoids a full refetch). */
  const removePost = useCallback(
    (postId: string) => {
      mutate((d) => ({ ...d, posts: d.posts.filter((p) => p.postId !== postId) }));
      bumpPosts();
    },
    [mutate, bumpPosts],
  );

  /** Local optimistic removal after blockUser (ugc-moderation.md) — drops the
   *  blocked author's other posts from the current view without a full
   *  refetch (comments filter server-side on next comment-section mount since
   *  listComments takes blockedUids too). */
  const removeBlockedAuthor = useCallback(
    (blockedUid: string) => {
      mutate((d) => ({
        ...d,
        posts: d.posts.filter((p) => p.authorUid !== blockedUid),
      }));
      bumpPosts();
    },
    [mutate, bumpPosts],
  );

  /** After publishing a post: reload here; the other feed screen refetches on
   *  its next focus (posts-only invalidation). */
  const reloadAfterPost = useCallback(async () => {
    postsRevision += 1;
    await reload();
  }, [reload]);

  return {
    loading: scoped.loading,
    refreshing: scoped.refreshing,
    /** Scope read error or last load error (previous data kept). */
    error: scoped.error,
    /** Pets could not be read (scope error or pets query failure) — a 0-pet
     *  screen must show retry, not the add-first-pet hero. Partial failures
     *  of posts / walks do NOT set this. */
    petsUnknown: scoped.scopeStatus === "error" || petsFailed,
    scopeReady: scoped.scopeReady,
    scopeStatus: scoped.scopeStatus,
    pets,
    posts,
    walkStatus,
    /** Active scope (null = personal). Only authoritative when scopeReady. */
    familyId: scoped.familyId,
    /** Active family name from FamilyContext (null in personal mode). */
    familyName: scoped.family?.name ?? null,
    family: scoped.family,
    hasMoreThanHome: home && posts.length >= HOME_FEED_LIMIT,
    /** Pull-to-refresh / retry (re-resolves a failed family scope first). */
    refresh: scoped.refresh,
    /** Silent reload. */
    reload,
    /** After a write that affects pets/walks too: reload + mark all tabs stale. */
    reloadAfterWrite: scoped.reloadAfterWrite,
    /** After PostComposer publishes (onPosted). */
    reloadAfterPost,
    removePost,
    removeBlockedAuthor,
  };
}
