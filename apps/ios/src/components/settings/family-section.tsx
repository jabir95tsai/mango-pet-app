/**
 * Settings → inline family card — 1:1 with web family-section, ported to RN.
 * Header (👥 disc + 家庭 + name + 加入/建立 buttons) → personal-info note OR
 * the invite-code card (code + 🔗 share / 📋 copy / ↻ regen) + members list +
 * 離開 button, all expanded inline (web parity; was a「家庭 ›」row that pushed a
 * separate screen).
 *
 * Presentation-only port: every mutation calls the SAME existing
 * families-write functions the standalone /family screen already uses — no
 * write/callable logic is changed here.
 */
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import type { Family, FamilyMember } from "@mango/shared-types";

import { useAuth } from "@/state/auth-context";
import { useFamily } from "@/state/family-context";
import { listFamilyMembers } from "@/lib/families-read";
import {
  createFamily,
  joinFamilyByCode,
  leaveFamily,
  regenerateInviteCode,
  removeFamilyMember,
} from "@/lib/families-write";
import { UserAvatar } from "@/components/feed/user-avatar";
import { Button } from "@/components/ui/Button";
import { SITE_URL } from "@/lib/config";
import { t } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

export function FamilySection() {
  const { user } = useAuth();
  const { family, families, loading, refresh, switchFamily } = useFamily();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const isOwner = !!family && !!user && family.ownerUid === user.uid;

  const loadMembers = useCallback(async (fam: Family | null) => {
    if (!fam) {
      setMembers([]);
      return;
    }
    try {
      setMembers(await listFamilyMembers(fam));
    } catch {
      setMembers([]);
    }
  }, []);

  useEffect(() => {
    void loadMembers(family);
  }, [family, loadMembers]);

  const inviteUrl = family ? `${SITE_URL}/join/${family.inviteCode}` : "";

  async function copyCode() {
    if (!family) return;
    await Clipboard.setStringAsync(family.inviteCode);
    Alert.alert(t("Family.copyCode"), family.inviteCode);
  }
  async function shareInvite() {
    if (!family) return;
    await Share.share({
      message: t("Family.invite.text", { name: family.name, url: inviteUrl }),
    });
  }
  function confirmRegen() {
    if (!family) return;
    Alert.alert(t("Family.regenConfirm.title"), t("Family.regenConfirm.message"), [
      { text: t("Common.cancel"), style: "cancel" },
      {
        text: t("Family.regenConfirm.confirm"),
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await regenerateInviteCode(family.familyId);
            await refresh();
          } catch {
            Alert.alert("失敗", "無法重新產生邀請碼");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }
  function confirmLeave() {
    if (!family) return;
    Alert.alert(
      t("Family.leaveConfirm.title"),
      t("Family.leaveConfirm.message", { name: family.name }),
      [
        { text: t("Common.cancel"), style: "cancel" },
        {
          text: t("Family.leaveConfirm.confirm"),
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await leaveFamily(family.familyId);
              await refresh();
            } catch {
              Alert.alert("失敗", "無法離開家庭");
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }
  function confirmRemove(m: FamilyMember) {
    if (!family) return;
    Alert.alert(
      t("Family.removeConfirm.title"),
      t("Family.removeConfirm.message", { name: m.displayName }),
      [
        { text: t("Common.cancel"), style: "cancel" },
        {
          text: t("Family.removeConfirm.confirm"),
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await removeFamilyMember(family.familyId, m.uid);
              await refresh();
              await loadMembers(family);
            } catch {
              Alert.alert("失敗", "無法移除成員");
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.card}>
      {/* Header: icon + title/name + join/create */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.iconDisc}>
            <Text style={styles.iconText}>👥</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>{t("Family.title")}</Text>
            <Text style={styles.sub} numberOfLines={1}>
              {family ? family.name : t("Family.personalMode")}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={() => setJoinOpen(true)} hitSlop={4} style={styles.ghostBtn}>
            <Text style={styles.ghostText}>{t("Family.join")}</Text>
          </Pressable>
          <Pressable onPress={() => setCreateOpen(true)} hitSlop={4} style={styles.secondaryBtn}>
            <Text style={styles.secondaryText}>＋ {t("Family.create")}</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={styles.loader} />
      ) : !family ? (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>{t("Family.personalInfo")}</Text>
        </View>
      ) : (
        <>
          {families.length > 1 ? (
            <View style={styles.switcher}>
              {families.map((f) => {
                const on = f.familyId === family.familyId;
                return (
                  <Pressable
                    key={f.familyId}
                    onPress={() => switchFamily(f.familyId)}
                    style={[styles.switchPill, on && styles.switchPillOn]}
                  >
                    <Text style={[styles.switchText, on && styles.switchTextOn]}>{f.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* Invite code */}
          <View style={styles.codeCard}>
            <View style={styles.codeTop}>
              <View>
                <Text style={styles.codeLabel}>{t("Family.inviteCode")}</Text>
                <Text style={styles.code}>{family.inviteCode}</Text>
              </View>
              <View style={styles.codeActions}>
                <Pressable onPress={shareInvite} style={styles.codeBtn} accessibilityLabel={t("Family.invite.shareAria")}>
                  <Text style={styles.codeBtnIcon}>🔗</Text>
                </Pressable>
                <Pressable onPress={copyCode} style={styles.codeBtn} accessibilityLabel={t("Family.copyCode")}>
                  <Text style={styles.codeBtnIcon}>📋</Text>
                </Pressable>
                {isOwner ? (
                  <Pressable onPress={confirmRegen} disabled={busy} style={styles.codeBtn} accessibilityLabel={t("Family.regenCode")}>
                    <Text style={styles.codeBtnIcon}>↻</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
            <Text style={styles.codeHelp}>{t("Family.inviteHelp")}</Text>
          </View>

          {/* Members */}
          <Text style={styles.membersLabel}>{t("Family.members", { count: members.length })}</Text>
          <View style={styles.members}>
            {members.map((m) => {
              const memberIsOwner = m.uid === family.ownerUid;
              const isMe = m.uid === user?.uid;
              return (
                <View key={m.uid} style={styles.memberRow}>
                  <UserAvatar name={m.displayName} photoURL={m.photoURL} size={36} />
                  <View style={styles.memberBody}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {m.displayName}
                      {memberIsOwner ? (
                        <Text style={styles.ownerTag}>  {t("Family.owner")}</Text>
                      ) : null}
                      {isMe ? <Text style={styles.youTag}>  {t("Family.you")}</Text> : null}
                    </Text>
                  </View>
                  {isOwner && !memberIsOwner ? (
                    <Pressable onPress={() => confirmRemove(m)} hitSlop={6} style={styles.removeBtn}>
                      <Text style={styles.removeText}>✕</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>

          {/* Leave */}
          <Pressable onPress={confirmLeave} disabled={busy} style={styles.leaveBtn}>
            <Text style={styles.leaveText}>🚪 {t("Family.leave")}</Text>
          </Pressable>
        </>
      )}

      <CreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onDone={async () => {
          setCreateOpen(false);
          await refresh();
        }}
      />
      <JoinDialog
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        onDone={async () => {
          setJoinOpen(false);
          await refresh();
        }}
      />
    </View>
  );
}

function CreateDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setName("");
  }, [open]);
  async function submit() {
    setBusy(true);
    try {
      await createFamily(name);
      onDone();
    } catch {
      Alert.alert("失敗", "無法建立家庭");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.dialog}>
          <Text style={styles.dialogTitle}>{t("Family.createDialog.title")}</Text>
          <Text style={styles.dialogBody}>{t("Family.createDialog.instructions")}</Text>
          <Text style={styles.fieldLabel}>{t("Family.createDialog.nameLabel")}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t("Family.createDialog.namePlaceholder")}
            placeholderTextColor={colors.ink3}
            maxLength={30}
          />
          <Button label={t("Family.createDialog.submit")} onPress={submit} loading={busy} size="lg" fullWidth style={styles.dialogSubmit} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function JoinDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setCode("");
      setError(null);
    }
  }, [open]);
  async function submit() {
    if (!/^\d{6}$/.test(code.trim())) {
      setError(t("Family.joinDialog.errInvalidCode"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await joinFamilyByCode(code);
      if (res.alreadyMember) {
        setError(t("Family.joinDialog.errAlready"));
        setBusy(false);
        return;
      }
      onDone();
    } catch {
      setError(t("Family.joinDialog.errInvalidCode"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.dialog}>
          <Text style={styles.dialogTitle}>{t("Family.joinDialog.title")}</Text>
          <Text style={styles.dialogBody}>{t("Family.joinDialog.instructions")}</Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            value={code}
            onChangeText={setCode}
            placeholder="000000"
            placeholderTextColor={colors.ink3}
            keyboardType="number-pad"
            maxLength={6}
          />
          {error ? <Text style={styles.dialogError}>{error}</Text> : null}
          <Button label={t("Family.joinDialog.submit")} onPress={submit} loading={busy} size="lg" fullWidth style={styles.dialogSubmit} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    gap: spacing.md,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md, flexShrink: 1 },
  iconDisc: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontSize: 16 },
  headerText: { flexShrink: 1 },
  title: { fontSize: 15, fontWeight: "800", color: colors.ink },
  sub: { fontSize: 12, color: colors.ink3, marginTop: 1 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  ghostBtn: { paddingHorizontal: spacing.sm, height: 32, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  ghostText: { fontSize: 13, fontWeight: "700", color: colors.ink2 },
  secondaryBtn: {
    paddingHorizontal: spacing.md,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontSize: 13, fontWeight: "700", color: colors.ink },
  loader: { marginVertical: spacing.md },
  infoBox: {
    backgroundColor: colors.cardSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
  },
  infoText: { fontSize: 12, color: colors.ink2, lineHeight: 18 },
  switcher: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  switchPill: { paddingHorizontal: spacing.md, height: 30, borderRadius: radius.pill, justifyContent: "center", backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.hairline },
  switchPillOn: { backgroundColor: colors.brandTint, borderColor: colors.brand },
  switchText: { fontSize: 12, fontWeight: "700", color: colors.ink2 },
  switchTextOn: { color: colors.brandDeep, fontWeight: "800" },
  codeCard: { backgroundColor: colors.cardSoft, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  codeTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  codeLabel: { fontSize: 11, fontWeight: "700", color: colors.brandDeep },
  code: { fontSize: 28, fontWeight: "900", color: colors.brandDeep, letterSpacing: 6, fontVariant: ["tabular-nums"], marginTop: 2 },
  codeActions: { flexDirection: "row", gap: spacing.xs },
  codeBtn: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, alignItems: "center", justifyContent: "center" },
  codeBtnIcon: { fontSize: 15, color: colors.brandDeep, fontWeight: "700" },
  codeHelp: { fontSize: 11, color: colors.ink3 },
  membersLabel: { fontSize: 11, fontWeight: "800", color: colors.ink3, letterSpacing: 0.5, textTransform: "uppercase" },
  members: { gap: spacing.xs },
  memberRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 4 },
  memberBody: { flex: 1 },
  memberName: { fontSize: 14, fontWeight: "600", color: colors.ink },
  ownerTag: { fontSize: 11, fontWeight: "700", color: colors.brandDeep },
  youTag: { fontSize: 12, color: colors.ink3 },
  removeBtn: { padding: 6 },
  removeText: { fontSize: 14, color: colors.ink3, fontWeight: "700" },
  leaveBtn: { alignSelf: "flex-start", paddingHorizontal: spacing.md, height: 36, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  leaveText: { fontSize: 14, fontWeight: "700", color: colors.cookie },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  dialog: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: spacing.sm },
  dialogTitle: { fontSize: 18, fontWeight: "800", color: colors.ink },
  dialogBody: { fontSize: 13, color: colors.ink2 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: colors.ink2, marginTop: spacing.sm },
  input: { height: 48, backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.hairline, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 15, color: colors.ink },
  codeInput: { fontSize: 24, fontWeight: "800", letterSpacing: 8, textAlign: "center" },
  dialogError: { fontSize: 12, color: colors.cookie },
  dialogSubmit: { marginTop: spacing.md, marginBottom: spacing.sm },
});
