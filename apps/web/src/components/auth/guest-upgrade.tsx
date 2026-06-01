"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { FirebaseError } from "firebase/app";
import { Lock, ShieldCheck } from "lucide-react";
import {
  upgradeGuestWithProvider,
  type AuthProviderKind,
} from "@/lib/firebase/auth";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────
// Context — a single app-wide upgrade dialog any CTA can open. Keeps the
// linkWithCredential flow in one place so the feed gate, settings entry,
// nudge banner, etc. all share identical conflict handling. Spec
// docs/features/guest-login.md §E.
// ────────────────────────────────────────────────────────────────────

type GuestUpgradeContextValue = {
  /** Open the "bind your account" dialog from anywhere. */
  openUpgrade: () => void;
};

const GuestUpgradeContext = createContext<GuestUpgradeContextValue>({
  openUpgrade: () => {},
});

export function useGuestUpgrade() {
  return useContext(GuestUpgradeContext);
}

export function GuestUpgradeProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openUpgrade = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ openUpgrade }), [openUpgrade]);

  return (
    <GuestUpgradeContext.Provider value={value}>
      {children}
      <UpgradeAccountDialog open={open} onClose={() => setOpen(false)} />
    </GuestUpgradeContext.Provider>
  );
}

// ────────────────────────────────────────────────────────────────────
// Upgrade dialog — Google / Apple bind buttons. On `linked` the same uid
// keeps all guest data and `upsertUser` clears the guest flag on the next
// auth-state callback (community unlocks automatically). On `switched`
// (account already existed) we surface the "logged into the existing
// account, guest data not merged" notice. Facebook is intentionally NOT
// offered here — keep the upgrade path to the two primary providers.
// ────────────────────────────────────────────────────────────────────

const UPGRADE_PROVIDERS: { kind: AuthProviderKind; labelKey: string }[] = [
  { kind: "google", labelKey: "withGoogle" },
  { kind: "apple", labelKey: "withApple" },
];

function friendlyUpgradeError(err: unknown, t: (k: string) => string): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "auth/popup-closed-by-user":
      case "auth/cancelled-popup-request":
        return t("errors.cancelled");
      case "auth/popup-blocked":
        return t("errors.popupBlocked");
      case "auth/network-request-failed":
        return t("errors.network");
      default:
        return t("errors.generic");
    }
  }
  return t("errors.generic");
}

function UpgradeAccountDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("Guest.upgrade");
  const [pending, setPending] = useState<AuthProviderKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  // When the chosen account already existed we switch into it (no merge).
  const [switched, setSwitched] = useState(false);

  async function handleUpgrade(kind: AuthProviderKind) {
    setPending(kind);
    setError(null);
    try {
      const result = await upgradeGuestWithProvider(kind);
      if (result.status === "switched") {
        // Existing account — show the no-merge notice, don't reload yet.
        setSwitched(true);
        setPending(null);
      } else {
        // Linked: same uid, data preserved. `linkWithPopup` does NOT fire
        // onAuthStateChanged (the uid is unchanged) and the Firebase User is
        // mutated in place, so the React tree won't see isGuest flip on its
        // own. A full reload re-runs the auth-state callback against the
        // now-non-anonymous user → upsertUser de-flags the profile and every
        // guest gate re-evaluates unlocked. Spec §E. Keep `pending` set so
        // the buttons stay disabled through the reload.
        reloadApp();
      }
    } catch (err) {
      setError(friendlyUpgradeError(err, t));
      setPending(null);
    }
  }

  /** Wrapped so it's easy to stub in non-browser contexts; in practice this
   *  always runs client-side from a user gesture. */
  function reloadApp() {
    if (typeof window !== "undefined") window.location.reload();
  }

  function handleClose() {
    setSwitched(false);
    setError(null);
    onClose();
  }

  // After the conflict ("switched") path the user is now signed into the
  // pre-existing account; reload so providers/feed re-init under the real
  // uid and the guest gates clear.
  function handleSwitchedAck() {
    reloadApp();
  }

  return (
    <Dialog open={open} onClose={handleClose} title={t("title")}>
      {switched ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {t("conflictBody")}
          </p>
          <button
            type="button"
            onClick={handleSwitchedAck}
            className="h-11 w-full rounded-lg bg-mango-brand text-sm font-semibold text-white transition-colors hover:bg-mango-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t("conflictAck")}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-mango-brand-tint text-mango-brand-deep">
              <ShieldCheck className="size-5" />
            </span>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {t("body")}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {UPGRADE_PROVIDERS.map((p) => (
              <button
                key={p.kind}
                type="button"
                onClick={() => handleUpgrade(p.kind)}
                disabled={pending !== null}
                className={cn(
                  "flex h-12 items-center justify-center gap-3 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60",
                  p.kind === "google"
                    ? "bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
                    : "bg-black text-white hover:bg-zinc-800",
                )}
              >
                {pending === p.kind ? (
                  <span aria-hidden="true">…</span>
                ) : (
                  <span>{t(p.labelKey)}</span>
                )}
              </button>
            ))}
          </div>

          {error && (
            <p className="text-center text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────────────
// Reusable inline "this needs a real account" notice + upgrade CTA.
// Drop in wherever a community surface is hidden for guests. Spec §C.
// ────────────────────────────────────────────────────────────────────

export function GuestLockedNotice({
  feature,
  className,
}: {
  /** Picks the explanatory line: `Guest.locked.<feature>`. */
  feature: "post" | "reactions" | "friends" | "family";
  className?: string;
}) {
  const t = useTranslations("Guest");
  const { openUpgrade } = useGuestUpgrade();

  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-lg border border-amber-200/70 bg-amber-50 p-4 text-sm dark:border-amber-500/30 dark:bg-amber-500/10 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{t(`locked.${feature}`)}</span>
      </div>
      <button
        type="button"
        onClick={openUpgrade}
        className="h-9 shrink-0 rounded-lg bg-mango-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-mango-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {t("upgradeCta")}
      </button>
    </div>
  );
}
