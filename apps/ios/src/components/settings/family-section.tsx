/**
 * Family card — 1:1 with web apps/web/src/components/family/family-section.tsx
 * (the single family surface: settings renders it inline, /family wraps it
 * in a back-header screen).
 *
 *  - guests: the GuestLockedNotice (family needs a real identity)
 *  - header: Users disc + 家庭 + family name / personal mode, ghost 加入 +
 *    secondary "+ 新建"
 *  - personal mode: info box; scope read failure: error + retry (R08)
 *  - ≥2 families: switch pills (active = solid brand + white)
 *  - invite card: code + Share / Copy (icon swaps to Check for 2s) / owner
 *    regen (spinner while busy) [+ iOS QR when `showQr`]
 *  - members ("loading…" while fetched), owner pill badge, "you", owner-only
 *    X remove; red LogOut "leave"
 *  - errors inline in red under the card (web), never a native alert
 *  - after create / join → the import wizard, then refresh
 *
 * Every mutation calls the same families-write callables web uses.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Check, Copy, LogOut, Plus, QrCode, RefreshCw, Share2, Users, X } from "lucide-react-native";
import type { Family, FamilyMember } from "@mango/shared-types";

import { useAuth } from "@/state/auth-context";
import { useFamily } from "@/state/family-context";
import { listFamilyMembers } from "@/lib/families-read";
import { leaveFamily, regenerateInviteCode, removeFamilyMember } from "@/lib/families-write";
import { UserAvatar } from "@/components/feed/user-avatar";
import { GuestLockedNotice } from "@/components/auth/guest-upgrade";
import { CreateFamilyDialog, JoinFamilyDialog } from "@/components/family/family-dialogs";
import { ImportWizardSheet } from "@/components/family/import-wizard-sheet";
import { InviteQR } from "@/components/family/invite-qr";
import { Button } from "@/components/ui/Button";
import { confirm } from "@/lib/confirm";
import { SITE_URL } from "@/lib/config";
import { t } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { colors, radius, spacing } from "@/theme/theme";
import { SettingsCard, SettingsIconDisc, settingsText } from "./settings-card";

function messageOf(err: unknown): string {
  return err instanceof Error && err.message ? err.message : t("Family.actionFailed");
}

export function FamilySection({
  reloadKey = 0,
  showQr = false,
}: {
  /** Bumped by the screen on focus / pull-to-refresh (re-reads members). */
  reloadKey?: number;
  /** iOS: add a QR action to the invite-code row (the /family screen). */
  showQr?: boolean;
}) {
  const { user, isGuest } = useAuth();
  const reduceMotion = useReducedMotion();
  const {
    family,
    families,
    loading,
    status: familyStatus,
    refresh,
    switchFamily,
    switchingFamilyId,
  } = useFamily();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [pendingImportFamilyId, setPendingImportFamilyId] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const loadMembers = useCallback(async (fam: Family | null) => {
    if (!fam) {
      setMembers([]);
      return;
    }
    setMembersLoading(true);
    try {
      setMembers(await listFamilyMembers(fam));
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isGuest) void loadMembers(family);
  }, [family, loadMembers, reloadKey, isGuest]);

  if (isGuest) {
    return (
      <SettingsCard>
        <GuestLockedNotice feature="family" />
      </SettingsCard>
    );
  }

  const isOwner = !!family && !!user && family.ownerUid === user.uid;
  const inviteUrl = family ? `${SITE_URL}/join/${family.inviteCode}` : "";

  function flash(set: (v: boolean) => void) {
    set(true);
    timers.current.push(setTimeout(() => set(false), 2000));
  }

  async function onSwitchFamily(familyId: string) {
    setError(null);
    try {
      await switchFamily(familyId);
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function copyCode() {
    if (!family) return;
    try {
      await Clipboard.setStringAsync(family.inviteCode);
      flash(setCopied);
    } catch {
      /* clipboard unavailable — nothing to show (web) */
    }
  }

  async function shareInvite() {
    if (!family) return;
    try {
      // The text template already embeds the URL — one message, not two.
      const res = await Share.share({
        message: t("Family.invite.text", { name: family.name, url: inviteUrl }),
      });
      if (res.action === Share.sharedAction) flash(setShared);
    } catch {
      /* dismissed */
    }
  }

  async function handleRegen() {
    if (!family || busy) return;
    const ok = await confirm({
      title: t("Family.regenConfirm.title"),
      message: t("Family.regenConfirm.message"),
      confirmLabel: t("Family.regenConfirm.confirm"),
      cancelLabel: t("Common.cancel"),
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await regenerateInviteCode(family.familyId);
      await refresh();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    if (!family || busy) return;
    const ok = await confirm({
      title: t("Family.leaveConfirm.title"),
      message: t("Family.leaveConfirm.message", { name: family.name }),
      confirmLabel: t("Family.leaveConfirm.confirm"),
      cancelLabel: t("Common.cancel"),
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await leaveFamily(family.familyId);
      await refresh();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(m: FamilyMember) {
    if (!family || busy) return;
    const ok = await confirm({
      title: t("Family.removeConfirm.title"),
      message: t("Family.removeConfirm.message", { name: m.displayName }),
      confirmLabel: t("Family.removeConfirm.confirm"),
      cancelLabel: t("Common.cancel"),
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await removeFamilyMember(family.familyId, m.uid);
      await refresh();
      await loadMembers(family);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreatedOrJoined(familyId: string) {
    await refresh();
    setPendingImportFamilyId(familyId);
  }

  return (
    <SettingsCard style={styles.card}>
      {/* Header: icon + title/name + join/create */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <SettingsIconDisc>
            <Users size={16} color={colors.brandDeep} strokeWidth={2} />
          </SettingsIconDisc>
          <View style={styles.flexShrink}>
            <Text style={settingsText.title}>{t("Family.title")}</Text>
            <Text style={settingsText.sub} numberOfLines={1}>
              {family ? family.name : t("Family.personalMode")}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Button label={t("Family.join")} variant="ghost" size="sm" onPress={() => setJoinOpen(true)} />
          <Button
            label={t("Family.create")}
            variant="secondary"
            size="sm"
            icon={<Plus size={14} color={colors.ink} strokeWidth={2.5} />}
            onPress={() => setCreateOpen(true)}
          />
        </View>
      </View>

      {loading ? (
        <Text style={settingsText.sub}>{t("Common.loading")}</Text>
      ) : !family && familyStatus === "error" ? (
        // Scope read failed: NOT personal mode — offer a retry only (R08).
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>{t("Error.title")}</Text>
          <Button
            label={t("Error.retry")}
            variant="secondary"
            size="sm"
            onPress={() => void refresh()}
            style={styles.retry}
          />
        </View>
      ) : (
        <>
          {!family ? (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>{t("Family.personalInfo")}</Text>
            </View>
          ) : null}

          {families.length > 1 ? (
            <View style={styles.switcher}>
              {families.map((f) => {
                const on = f.familyId === family?.familyId;
                return (
                  <Pressable
                    key={f.familyId}
                    onPress={() => void onSwitchFamily(f.familyId)}
                    disabled={switchingFamilyId !== null}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: on,
                      busy: switchingFamilyId === f.familyId,
                      disabled: switchingFamilyId !== null,
                    }}
                    style={({ pressed }) => [
                      styles.switchPill,
                      on && styles.switchPillOn,
                      pressed && !on && styles.switchPillPressed,
                    ]}
                  >
                    <Text style={[styles.switchText, on && styles.switchTextOn]}>{f.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {family ? (
            <>
              {/* Invite code */}
              <View style={styles.codeCard}>
                <View style={styles.codeTop}>
                  <View style={styles.flexShrink}>
                    <Text style={styles.codeLabel}>{t("Family.inviteCode")}</Text>
                    <Text style={styles.code}>{family.inviteCode}</Text>
                  </View>
                  <View style={styles.codeActions}>
                    <Pressable
                      onPress={() => void shareInvite()}
                      style={({ pressed }) => [styles.codeBtn, pressed && styles.codeBtnPressed]}
                      accessibilityRole="button"
                      accessibilityLabel={t("Family.invite.shareAria")}
                    >
                      {shared ? (
                        <Check size={16} color={colors.brandDeep} strokeWidth={2} />
                      ) : (
                        <Share2 size={16} color={colors.brandDeep} strokeWidth={2} />
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => void copyCode()}
                      style={({ pressed }) => [styles.codeBtn, pressed && styles.codeBtnPressed]}
                      accessibilityRole="button"
                      accessibilityLabel={t("Family.copyCode")}
                    >
                      {copied ? (
                        <Check size={16} color={colors.brandDeep} strokeWidth={2} />
                      ) : (
                        <Copy size={16} color={colors.brandDeep} strokeWidth={2} />
                      )}
                    </Pressable>
                    {showQr ? (
                      <Pressable
                        onPress={() => setQrOpen(true)}
                        style={({ pressed }) => [styles.codeBtn, pressed && styles.codeBtnPressed]}
                        accessibilityRole="button"
                        accessibilityLabel="QR"
                      >
                        <QrCode size={16} color={colors.brandDeep} strokeWidth={2} />
                      </Pressable>
                    ) : null}
                    {isOwner ? (
                      <Pressable
                        onPress={() => void handleRegen()}
                        disabled={busy}
                        style={({ pressed }) => [
                          styles.codeBtn,
                          pressed && styles.codeBtnPressed,
                          busy && styles.disabled,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={t("Family.regenCode")}
                        accessibilityState={{ busy, disabled: busy }}
                      >
                        {busy ? (
                          <ActivityIndicator size="small" color={colors.brandDeep} />
                        ) : (
                          <RefreshCw size={16} color={colors.brandDeep} strokeWidth={2} />
                        )}
                      </Pressable>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.codeHelp}>{t("Family.inviteHelp")}</Text>
              </View>

              {/* Members */}
              <View style={styles.membersBlock}>
                <Text style={styles.membersLabel}>
                  {t("Family.members", { count: members.length })}
                </Text>
                {membersLoading ? (
                  <Text style={settingsText.sub}>{t("Common.loading")}</Text>
                ) : (
                  members.map((m) => {
                    const memberIsOwner = m.uid === family.ownerUid;
                    const isMe = m.uid === user?.uid;
                    return (
                      <View key={m.uid} style={styles.memberRow}>
                        <UserAvatar name={m.displayName} photoURL={m.photoURL} size={36} />
                        <View style={styles.memberBody}>
                          <Text style={styles.memberName} numberOfLines={1}>
                            {m.displayName}
                          </Text>
                          {memberIsOwner ? (
                            <View style={styles.ownerBadge}>
                              <Text style={styles.ownerText}>{t("Family.owner")}</Text>
                            </View>
                          ) : null}
                          {isMe ? <Text style={styles.youTag}>{t("Family.you")}</Text> : null}
                        </View>
                        {isOwner && !isMe ? (
                          <Pressable
                            onPress={() => void handleRemove(m)}
                            disabled={busy}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={`${t("Family.removeMember")} ${m.displayName}`}
                            style={({ pressed }) => [styles.removeBtn, pressed && styles.removePressed]}
                          >
                            <X size={16} color={colors.ink3} strokeWidth={2} />
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })
                )}
              </View>

              {/* Leave */}
              <Pressable
                onPress={() => void handleLeave()}
                disabled={busy}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.leaveBtn,
                  pressed && styles.leavePressed,
                  busy && styles.disabled,
                ]}
              >
                <LogOut size={16} color={colors.danger} strokeWidth={2} />
                <Text style={styles.leaveText}>{t("Family.leave")}</Text>
              </Pressable>
            </>
          ) : null}
        </>
      )}

      {error ? (
        <Text style={settingsText.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <CreateFamilyDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onDone={handleCreatedOrJoined}
      />
      <JoinFamilyDialog
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        onDone={handleCreatedOrJoined}
      />
      {pendingImportFamilyId ? (
        <ImportWizardSheet
          familyId={pendingImportFamilyId}
          onClose={() => {
            setPendingImportFamilyId(null);
            void refresh();
          }}
        />
      ) : null}

      {showQr && family ? (
        <Modal
          visible={qrOpen}
          transparent
          animationType={reduceMotion ? "none" : "fade"}
          onRequestClose={() => setQrOpen(false)}
        >
          <Pressable style={styles.qrBackdrop} onPress={() => setQrOpen(false)}>
            <Pressable style={styles.qrSheet} accessibilityViewIsModal>
              <Text style={styles.qrTitle}>{family.name}</Text>
              <InviteQR url={inviteUrl} size={240} />
              <Text style={styles.qrCode}>{family.inviteCode}</Text>
              <Button label={t("Common.close")} variant="secondary" onPress={() => setQrOpen(false)} />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </SettingsCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg },
  flexShrink: { flexShrink: 1, minWidth: 0 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md, flexShrink: 1 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  // web: rounded-lg border bg-amber-50 p-3 text-xs (mango tokens)
  infoBox: {
    backgroundColor: colors.cardSoft,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
  },
  infoText: { fontSize: 12, lineHeight: 18, color: colors.ink2 },
  retry: { marginTop: spacing.sm, alignSelf: "flex-start" },
  // web: flex flex-wrap gap-1.5; pill h-7 px-3 text-xs font-medium
  switcher: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  switchPill: {
    height: 28,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    justifyContent: "center",
    backgroundColor: colors.bgAlt,
  },
  switchPillOn: { backgroundColor: colors.brand },
  switchPillPressed: { backgroundColor: colors.hairline },
  switchText: { fontSize: 12, fontWeight: "500", color: colors.ink2 },
  switchTextOn: { color: "#ffffff" },
  // web: flex flex-col gap-2 rounded-lg bg-amber-50 p-3
  codeCard: { backgroundColor: colors.cardSoft, borderRadius: radius.sm, padding: spacing.md, gap: spacing.sm },
  codeTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  codeLabel: { fontSize: 12, color: colors.brandDeep },
  code: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.brandDeep,
    letterSpacing: 4,
    fontVariant: ["tabular-nums"],
  },
  codeActions: { flexDirection: "row", gap: 6 },
  // web: grid size-9 rounded-lg bg-white text-amber-700
  codeBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  codeBtnPressed: { backgroundColor: colors.brandTint },
  codeHelp: { fontSize: 12, color: colors.ink2 },
  membersBlock: { gap: spacing.sm },
  membersLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.ink3,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  memberRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 4 },
  memberBody: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 },
  memberName: { flexShrink: 1, fontSize: 14, fontWeight: "500", color: colors.ink },
  // web: ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium
  ownerBadge: {
    backgroundColor: colors.brandTint,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ownerText: { fontSize: 10, fontWeight: "600", color: colors.brandDeep },
  youTag: { fontSize: 12, color: colors.ink3 },
  removeBtn: { width: 28, height: 28, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  removePressed: { backgroundColor: "#fef2f2" },
  // web: self-start gap-1.5 rounded-lg px-3 h-9 text-sm text-red-600
  leaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  leavePressed: { backgroundColor: "#fef2f2" },
  leaveText: { fontSize: 14, fontWeight: "500", color: colors.danger },
  disabled: { opacity: 0.5 },
  qrBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  qrSheet: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },
  qrTitle: { fontSize: 16, fontWeight: "600", color: colors.ink },
  qrCode: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 4,
    color: colors.brandDeep,
    fontVariant: ["tabular-nums"],
  },
});
