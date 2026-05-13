"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Search, UserPlus } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchUsers, sendFriendRequest } from "@/lib/firebase/friends";
import type { AppUser } from "@/lib/types";

type Props = {
  excludeUids: Set<string>;
  onSent: () => void;
};

export function FriendSearch({ excludeUids, onSent }: Props) {
  const tC = useTranslations("Common");
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AppUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setError(null);
    try {
      const found = await searchUsers(q);
      setResults(found.filter((u) => u.uid !== user?.uid));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function handleSend(to: AppUser) {
    if (!user) return;
    setSending(to.uid);
    setError(null);
    try {
      await sendFriendRequest(
        {
          uid: user.uid,
          displayName: user.displayName ?? "Friend",
          photoURL: user.photoURL,
        },
        to.uid,
      );
      setSentTo(new Set([...sentTo, to.uid]));
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(null);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Email 或暱稱"
        />
        <Button type="submit" disabled={searching}>
          <Search className="size-4" />
        </Button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {results.length > 0 && (
        <div className="flex flex-col gap-2">
          {results.map((u) => {
            const already = excludeUids.has(u.uid);
            const sent = sentTo.has(u.uid);
            return (
              <div
                key={u.uid}
                className="flex items-center gap-3 rounded-2xl border border-amber-200/60 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <Avatar src={u.photoURL} name={u.displayName} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{u.displayName}</p>
                  {u.email && (
                    <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={already || sent ? "ghost" : "primary"}
                  disabled={already || sent || sending === u.uid}
                  onClick={() => handleSend(u)}
                >
                  {already ? "已是好友" : sent ? "已送出" : (
                    <>
                      <UserPlus className="size-3.5" />
                      加好友
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {results.length === 0 && q && !searching && (
        <p className="text-sm text-zinc-500 text-center py-3">{tC("none")}</p>
      )}
    </section>
  );
}
