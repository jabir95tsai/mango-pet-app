"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Newspaper, PenSquare } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { RouteHeader } from "@/components/nav/route-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import { PostComposer } from "@/components/feed/post-composer";
import { PostCard } from "@/components/feed/post-card";
import { deletePost, listFeedPosts } from "@/lib/firebase/posts";
import { listPets } from "@/lib/firebase/pets";
import { listFriends } from "@/lib/firebase/friends";
import type { Pet, Post } from "@/lib/types";

export default function FeedPage() {
  const t = useTranslations("Nav");
  const tCommon = useTranslations("Common");
  const askConfirm = useConfirm();
  const { user } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [myPets, friends] = await Promise.all([
        listPets(user.uid),
        listFriends(user.uid),
      ]);
      const feed = await listFeedPosts(
        user.uid,
        friends.map((f) => f.uid),
      );
      setPosts(feed);
      setPets(myPets);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleDelete(post: Post) {
    const ok = await askConfirm({
      title: tCommon("delete"),
      message: post.text ? post.text.slice(0, 80) : "貼文",
      confirmText: tCommon("delete"),
      cancelText: tCommon("cancel"),
      danger: true,
    });
    if (!ok) return;
    await deletePost(post.postId);
    await refresh();
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <RouteHeader
          title={t("feed")}
          subtitle="好友與公開動態"
          className="mb-0"
        />
        <Button
          onClick={() => setComposerOpen(true)}
          size="md"
          className="w-full sm:w-auto"
        >
          <PenSquare className="size-4" />
          發文
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">{tCommon("loading")}</p>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title="尚無動態"
          description="發第一篇貼文，或等好友的公開動態。"
          action={
            <Button onClick={() => setComposerOpen(true)} size="md">
              <PenSquare className="size-4" />
              發文
            </Button>
          }
        />
      ) : (
        <div className="flex max-w-2xl flex-col gap-3">
          {user &&
            posts.map((post) => (
              <PostCard
                key={post.postId}
                post={post}
                currentUid={user.uid}
                onDelete={() => handleDelete(post)}
              />
            ))}
        </div>
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
