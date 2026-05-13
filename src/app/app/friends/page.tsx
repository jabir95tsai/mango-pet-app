"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, UserMinus, UserX, Users } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { RouteHeader } from "@/components/nav/route-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Tabs } from "@/components/ui/tabs";
import { FriendSearch } from "@/components/friends/friend-search";
import {
  acceptFriendRequest,
  listFriendRequests,
  listFriends,
  rejectFriendRequest,
  removeFriend,
} from "@/lib/firebase/friends";
import type { Friend, FriendRequest } from "@/lib/types";

type Tab = "friends" | "requests" | "search";

export default function FriendsPage() {
  const t = useTranslations("Nav");
  const tC = useTranslations("Common");
  const { user } = useAuth();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [tab, setTab] = useState<Tab>("friends");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [fs, rs] = await Promise.all([
        listFriends(user.uid),
        listFriendRequests(user.uid),
      ]);
      setFriends(fs);
      setRequests(rs);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const excludeUids = useMemo(() => {
    const s = new Set<string>(friends.map((f) => f.uid));
    for (const r of requests) s.add(r.fromUid);
    return s;
  }, [friends, requests]);

  async function handleAccept(fromUid: string) {
    setBusy(fromUid);
    setError(null);
    try {
      await acceptFriendRequest(fromUid);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Accept failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleReject(requestId: string) {
    if (!user) return;
    setBusy(requestId);
    try {
      await rejectFriendRequest(user.uid, requestId);
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove(friendUid: string) {
    if (!confirm(`${tC("delete")}?`)) return;
    setBusy(friendUid);
    setError(null);
    try {
      await removeFriend(friendUid);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <RouteHeader title={t("friends")} subtitle="加好友、看彼此的寵物動態" />

      <div className="mb-4">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "friends", label: `好友 (${friends.length})` },
            { value: "requests", label: `邀請 (${requests.length})` },
            { value: "search", label: "搜尋" },
          ]}
        />
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {tab === "friends" &&
        (loading ? (
          <p className="text-sm text-zinc-500">{tC("loading")}</p>
        ) : friends.length === 0 ? (
          <EmptyState
            icon={Users}
            title="尚未加任何好友"
            description="到「搜尋」分頁找飼主，互相加好友看彼此的動態。"
          />
        ) : (
          <div className="flex flex-col gap-3">
            {friends.map((f) => (
              <div
                key={f.uid}
                className="flex items-center gap-3 rounded-2xl border border-amber-200/60 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <Avatar src={f.photoURL} name={f.displayName} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{f.displayName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(f.uid)}
                  disabled={busy === f.uid}
                  aria-label={tC("delete")}
                  className="p-2 rounded-full hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                >
                  <UserMinus className="size-4" />
                </button>
              </div>
            ))}
          </div>
        ))}

      {tab === "requests" &&
        (loading ? (
          <p className="text-sm text-zinc-500">{tC("loading")}</p>
        ) : requests.length === 0 ? (
          <EmptyState icon={Users} title="尚無交友邀請" />
        ) : (
          <div className="flex flex-col gap-3">
            {requests.map((r) => (
              <div
                key={r.requestId}
                className="flex items-center gap-3 rounded-2xl border border-amber-200/60 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <Avatar src={r.fromPhotoURL} name={r.fromName} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{r.fromName}</p>
                  <p className="text-xs text-zinc-500">想加你為好友</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAccept(r.fromUid)}
                  disabled={busy === r.fromUid}
                  aria-label="accept"
                  className="p-2 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-400"
                >
                  <Check className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleReject(r.requestId)}
                  disabled={busy === r.requestId}
                  aria-label="reject"
                  className="p-2 rounded-full hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                >
                  <UserX className="size-4" />
                </button>
              </div>
            ))}
          </div>
        ))}

      {tab === "search" && <FriendSearch excludeUids={excludeUids} onSent={refresh} />}
    </>
  );
}
