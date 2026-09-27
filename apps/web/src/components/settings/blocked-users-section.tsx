"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { UserX } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getAppUser, unblockUser } from "@/lib/firebase/users";
import type { AppUser } from "@/lib/types";

type Row = { uid: string; displayName: string; photoURL: string | null };

/**
 * Settings → "已封鎖的使用者" — lets the user see and undo who they've
 * blocked (users/{uid}.blockedUids). Without this the block action would
 * be a one-way door. Spec docs/features/ugc-moderation.md.
 */
export function BlockedUsersSection() {
  const t = useTranslations("Moderation");
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const me = await getAppUser(user.uid);
        const uids = me?.blockedUids ?? [];
        const profiles = await Promise.all(
          uids.map((uid) => getAppUser(uid).catch(() => null)),
        );
        if (cancelled) return;
        setRows(
          uids.map((uid, i) => {
            const p = profiles[i] as AppUser | null;
            return {
              uid,
              displayName: p?.displayName ?? uid,
              photoURL: p?.photoURL ?? null,
            };
          }),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleUnblock(uid: string) {
    if (!user || pendingUid) return;
    setPendingUid(uid);
    setError(null);
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.uid !== uid));
    try {
      await unblockUser(user.uid, uid);
    } catch {
      setRows(prev);
      setError(t("unblockFailed"));
    } finally {
      setPendingUid(null);
    }
  }

  if (loading) return null;
  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-md)] bg-mango-brand-tint text-mango-brand-deep">
            <UserX className="size-4" />
          </span>
          <p className="text-sm font-semibold">{t("blockedUsersTitle")}</p>
        </div>
        <p className="pl-12 text-xs text-mango-ink-2">{t("blockedUsersEmpty")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-md)] bg-mango-brand-tint text-mango-brand-deep">
          <UserX className="size-4" />
        </span>
        <p className="text-sm font-semibold">{t("blockedUsersTitle")}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.uid} className="flex items-center gap-3">
            <Avatar src={r.photoURL} name={r.displayName} size={32} />
            <p className="min-w-0 flex-1 truncate text-sm">{r.displayName}</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pendingUid === r.uid}
              onClick={() => handleUnblock(r.uid)}
            >
              {t("unblock")}
            </Button>
          </li>
        ))}
      </ul>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
