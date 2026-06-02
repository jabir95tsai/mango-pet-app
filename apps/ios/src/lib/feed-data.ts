/**
 * Home + Feed data hook. One-shot getDocs + Promise.all (NO onSnapshot — same
 * as web home/feed, so there are no listeners to clean up). Resolves the active
 * scope (personal / family), then loads pets + friend uids + feed posts + recent
 * walks (for today's story-ring status) + the family name for the top bar.
 *
 * `home` mode caps the feed at 10 (web home shows 10 + "view all" → /feed);
 * full feed passes no cap. Pull-to-refresh via `refresh()`.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import firestore from "@react-native-firebase/firestore";
import type { Pet, Post, Walk } from "@mango/shared-types";
import { computeTodayWalkStatus, type WalkStatus } from "@mango/shared-business";

import { useAuth } from "@/state/auth-context";
import {
  listPetsForScope,
  listWalksForScope,
  resolveCurrentFamilyId,
} from "@/lib/walk-data";
import { listFeedPosts } from "@/lib/posts";
import { listFriendUids } from "@/lib/friends-read";

const HOME_FEED_LIMIT = 10;
const FEED_FETCH_MAX = 30;

async function getFamilyName(familyId: string | null): Promise<string | null> {
  if (!familyId) return null;
  try {
    const snap = await firestore().collection("families").doc(familyId).get();
    return (snap.data() as { name?: string } | undefined)?.name ?? null;
  } catch {
    return null;
  }
}

export type FeedData = ReturnType<typeof useFeedData>;

export function useFeedData({ home }: { home: boolean }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pets, setPets] = useState<Pet[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [walks, setWalks] = useState<Walk[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh: boolean) => {
      if (!user) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const fam = await resolveCurrentFamilyId(user.uid);
        setFamilyId(fam);
        const friendUids = await listFriendUids(user.uid);
        const [petList, postList, walkList, famName] = await Promise.all([
          listPetsForScope(fam, user.uid).catch(() => [] as Pet[]),
          listFeedPosts(user.uid, friendUids, FEED_FETCH_MAX).catch(
            () => [] as Post[],
          ),
          listWalksForScope(fam, user.uid, 50).catch(() => [] as Walk[]),
          getFamilyName(fam),
        ]);
        setPets(petList);
        setPosts(home ? postList.slice(0, HOME_FEED_LIMIT) : postList);
        setWalks(walkList);
        setFamilyName(famName);
      } finally {
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [user, home],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  const walkStatus = useMemo<Map<string, WalkStatus>>(
    () => computeTodayWalkStatus(pets, walks),
    [pets, walks],
  );

  return {
    loading,
    refreshing,
    pets,
    posts,
    walkStatus,
    familyId,
    familyName,
    hasMoreThanHome: home && posts.length >= HOME_FEED_LIMIT,
    refresh,
    // local optimistic removal after deletePost (avoids a full refetch)
    removePost: (postId: string) =>
      setPosts((prev) => prev.filter((p) => p.postId !== postId)),
  };
}
