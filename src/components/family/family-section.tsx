"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Check,
  Copy,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/components/family/family-provider";
import { useConfirm } from "@/components/ui/confirm-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import {
  createFamily,
  joinFamilyByCode,
  leaveFamily,
  listFamilyMembers,
  regenerateInviteCode,
  removeMember,
} from "@/lib/firebase/families";
import type { Family, FamilyMember } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FamilySection() {
  const tC = useTranslations("Common");
  const { user } = useAuth();
  const { family, families, loading, refresh, switchFamily } = useFamily();
  const askConfirm = useConfirm();

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    if (!family) {
      setMembers([]);
      return;
    }
    setMembersLoading(true);
    try {
      const m = await listFamilyMembers(family);
      setMembers(m);
    } finally {
      setMembersLoading(false);
    }
  }, [family]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  async function handleCopyCode() {
    if (!family) return;
    try {
      await navigator.clipboard.writeText(family.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select-and-show. Most modern browsers grant clipboard
      // on user gesture so this rarely runs.
    }
  }

  async function handleRegen() {
    if (!family) return;
    const ok = await askConfirm({
      title: "重新產生邀請碼？",
      message: "舊的邀請碼會失效，已加入的成員不受影響。",
      confirmText: "重新產生",
      cancelText: tC("cancel"),
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await regenerateInviteCode(family.familyId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    if (!family) return;
    const ok = await askConfirm({
      title: "離開家庭？",
      message: `離開「${family.name}」之後就看不到這個家庭的寵物與紀錄了。`,
      confirmText: "離開",
      cancelText: tC("cancel"),
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await leaveFamily(family.familyId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveMember(memberUid: string, displayName: string) {
    if (!family) return;
    const ok = await askConfirm({
      title: "移除成員？",
      message: `從家庭中移除 ${displayName}？`,
      confirmText: "移除",
      cancelText: tC("cancel"),
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await removeMember(family.familyId, memberUid);
      await refresh();
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">{tC("loading")}</p>;
  }

  const isOwner = family?.ownerUid === user?.uid;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Users className="size-4" />
          </span>
          <div>
            <p className="font-medium text-sm">家庭</p>
            <p className="text-xs text-zinc-500">
              {family ? family.name : "尚未加入任何家庭"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setShowJoin(true)}>
            加入
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowCreate(true)}>
            <Plus className="size-3.5" />
            新建
          </Button>
        </div>
      </div>

      {/* Multi-family switcher (only shown if user belongs to more than one). */}
      {families.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {families.map((f) => (
            <button
              key={f.familyId}
              type="button"
              onClick={() => switchFamily(f.familyId)}
              className={cn(
                "rounded-full px-3 h-7 text-xs font-medium transition-colors",
                f.familyId === family?.familyId
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400",
              )}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}

      {family && (
        <>
          {/* Invite code */}
          <div className="flex flex-col gap-2 rounded-lg bg-amber-50 p-3 dark:bg-amber-500/10">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-amber-800 dark:text-amber-300">邀請碼</p>
                <p className="font-mono text-2xl font-bold tracking-widest tabular-nums text-amber-900 dark:text-amber-200">
                  {family.inviteCode}
                </p>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="grid size-9 place-items-center rounded-lg bg-white text-amber-700 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300"
                  aria-label="複製邀請碼"
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </button>
                {isOwner && (
                  <button
                    type="button"
                    onClick={handleRegen}
                    disabled={busy}
                    className="grid size-9 place-items-center rounded-lg bg-white text-amber-700 hover:bg-amber-100 disabled:opacity-50 dark:bg-amber-950 dark:text-amber-300"
                    aria-label="重新產生邀請碼"
                  >
                    <RefreshCw className={cn("size-4", busy && "animate-spin")} />
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
              請家人輸入這 6 位數字加入家庭，所有寵物紀錄都會共用。
            </p>
          </div>

          {/* Members list */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              成員 ({members.length})
            </p>
            {membersLoading ? (
              <p className="text-xs text-zinc-500">{tC("loading")}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {members.map((m) => (
                  <li
                    key={m.uid}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <Avatar src={m.photoURL} name={m.displayName} size={36} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {m.displayName}
                        {m.uid === family.ownerUid && (
                          <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                            擁有者
                          </span>
                        )}
                        {m.uid === user?.uid && (
                          <span className="ml-1.5 text-xs text-zinc-500">(你)</span>
                        )}
                      </p>
                    </div>
                    {isOwner && m.uid !== user?.uid && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m.uid, m.displayName)}
                        disabled={busy}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950"
                        aria-label="移除成員"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Leave family */}
          <button
            type="button"
            onClick={handleLeave}
            disabled={busy}
            className="self-start inline-flex items-center gap-1.5 rounded-lg px-3 h-9 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950"
          >
            <LogOut className="size-4" />
            離開家庭
          </button>
        </>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <CreateFamilyDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={refresh}
      />
      <JoinFamilyDialog
        open={showJoin}
        onClose={() => setShowJoin(false)}
        onJoined={refresh}
      />
    </div>
  );
}

function CreateFamilyDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const tC = useTranslations("Common");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createFamily(name.trim() || "我的家庭");
      await onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="新建家庭">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          建立一個新家庭，把家人加進來一起照顧寵物。
        </p>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            家庭名稱
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：芒果家"
            maxLength={40}
            autoFocus
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            {tC("cancel")}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "..." : "建立"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function JoinFamilyDialog({
  open,
  onClose,
  onJoined,
}: {
  open: boolean;
  onClose: () => void;
  onJoined: () => Promise<void>;
}) {
  const tC = useTranslations("Common");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCode("");
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError("邀請碼必須是 6 位數字");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await joinFamilyByCode(trimmed);
      if (res.alreadyMember) {
        setError("你已經是這個家庭的成員了");
        setBusy(false);
        return;
      }
      await onJoined();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="加入家庭">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          輸入家人分享的 6 位數邀請碼。
        </p>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="123456"
          inputMode="numeric"
          maxLength={6}
          autoFocus
          className="font-mono text-2xl text-center tracking-widest tabular-nums"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            {tC("cancel")}
          </Button>
          <Button type="submit" disabled={busy || code.length !== 6}>
            {busy ? "..." : "加入"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// Also export the dialogs for use in other entry points if needed
export { CreateFamilyDialog, JoinFamilyDialog };

// Quiet pencil import (kept for future "rename family" feature)
void Pencil;
