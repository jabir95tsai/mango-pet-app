"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, BellOff, BellRing } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import {
  currentPermission,
  disablePush,
  enablePush,
  isPushSupported,
} from "@/lib/firebase/messaging";
import { getAppUser } from "@/lib/firebase/users";

type Status =
  | { kind: "checking" }
  | { kind: "unsupported" }
  | { kind: "disabled" }
  | { kind: "denied" }
  | { kind: "enabled"; token: string };

export function PushToggle() {
  const tP = useTranslations("Push");
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>({ kind: "checking" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function probe() {
      if (!user) return;
      if (!(await isPushSupported())) {
        if (!cancelled) setStatus({ kind: "unsupported" });
        return;
      }
      const perm = currentPermission();
      if (perm === "denied") {
        if (!cancelled) setStatus({ kind: "denied" });
        return;
      }
      const appUser = await getAppUser(user.uid);
      const tokens = appUser?.fcmTokens ?? [];
      if (perm === "granted" && tokens.length > 0) {
        if (!cancelled) setStatus({ kind: "enabled", token: tokens[0] });
      } else {
        if (!cancelled) setStatus({ kind: "disabled" });
      }
    }

    probe();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleEnable() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const result = await enablePush(user.uid);
      if (result) {
        setStatus({ kind: "enabled", token: result.token });
      } else {
        setStatus({ kind: "disabled" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      if (msg.includes("denied")) setStatus({ kind: "denied" });
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    if (!user || status.kind !== "enabled") return;
    setBusy(true);
    setError(null);
    try {
      await disablePush(user.uid, status.token);
      setStatus({ kind: "disabled" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="size-9 grid place-items-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/20 shrink-0">
          {status.kind === "enabled" ? (
            <BellRing className="size-4" />
          ) : status.kind === "denied" || status.kind === "unsupported" ? (
            <BellOff className="size-4" />
          ) : (
            <Bell className="size-4" />
          )}
        </span>
        <div className="min-w-0">
          <p className="font-medium text-sm">{tP("title")}</p>
          <p className="text-xs text-zinc-500 truncate">{tP(`status.${status.kind}`)}</p>
        </div>
      </div>

      {status.kind === "enabled" ? (
        <Button size="sm" variant="secondary" onClick={handleDisable} disabled={busy}>
          {busy ? "..." : tP("disable")}
        </Button>
      ) : status.kind === "disabled" ? (
        <Button size="sm" onClick={handleEnable} disabled={busy}>
          {busy ? "..." : tP("enable")}
        </Button>
      ) : null}

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
