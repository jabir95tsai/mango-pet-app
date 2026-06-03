/**
 * Family management (P4b) — mirrors web family-section + family-provider flows.
 * Multi-family switcher, member list (owner remove), 6-digit invite code with
 * copy / share / QR / regenerate (owner), create + join dialogs, leave. All
 * mutations are the SAME asia-east1 callables web uses; reads via FamilyProvider.
 */
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
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
import { InviteQR } from "@/components/family/invite-qr";
import { UserAvatar } from "@/components/feed/user-avatar";
import { SITE_URL } from "@/lib/config";
import { t } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

export default function FamilyScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { family, families, loading, refresh, switchFamily } = useFamily();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

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
      { text: "取消", style: "cancel" },
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
        { text: "取消", style: "cancel" },
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
        { text: "取消", style: "cancel" },
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
    <SafeAreaView edges={["top", "bottom"]} style={styles.flex}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="返回" onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{t("Family.title")}</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {!family ? (
            <View style={styles.personalCard}>
              <Text style={styles.personalMode}>{t("Family.personalMode")}</Text>
              <Text style={styles.personalInfo}>{t("Family.personalInfo")}</Text>
              <View style={styles.row2}>
                <Pressable onPress={() => setCreateOpen(true)} style={[styles.btn, styles.btnPrimary]}>
                  <Text style={styles.btnPrimaryText}>{t("Family.create")}</Text>
                </Pressable>
                <Pressable onPress={() => setJoinOpen(true)} style={[styles.btn, styles.btnGhost]}>
                  <Text style={styles.btnGhostText}>{t("Family.join")}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              {families.length > 1 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.switcher}>
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
                </ScrollView>
              ) : null}

              <Text style={styles.familyName}>{family.name}</Text>

              <View style={styles.codeCard}>
                <Text style={styles.codeLabel}>{t("Family.inviteCode")}</Text>
                <Text style={styles.code}>{family.inviteCode}</Text>
                <Text style={styles.codeHelp}>{t("Family.inviteHelp")}</Text>
                <View style={styles.codeActions}>
                  <Pressable onPress={copyCode} style={styles.codeBtn}>
                    <Text style={styles.codeBtnText}>📋 {t("Family.copyCode")}</Text>
                  </Pressable>
                  <Pressable onPress={shareInvite} style={styles.codeBtn}>
                    <Text style={styles.codeBtnText}>🔗 {t("Family.invite.shareAria")}</Text>
                  </Pressable>
                  <Pressable onPress={() => setQrOpen(true)} style={styles.codeBtn}>
                    <Text style={styles.codeBtnText}>▦ QR</Text>
                  </Pressable>
                </View>
                {isOwner ? (
                  <Pressable onPress={confirmRegen} disabled={busy} style={styles.regenBtn}>
                    <Text style={styles.regenText}>{t("Family.regenCode")}</Text>
                  </Pressable>
                ) : null}
              </View>

              <Text style={styles.sectionLabel}>{t("Family.members", { count: members.length })}</Text>
              <View style={styles.members}>
                {members.map((m) => {
                  const memberIsOwner = m.uid === family.ownerUid;
                  const isMe = m.uid === user?.uid;
                  return (
                    <View key={m.uid} style={styles.memberRow}>
                      <UserAvatar name={m.displayName} photoURL={m.photoURL} size={36} />
                      <View style={styles.memberBody}>
                        <Text style={styles.memberName}>
                          {m.displayName}
                          {isMe ? ` ${t("Family.you")}` : ""}
                        </Text>
                        {memberIsOwner ? <Text style={styles.ownerTag}>{t("Family.owner")}</Text> : null}
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

              <Pressable onPress={confirmLeave} disabled={busy} style={styles.leaveBtn}>
                <Text style={styles.leaveText}>{t("Family.leave")}</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
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

      <Modal visible={qrOpen} transparent animationType="fade" onRequestClose={() => setQrOpen(false)}>
        <Pressable style={styles.qrBackdrop} onPress={() => setQrOpen(false)}>
          <Pressable style={styles.qrSheet}>
            <Text style={styles.qrTitle}>{family?.name}</Text>
            {family ? <InviteQR url={inviteUrl} size={240} /> : null}
            <Text style={styles.qrCode}>{family?.inviteCode}</Text>
            <Pressable onPress={() => setQrOpen(false)} style={styles.qrClose}>
              <Text style={styles.qrCloseText}>關閉</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
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
          <Pressable onPress={submit} disabled={busy} style={[styles.btn, styles.btnPrimary, styles.dialogSubmit]}>
            {busy ? <ActivityIndicator color={colors.card} /> : <Text style={styles.btnPrimaryText}>{t("Family.createDialog.submit")}</Text>}
          </Pressable>
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
          <Pressable onPress={submit} disabled={busy} style={[styles.btn, styles.btnPrimary, styles.dialogSubmit]}>
            {busy ? <ActivityIndicator color={colors.card} /> : <Text style={styles.btnPrimaryText}>{t("Family.joinDialog.submit")}</Text>}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 30, color: colors.ink, fontWeight: "700", lineHeight: 32 },
  title: { fontSize: 18, fontWeight: "800", color: colors.ink },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  personalCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg, gap: spacing.md },
  personalMode: { fontSize: 14, fontWeight: "800", color: colors.ink },
  personalInfo: { fontSize: 13, color: colors.ink2, lineHeight: 19 },
  row2: { flexDirection: "row", gap: spacing.md },
  btn: { flex: 1, height: 48, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  btnPrimary: { backgroundColor: colors.brand },
  btnPrimaryText: { fontSize: 15, fontWeight: "800", color: colors.card },
  btnGhost: { backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.hairline },
  btnGhostText: { fontSize: 15, fontWeight: "800", color: colors.ink2 },
  switcher: { gap: spacing.sm, paddingVertical: spacing.xs },
  switchPill: { paddingHorizontal: spacing.md, height: 34, borderRadius: radius.pill, justifyContent: "center", backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.hairline },
  switchPillOn: { backgroundColor: colors.brandTint, borderColor: colors.brand },
  switchText: { fontSize: 13, fontWeight: "700", color: colors.ink2 },
  switchTextOn: { color: colors.brandDeep, fontWeight: "800" },
  familyName: { fontSize: 22, fontWeight: "900", color: colors.ink },
  codeCard: { backgroundColor: colors.cardSoft, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg, gap: spacing.sm, alignItems: "center" },
  codeLabel: { fontSize: 12, fontWeight: "700", color: colors.ink3 },
  code: { fontSize: 36, fontWeight: "900", color: colors.brandDeep, letterSpacing: 6, fontVariant: ["tabular-nums"] },
  codeHelp: { fontSize: 12, color: colors.ink3, textAlign: "center" },
  codeActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  codeBtn: { paddingHorizontal: spacing.md, minHeight: 44, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, alignItems: "center", justifyContent: "center" },
  codeBtnText: { fontSize: 12, fontWeight: "700", color: colors.ink2 },
  regenBtn: { marginTop: spacing.xs, paddingVertical: 6 },
  regenText: { fontSize: 12, fontWeight: "700", color: colors.cookie },
  sectionLabel: { fontSize: 13, fontWeight: "800", color: colors.ink2, marginTop: spacing.sm },
  members: { gap: spacing.xs },
  memberRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.hairline, padding: spacing.md },
  memberBody: { flex: 1 },
  memberName: { fontSize: 14, fontWeight: "700", color: colors.ink },
  ownerTag: { fontSize: 11, color: colors.brandDeep, fontWeight: "700", marginTop: 1 },
  removeBtn: { padding: 4 },
  removeText: { fontSize: 14, color: colors.ink3, fontWeight: "700" },
  leaveBtn: { marginTop: spacing.md, height: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.cookie, alignItems: "center", justifyContent: "center" },
  leaveText: { fontSize: 14, fontWeight: "800", color: colors.cookie },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  qrBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  dialog: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: spacing.sm },
  dialogTitle: { fontSize: 18, fontWeight: "800", color: colors.ink },
  dialogBody: { fontSize: 13, color: colors.ink2 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: colors.ink2, marginTop: spacing.sm },
  input: { height: 48, backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.hairline, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 15, color: colors.ink },
  codeInput: { fontSize: 24, fontWeight: "800", letterSpacing: 8, textAlign: "center" },
  dialogError: { fontSize: 12, color: colors.cookie },
  dialogSubmit: { marginTop: spacing.md, marginBottom: spacing.sm },
  qrSheet: { backgroundColor: colors.card, margin: spacing.lg, borderRadius: radius.xl, padding: spacing.xl, alignItems: "center", gap: spacing.md, alignSelf: "center" },
  qrTitle: { fontSize: 18, fontWeight: "800", color: colors.ink },
  qrCode: { fontSize: 20, fontWeight: "900", color: colors.brandDeep, letterSpacing: 4 },
  qrClose: { paddingHorizontal: spacing.xl, height: 44, borderRadius: radius.pill, backgroundColor: colors.bgAlt, alignItems: "center", justifyContent: "center" },
  qrCloseText: { fontSize: 14, fontWeight: "700", color: colors.ink2 },
});
