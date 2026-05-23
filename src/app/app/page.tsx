"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Newspaper, PawPrint, PenSquare, Plus } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/components/family/family-provider";
import { RouteHeader } from "@/components/nav/route-header";
import { Avatar } from "@/components/ui/avatar";
import { useConfirm } from "@/components/ui/confirm-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/feed/post-card";
import { PostComposer } from "@/components/feed/post-composer";
import { listPersonalPets, listPets } from "@/lib/firebase/pets";
import { deletePost, listFeedPosts } from "@/lib/firebase/posts";
import { listFriends } from "@/lib/firebase/friends";
import type { Pet, Post } from "@/lib/types";

export default function AppHome() {
  const tApp = useTranslations("App");
  const tNav = useTranslations("Nav");
  const tPet = useTranslations("Pet");
  const tC = useTranslations("Common");
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
        const feed = await listFeedPosts(
          user.uid,
          friends.map((f) => f.uid),
          5,
        );
        setFeedPosts(feed.slice(0, 3));
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
    return <p className="text-sm text-zinc-500">{tC("loading")}</p>;
  }

  return (
    <>
      <RouteHeader title={`🥭 ${tApp("name")}`} subtitle={tApp("tagline")} />

      <section className="mb-6 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
            {tNav("pets")}
          </h2>
          <Link
            href="/app/pets"
            className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-300"
          >
            {tC("edit")} →
          </Link>
        </div>
        {pets.length === 0 ? (
          <EmptyState
            icon={PawPrint}
            title={tPet("noPets")}
            description="新增第一隻寵物開始紀錄。"
            action={
              <Link href="/app/pets">
                <Button size="sm">
                  <Plus className="size-4" />
                  {tPet("addPet")}
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
            {pets.map((p) => (
              <Link
                key={p.petId}
                href={`/app/pets/${p.petId}`}
                className="group flex shrink-0 flex-col items-center gap-1.5 rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <Avatar
                  src={p.photoURL}
                  name={p.name}
                  size={64}
                  className="ring-2 ring-transparent group-hover:ring-amber-400"
                />
                <span className="text-xs font-medium max-w-[64px] truncate">
                  {p.name}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
            {tNav("feed")}
          </h2>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setComposerOpen(true)}>
              <PenSquare className="size-4" />
              發文
            </Button>
            <Link
              href="/app/feed"
              className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-300"
            >
              更多 →
            </Link>
          </div>
        </div>

        {feedPosts.length === 0 ? (
          <EmptyState
            icon={Newspaper}
            title="尚無動態"
            description="發第一篇貼文，或等好友的公開動態。"
            action={
              <Button size="sm" onClick={() => setComposerOpen(true)}>
                <PenSquare className="size-4" />
                發文
              </Button>
            }
          />
        ) : (
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
        )}
      </section>

      <PostComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        pets={pets}
        onCreated={refresh}
      />
    </>
  );
}
