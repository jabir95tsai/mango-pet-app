"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/components/family/family-provider";
import { useConfirm } from "@/components/ui/confirm-provider";
import { PostCard } from "@/components/feed/post-card";
import { PostComposer } from "@/components/feed/post-composer";
import { HomeTopBar } from "@/components/home/home-top-bar";
import { StoriesBar } from "@/components/home/stories-bar";
import { FeedSectionHeader } from "@/components/home/feed-section-header";
import { HomeEmptyState } from "@/components/home/home-empty-state";
import { InviteFamilyCard } from "@/components/home/invite-family-card";
import { NoPostsHint } from "@/components/home/no-posts-hint";
import { listPersonalPets, listPets } from "@/lib/firebase/pets";
import { deletePost, listFeedPosts } from "@/lib/firebase/posts";
import { listFriends } from "@/lib/firebase/friends";
import type { Pet, Post } from "@/lib/types";

/**
 * Home page v3 — B1 Feed-first + IG Stories pets bar
 * Spec: docs/features/home-v3-feed-first.md
 *
 * Renders four variants driven by pets / family / posts state:
 *   - 0 pets                       → HomeEmptyState hero
 *   - ≥1 pet, no family            → Stories + InviteFamilyCard + Feed
 *   - ≥1 pet, family, 0 posts      → Stories + NoPostsHint
 *   - ≥1 pet, family, ≥1 posts (B1) → Stories + Feed + 「查看更多」
 *
 * Stories bar 1st slot is the user's "Your Story" avatar with a brand
 * `+` overlay — tap opens PostComposer (IG mode per user D2 override
 * of the PM default).
 */
export default function AppHome() {
  const tC = useTranslations("Common");
  const tH = useTranslations("Home");
  const askConfirm = useConfirm();
  const { user } = useAuth();
  const { family, loading: familyLoading } = useFamily();

  const [pets, setPets] = useState<Pet[]>([]);
  const [feedPosts, setFeedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const [petR, friendsR] = await Promise.allSettled([
        family ? listPets(family.familyId) : listPersonalPets(user.uid),
        listFriends(user.uid),
      ]);
      setPets(petR.status === "fulfilled" ? petR.value : []);
      const friends = friendsR.status === "fulfilled" ? friendsR.value : [];
      try {
        // Spec reminders-to-pets-page.md D2: home surfaces the latest
        // 10 posts (family + friends + public mixed), with a "查看更多"
        // CTA into /app/feed for the full timeline.
        const feed = await listFeedPosts(
          user.uid,
          friends.map((f) => f.uid),
          10,
        );
        setFeedPosts(feed.slice(0, 10));
      } catch {
        setFeedPosts([]);
      }
    } finally {
      setLoading(false);
    }
  }, [user, family]);

  useEffect(() => {
    if (familyLoading) return;
    refresh();
  }, [familyLoading, refresh]);

  async function handleDeletePost(post: Post) {
    const ok = await askConfirm({
      title: tC("delete"),
      message: post.text ? post.text.slice(0, 80) : "貼文",
      confirmText: tC("delete"),
      cancelText: tC("cancel"),
      danger: true,
    });
    if (!ok) return;
    await deletePost(post.postId);
    await refresh();
  }

  if (loading) {
    return <p className="text-sm text-mango-ink-3">{tC("loading")}</p>;
  }

  // ── Variant D1: 0 pets → hero empty state ───────────────────────
  if (pets.length === 0) {
    return (
      <>
        <HomeTopBar
          familyName={family?.name ?? null}
          userDisplayName={user?.displayName ?? null}
        />
        <HomeEmptyState />
        <PostComposer
          open={composerOpen}
          onClose={() => setComposerOpen(false)}
          pets={pets}
          onCreated={refresh}
        />
      </>
    );
  }

  const isPersonal = !family;
  const hasPosts = feedPosts.length > 0;

  return (
    <>
      <HomeTopBar
        familyName={family?.name ?? null}
        userDisplayName={user?.displayName ?? null}
      />

      <div className="pt-1">
        <StoriesBar
          pets={pets}
          onComposerOpen={() => setComposerOpen(true)}
        />
      </div>

      {/* Personal-mode upsell (≥1 pet + no family) — inserted between
          stories and the feed so users always see it without scroll
          past their pets. */}
      {isPersonal && (
        <div className="mt-3">
          <InviteFamilyCard pet={pets[0]} />
        </div>
      )}

      <FeedSectionHeader />

      {hasPosts ? (
        <>
          <div className="flex flex-col gap-3">
            {user &&
              feedPosts.map((post) => (
                <PostCard
                  key={post.postId}
                  post={post}
                  currentUid={user.uid}
                  onDelete={() => handleDeletePost(post)}
                />
              ))}
          </div>
          {/* 「查看更多」CTA — even at exactly 10 posts we still link
              to the full archive because there could be more behind. */}
          <Link
            href="/app/feed"
            className="mt-4 inline-flex w-full items-center justify-center gap-1 rounded-full border border-mango-hairline bg-mango-card px-5 py-3 text-[13px] font-extrabold text-mango-brand-deep shadow-card transition-colors hover:bg-mango-bg-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
          >
            {tH("feed.viewAllLong")}
            <ChevronRight className="size-3.5" strokeWidth={2.4} />
          </Link>
        </>
      ) : (
        <NoPostsHint onCompose={() => setComposerOpen(true)} />
      )}

      <PostComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        pets={pets}
        onCreated={refresh}
      />
    </>
  );
}
