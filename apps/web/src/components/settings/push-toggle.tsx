"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, BellOff, BellRing, Info, Send } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { getAppUser } from "@/lib/firebase/users";
import { Button } from "@/components/ui/button";
import {
  currentPermission,
  disablePush,
  enablePush,
  isPushSupported,
  reconcileCurrentToken,
  sendTestPush,
} from "@/lib/firebase/messaging";

type Status =
  | { kind: "checking" }
  | { kind: "unsupported" }
  | { kind: "disabled" }
  | { kind: "denied" }
  | { kind: "enabled"; token: string };

/** True for iOS Safari running in a regular browser tab (not added to home screen). */
function isIosBrowserNotPwa(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  if (!isIos) return false;
  // PWA on iOS: navigator.standalone === true
  const standalone =
    "standalone" in navigator &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return !standalone;
}

export function PushToggle() {
  const tP = useTranslations("Push");
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>({ kind: "checking" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

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
      if (perm === "granted") {
        // Respect an explicit "user turned push off" intent. Without this
        // the reconcile below re-mints a token on every Settings open
        // (OS permission stays "granted" after disable), so push could
        // never be turned off from the UI.
        const appUser = await getAppUser(user.uid);
        if (appUser?.pushPrefs?.globalDisabled) {
          if (!cancelled) setStatus({ kind: "disabled" });
          return;
        }
        // Don't trust `user.fcmTokens.length > 0` here — those tokens
        // could be from a sibling context (iOS Safari vs PWA install,
        // desktop Chrome vs Chrome PWA) that produced a different FCM
        // token from the one this context can actually receive. Mint
        // this context's token via getToken and arrayUnion it into the
        // persisted set; only declare "enabled" if we got a real token
        // back. Costs one extra ~1s network call per Settings open —
        // acceptable for a page the user visits infrequently. Backlog
        // entry "PushToggle probe 把跨 context 的 token 當「已啟用」".
        const token = await reconcileCurrentToken(user.uid);
        if (!cancelled) {
          setStatus(token ? { kind: "enabled", token } : { kind: "disabled" });
        }
        return;
      }
      // perm === "default" — user hasn't been asked yet
      if (!cancelled) setStatus({ kind: "disabled" });
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
      await disablePush(user.uid);
      setStatus({ kind: "disabled" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const res = await sendTestPush();
      if (res.ok && res.sent > 0) {
        setTestResult(
          res.failed > 0
            ? tP("testPartial", { sent: res.sent, failed: res.failed })
            : tP("testSent", { sent: res.sent }),
        );
      } else {
        setTestResult(tP("testFailed", { failed: res.failed }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : tP("testError"));
    } finally {
      setTesting(false);
    }
  }

  const showIosHint = isIosBrowserNotPwa() && status.kind !== "enabled";
  const isVapidMissingError = error?.includes("NEXT_PUBLIC_FIREBASE_VAPID_KEY");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
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
            <p className="text-xs leading-5 text-zinc-500">{tP(`status.${status.kind}`)}</p>
          </div>
        </div>

        {status.kind === "enabled" ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleTest}
              disabled={testing || busy}
            >
              <Send className="size-3.5" />
              {testing ? "..." : tP("test")}
            </Button>
            <Button size="sm" variant="secondary" onClick={handleDisable} disabled={busy || testing}>
              {busy ? "..." : tP("disable")}
            </Button>
          </div>
        ) : status.kind === "disabled" ? (
          <Button size="sm" onClick={handleEnable} disabled={busy}>
            {busy ? "..." : tP("enable")}
          </Button>
        ) : null}
      </div>

      {testResult && (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">
          {testResult}
        </p>
      )}

      {showIosHint && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          <Info className="size-4 shrink-0 mt-0.5" />
          <span>{tP("iosHint")}</span>
        </div>
      )}

      {isVapidMissingError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          <Info className="size-4 shrink-0 mt-0.5" />
          <span>{tP("vapidHint")}</span>
        </div>
      )}

      {error && !isVapidMissingError && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
