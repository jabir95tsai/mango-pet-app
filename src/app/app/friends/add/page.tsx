"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Check, UserPlus, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { RouteHeader } from "@/components/nav/route-header";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { doc, getDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase/config";
import { sendFriendRequest } from "@/lib/firebase/friends";
import type { AppUser } from "@/lib/types";

/** Landing page for QR-code friend invites. The QR encodes
 *  /app/friends/add?uid={targetUid}; we look up the target's public
 *  profile, show a confirm card, then fire sendFriendRequest. */
export default function AddFriendPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const tC = useTranslations("Common");

  const targetUid = params.get("uid") ?? "";
  const [target, setTarget] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "self" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetUid) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const snap = await getDoc(doc(getDb(), "users", targetUid));
        if (snap.exists()) setTarget(snap.data() as AppUser);
      } finally {
        setLoading(false);
      }
    })();
  }, [targetUid]);

  // If the user lands here logged out, we just show the profile; they'll
  // need to sign in then re-tap the invite. (Auth flow doesn't preserve
  // query params, so retrying after login is the simplest UX.)

  async function handleAdd() {
    if (!user || !target) return;
    if (user.uid === target.uid) {
      setStatus("self");
      return;
    }
    setStatus("sending");
    setError(null);
    try {
      await sendFriendRequest(
        {
          uid: user.uid,
          displayName: user.displayName ?? "Friend",
          photoURL: user.photoURL,
        },
        target.uid,
      );
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "邀請失敗");
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => router.push("/app/friends")}
          className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label={tC("back")}
        >
          <ArrowLeft className="size-5" />
        </button>
      </div>

      <RouteHeader title="加好友" subtitle="掃 QR 來的邀請" />

      {!targetUid || loading ? (
        <p className="text-sm text-zinc-500">{tC("loading")}</p>
      ) : !target ? (
        <EmptyState
          icon={X}
          title="找不到使用者"
          description="這個邀請連結可能失效，或對方還沒登入過 App。"
          action={
            <Button
              variant="secondary"
              onClick={() => router.push("/app/friends")}
            >
              {tC("back")}
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-zinc-200/80 bg-white p-6 shadow-sm shadow-zinc-200/40 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
          <Avatar src={target.photoURL} name={target.displayName} size={96} />
          <div className="text-center">
            <p className="text-lg font-semibold">{target.displayName}</p>
            {target.city && (
              <p className="text-xs text-zinc-500">{target.city}</p>
            )}
          </div>

          {status === "sent" ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Check className="size-4" />
              已送出邀請，等對方接受
            </div>
          ) : status === "self" ? (
            <p className="text-sm text-amber-600">
              這是你自己的 QR code 喔
            </p>
          ) : (
            <Button
              onClick={handleAdd}
              disabled={!user || status === "sending"}
              size="lg"
              className="w-full"
            >
              <UserPlus className="size-4" />
              {status === "sending" ? "送出中…" : "送出好友邀請"}
            </Button>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          {!user && (
            <p className="text-xs text-zinc-500 text-center">
              請先登入才能送出邀請。
            </p>
          )}
        </div>
      )}
    </>
  );
}
