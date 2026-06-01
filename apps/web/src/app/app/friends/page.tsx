"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, QrCode, UserMinus, UserX, Users } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { GuestLockedNotice } from "@/components/auth/guest-upgrade";
import { RouteHeader } from "@/components/nav/route-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Tabs } from "@/components/ui/tabs";
import { useConfirm } from "@/components/ui/confirm-provider";
import { FriendSearch } from "@/components/friends/friend-search";
import { MyQrDialog } from "@/components/friends/my-qr-dialog";
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
  const tF = useTranslations("Friends");
  const askConfirm = useConfirm();
  const { user, isGuest } = useAuth();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [tab, setTab] = useState<Tab>("friends");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

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
    const friend = friends.find((f) => f.uid === friendUid);
    const ok = await askConfirm({
      title: tC("delete"),
      message: friend?.displayName ?? tF("removeConfirm"),
      confirmText: tC("delete"),
      cancelText: tC("cancel"),
      danger: true,
    });
    if (!ok) return;
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <RouteHeader
          title={t("friends")}
          subtitle={tF("subtitle")}
          className="mb-0"
        />
        {!isGuest && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setQrOpen(true)}
            disabled={!user}
          >
            <QrCode className="size-4" />
            {tF("myQr")}
          </Button>
        )}
      </div>

      {/* Friends are community — gated for guests. They get an upgrade
          prompt in place of the whole friends surface. Spec §C. */}
      {isGuest && <GuestLockedNotice feature="friends" />}

      {!isGuest && (
      <>
      <div className="mb-4">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "friends", label: tF("tabs.friends", { count: friends.length }) },
            { value: "requests", label: tF("tabs.requests", { count: requests.length }) },
            { value: "search", label: tF("tabs.search") },
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
            title={tF("emptyFriends.title")}
            description={tF("emptyFriends.subtitle")}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {friends.map((f) => (
              <div
                key={f.uid}
                className="flex items-center gap-3 rounded-lg border border-zinc-200/80 bg-white p-3 shadow-sm shadow-zinc-200/40 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none"
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
                  className="rounded-lg p-2 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
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
          <EmptyState icon={Users} title={tF("emptyRequests")} />
        ) : (
          <div className="flex flex-col gap-3">
            {requests.map((r) => (
              <div
                key={r.requestId}
                className="flex items-center gap-3 rounded-lg border border-zinc-200/80 bg-white p-3 shadow-sm shadow-zinc-200/40 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none"
              >
                <Avatar src={r.fromPhotoURL} name={r.fromName} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{r.fromName}</p>
                  <p className="text-xs text-zinc-500">{tF("wantsToAdd")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAccept(r.fromUid)}
                  disabled={busy === r.fromUid}
                  aria-label={tF("accept")}
                  className="rounded-lg bg-emerald-100 p-2 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-400"
                >
                  <Check className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleReject(r.requestId)}
                  disabled={busy === r.requestId}
                  aria-label={tF("reject")}
                  className="rounded-lg p-2 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                >
                  <UserX className="size-4" />
                </button>
              </div>
            ))}
          </div>
        ))}

      {tab === "search" && <FriendSearch excludeUids={excludeUids} onSent={refresh} />}
      </>
      )}

      <MyQrDialog open={qrOpen} onClose={() => setQrOpen(false)} />
    </>
  );
}
