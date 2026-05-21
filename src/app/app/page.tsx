"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Bell, Newspaper, PawPrint, PenSquare, Plus } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/components/family/family-provider";
import { RouteHeader } from "@/components/nav/route-header";
import { Avatar } from "@/components/ui/avatar";
import { useConfirm } from "@/components/ui/confirm-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ReminderCard } from "@/components/reminders/reminder-card";
import { ReminderFormDialog } from "@/components/reminders/reminder-form-dialog";
import { PostCard } from "@/components/feed/post-card";
import { PostComposer } from "@/components/feed/post-composer";
import { listPets } from "@/lib/firebase/pets";
import {
  completeReminder,
  createReminder,
  deleteReminder,
  listOverdueReminders,
  listUpcomingReminders,
  updateReminder,
} from "@/lib/firebase/reminders";
import { deletePost, listFeedPosts } from "@/lib/firebase/posts";
import { listFriends } from "@/lib/firebase/friends";
import type { Pet, Post, Reminder, ReminderInput } from "@/lib/types";

export default function AppHome() {
  const tApp = useTranslations("App");
  const tNav = useTranslations("Nav");
  const tR = useTranslations("Reminder");
  const tPet = useTranslations("Pet");
  const tC = useTranslations("Common");
  const askConfirm = useConfirm();
  const { user } = useAuth();
  const { family, loading: familyLoading } = useFamily();

  const [pets, setPets] = useState<Pet[]>([]);
  const [upcoming, setUpcoming] = useState<Reminder[]>([]);
  const [overdue, setOverdue] = useState<Reminder[]>([]);
  const [feedPosts, setFeedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingReminder, setAddingReminder] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || !family) return;
    setLoading(true);
    try {
      const [petList, up, ov, friends] = await Promise.all([
        listPets(family.familyId),
        listUpcomingReminders(family.familyId),
        listOverdueReminders(family.familyId),
        listFriends(user.uid),
      ]);
      setPets(petList);
      setUpcoming(up);
      setOverdue(ov);
      const feed = await listFeedPosts(
        user.uid,
        friends.map((f) => f.uid),
        5,
      );
      setFeedPosts(feed.slice(0, 3));
    } finally {
      setLoading(false);
    }
  }, [user, family]);

  useEffect(() => {
    if (familyLoading) return;
    refresh();
  }, [familyLoading, refresh]);

  function petById(id?: string) {
    return id ? pets.find((p) => p.petId === id) : undefined;
  }

  async function handleAddReminder(input: ReminderInput) {
    if (!user || !family) return;
    await createReminder({
      ...input,
      familyId: family.familyId,
      createdByUid: user.uid,
    });
    await refresh();
  }

  async function handleUpdateReminder(input: ReminderInput) {
    if (!editingReminder) return;
    await updateReminder(editingReminder.reminderId, {
      title: input.title,
      description: input.description,
      petId: input.petId,
      triggerAt: input.triggerAt,
      repeat: input.repeat,
      notifyBeforeMinutes: input.notifyBeforeMinutes,
    });
    setEditingReminder(null);
    await refresh();
  }

  async function handleCompleteReminder(reminder: Reminder) {
    if (!user) return;
    await completeReminder(reminder, user.uid);
    await refresh();
  }

  async function handleDeleteReminder(reminder: Reminder) {
    const ok = await askConfirm({
      title: tC("delete"),
      message: reminder.title,
      confirmText: tC("delete"),
      cancelText: tC("cancel"),
      danger: true,
    });
    if (!ok) return;
    await deleteReminder(reminder.reminderId);
    await refresh();
  }

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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
            {tNav("pets")}
          </h2>
          <Link
            href="/app/pets"
            className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-300"
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
                className="group flex shrink-0 flex-col items-center gap-1.5 rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <Avatar
                  src={p.photoURL}
                  name={p.name}
                  size={64}
                  className="ring-2 ring-transparent group-hover:ring-emerald-400"
                />
                <span className="text-xs font-medium max-w-[64px] truncate">
                  {p.name}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 xl:row-span-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
            {tR("title")}
          </h2>
          <Button size="sm" onClick={() => setAddingReminder(true)}>
            <Plus className="size-4" />
            {tR("add")}
          </Button>
        </div>

        {overdue.length === 0 && upcoming.length === 0 ? (
          <EmptyState icon={Bell} title={tR("noReminders")} />
        ) : (
          <div className="flex flex-col gap-3">
            {overdue.length > 0 && (
              <>
                <p className="text-xs font-semibold text-red-600">
                  {tR("overdue")}
                </p>
                {overdue.map((r) => (
                  <ReminderCard
                    key={r.reminderId}
                    reminder={r}
                    pet={petById(r.petId)}
                    onComplete={() => handleCompleteReminder(r)}
                    onDelete={() => handleDeleteReminder(r)}
                    onEdit={() => setEditingReminder(r)}
                  />
                ))}
              </>
            )}
            {upcoming.length > 0 && (
              <>
                <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  {tR("upcoming")}
                </p>
                {upcoming.map((r) => (
                  <ReminderCard
                    key={r.reminderId}
                    reminder={r}
                    pet={petById(r.petId)}
                    onComplete={() => handleCompleteReminder(r)}
                    onDelete={() => handleDeleteReminder(r)}
                    onEdit={() => setEditingReminder(r)}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 xl:col-span-2">
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
              className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-300"
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
      </div>

      <ReminderFormDialog
        open={addingReminder}
        onClose={() => setAddingReminder(false)}
        pets={pets}
        onSubmit={handleAddReminder}
      />

      <ReminderFormDialog
        open={editingReminder !== null}
        onClose={() => setEditingReminder(null)}
        pets={pets}
        initial={editingReminder ?? undefined}
        onSubmit={handleUpdateReminder}
      />

      <PostComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        pets={pets}
        onCreated={refresh}
      />
    </>
  );
}
