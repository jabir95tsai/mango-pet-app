# 加入家庭時自動加為家人好友（auto-friend family members）

狀態：**SHIPPED 2026-05-25**（helper `b9038da` + trigger 內容收入 `e17acd5` + rules `4962c69`；asia-east1 deployed）
建立日期：2026-05-25 下午
最後更新：2026-05-25 下午
規格作者：PM session @ `54c0781`
角色：**Feature Builder**（server-side onWrite trigger + idempotent friendship writes + 觀察 audit doc）
工作量：**S-M**（1 個新 trigger + friendship batch write + edge cases + 沒有新 UI）

## SHIPPED bookkeeping

| Commit | What |
|---|---|
| `b9038da` | feat(functions): friendship-helpers.ts — `createMutualFriendship(a, b, db)` writes the two mirror docs (`users/{a}/friends/{b}` + reverse) in one batch; probes existing direction-A doc → skip with `reason: 'exists'` (idempotent). `pairId(a, b)` sorted helper for stable audit keys. Reasons enum: `self` / `exists` / `missing-profile`. |
| `e17acd5` | feat(functions): autoFriendFamilyMembers onDocumentWritten(`families/{familyId}`) trigger — diffs `before.memberUids` vs `after.memberUids`, fires `createMutualFriendship` for each `(newMember, otherMember)` pair, dedupes the reciprocal `(newA, newB)` pass by string-sorted uid, audit doc `autoFriendEvents/{familyId}_{ISO}` per fire with per-pair created/skipped counts + reasons. Member removal is a deliberate no-op per D1. **Note**: this commit's message describes only `purgeMyOrphanWalks` because a parallel session's staging pass swept up my staged trigger; the autoFriendFamilyMembers code IS in that diff (+238 lines on functions/src/index.ts) — verified by grep. |
| `4962c69` | feat(rules): `autoFriendEvents/{document=**}` admin/server-only audit collection. Mirrors engagementPushes / realtimeLeaderboardUpdates / orphanWalkPurges patterns. Deployed firestore:rules + functions:autoFriendFamilyMembers (first-try Eventarc create, no cold-start retry). |

### 後續驗證 / 觀察

- 2-account live join test ⏳ — test user B joins a family with A + C → friendships A↔B + B↔C appear (A↔C already exists, skipped + audited)
- Idempotent retry ⏳ — kick the trigger twice on the same family (e.g., touch the doc) → second fire's audit doc shows `skippedExists` for every pair
- Removal no-op ⏳ — leaveFamily on existing family → trigger fires (memberUids shrinks) but early-returns; friendships untouched per D1
- `autoFriendEvents/*` audit docs grep-able in Firebase Console by familyId prefix
- `npx tsc --noEmit` clean ✅

### Edge cases handled

- N people in one write: pair-dedupe via sorted uid keeps the audit log free of (newA, newB) + (newB, newA) duplicates
- Missing profile doc: `createMutualFriendship` returns `reason: 'missing-profile'` instead of writing a half-bad friend doc (would render as "Friend" forever)
- Doc deleted entirely: trigger early-returns (nothing to friend)
- Field-only writes (name, inviteCode): newMembers is empty → early return before any reads
- Concurrent triggers on the same family: writes produce identical content (idempotent at doc level); audit may double-count `created` (acceptable per spec — audit is observability not enforcement)

### 不在範圍 (per spec)

- 退家自動解 friend（D1 ✅）
- Manual opt-out preference（user.prefs.autoFriendOnJoinFamily — future toggle）
- Push「{X} 已是你的家人」(future, depends on Epic 5 B5 friend-request push if ever ships)
- 跨家庭 friend
- Friends 頁「來自 family X」chip

## User Vision（原話保留）

> 「加入家庭時自動加入家庭成員好友」

## 1 個 decision（confirmed）

| # | Decision | Final | 註 |
|---|---|---|---|
| **D1** ✅ | 退出家庭時 friendship 怎處理 | **保留 friendship**（家庭與社交解耦） | PM 推薦；friends 是社交關係不必 mirror family lifecycle，MVP 簡單 |

## 背景

- 既有 friendship 系統（Epic 5 B5 reference: `sendFriendRequest` callable + accept flow）
- 既有 family doc 含 `members: uid[]`（or 對應 schema）
- User join family flow：joinFamilyByCode → family.members 新加 uid
- 痛點：joiner 加家庭後仍要手動發 friend request 給每位家人 — 高摩擦
- 自動加好友 = 跳過 request flow，直接 bidirectional friendship

## 完成標準

### Server-side trigger

- [ ] `functions/src/index.ts` 新 `autoFriendFamilyMembers` onWrite(`families/{familyId}`) trigger：
  - Watch family doc changes
  - Detect new member added：
    - Compare `before.members[]` vs `after.members[]`
    - 找出 newMembers = after - before
  - 對每個 newMember：
    - 對 existing members（after - newMembers, excluding self）：
      - 建立 bidirectional friendship（newMember ↔ existingMember）
      - 用 helper `createMutualFriendship(uidA, uidB)` 寫 friendships collection
      - Idempotent: 若已 friend skip（避免 duplicate）
  - 對 newMember 之間（多人同時 join 罕見）：同樣建 friendship
  - 不發 push（純社交關係建立，user 看 friends 頁時自然發現）
  - Audit doc：`autoFriendEvents/{familyId}_{ISO}` 紀錄 newMember + 建立的 pairs

### Helper

- [ ] `createMutualFriendship(uidA, uidB)`（server-side，functions/src/friendship-helpers.ts 新檔）：
  - 檢查既有 friendship 文件（用 deterministic ID `[uidA, uidB].sort().join('_')`）
  - 若存在 → skip + return `{ created: false, reason: 'exists' }`
  - 否則 batch write friendship docs（依既有 friendships schema 寫；可能是 1 doc with both uids 或 2 doc per uid — Feature Builder 查既有 schema）
  - Idempotent 設計 — onWrite race 安全
- [ ] **不能 cross-import src/lib/**（functions sandbox 限制）— 邏輯 inline 或抽 functions/src/ 內

### Schema 確認 / 改動

- [ ] **既有 friendships schema 不動**（推測為 `friendships/{pairId}` doc 或 `users/{uid}/friends/{friendUid}` subcollection — Feature Builder 查既有 sendFriendRequest 確認）
- [ ] `autoFriendEvents/{document=**}` 新 audit collection — rules admin/server-only write
- [ ] firestore.rules 不動既有 friendships rules

### 不在範圍

- 退出家庭時刪 friendship（D1 user 確認 keep）
- Manual override（user 不想被 auto-friend）— 之後若有 feedback 加 user.prefs.autoFriendOnJoinFamily toggle
- 跨家庭 friend（user 在 family A，friend 在 family B 不同家）— 本 spec 只處理同家庭內
- 加入家庭時推 push 通知新好友（風險：太多 push；可獨立 follow-up）
- Friends 頁面顯示「來自 family X」chip — UI 不動

### 預驗收 checklist

- [ ] `npx tsc --noEmit` pass（functions）
- [ ] Manual test：
  - User B join 已有 User A + C 的家庭 → autoFriendFamilyMembers trigger 跑
  - friendships 顯示 B↔A + B↔C （但 A↔C 已存在不重寫）
  - User A 在 friends 頁看到 B 自動出現（無 request 步驟）
  - User B 在 friends 頁看到 A + C
- [ ] Idempotent test：
  - 已 friend 的 pair → trigger 跑時 skip + audit doc 紀錄 `existing` reason
- [ ] Edge test：
  - User 退出 family（members 變少）→ trigger detect remove，**不刪 friendship**（per D1）
  - Family 多人同時 join（race condition）→ batch write 不互相覆蓋
- [ ] Audit doc `autoFriendEvents/*` 紀錄完整：newMember + pairs created + pairs skipped
- [ ] Deploy: `npx firebase deploy --only functions:autoFriendFamilyMembers`
- [ ] Live test：用 test 帳號 join family，看 friends 頁是否自動有家人

## Edge cases

| Case | 處理 |
|---|---|
| 既有 friends 已是 friend | Skip + audit 標 `existing` |
| User 同時被 N 人 join family | 對每個 new member 跑 trigger logic；batch write 避免衝突 |
| Family 退出後重新加入 | Friendship 仍在（per D1）；trigger 重跑時 skip existing |
| Family 1 人（只剩 user 自己）+ 新人 join | newMember = 新人；existing = user 自己；建 1 個 friendship |
| Personal mode user 不會走此 flow | 對 — onWrite 觸發在 family doc，personal mode 無 family doc |
| Family doc 寫入失敗 retry | onWrite 會 fire；helper idempotent + audit 防 spam |
| 跨 region cold start | 首次 deploy ~90s Eventarc 設定（同 B2 經驗）|
| user 主動 unfriend 後 join family | Trigger 會重建 friendship（per design — 自動加好友意圖更強）|

## 跟其他 spec 的關聯

- **既有 Epic 5 B5 friend-request push (deferred)**：本 spec 不發 push；future 若 B5 ship，加 push「{X} 已是你的家人，自動加為好友」
- **既有 sendFriendRequest callable**：本 spec 旁路（不走 request flow，直接 mutual write）— manual friend request 流程仍保留
- **delete-account.md (SHIPPED)**：刪 user 時 friendships hard-delete cascade（既有邏輯，不影響本 spec）
- **ui-polish-bundle-2026-05-25.md**：Item #1 friends icon 提高 friends 頁曝光 — 本 spec ship 後 friends 頁更多人，icon 入口更有用
- **family-onboarding-redesign.md (SHIPPED)**：join family flow 已 ship；本 spec 加 trigger 並列

## PM 觀察

工作量 S-M — 主要在 friendship schema 確認 + idempotent write logic + onWrite trigger pattern。建議 Feature Builder 1 session ship，拆 commit：

1. `feat(functions): friendship-helpers + createMutualFriendship idempotent helper`
2. `feat(functions): autoFriendFamilyMembers onWrite trigger + audit doc`
3. `feat(rules): autoFriendEvents audit collection rules`

部署順序：rules → functions → manual test。

## Launch prompt

```
本 session 固定角色：Feature Builder — 加入家庭時自動加為家人好友 (server trigger)。
Repo: C:\Users\jabir\Hacker_J\mango_pet_app

⚠️ 必讀
- Spec: docs/features/auto-friend-family-members.md（PM 寫好，含完成標準 + edge cases）
- 既有 friendship 系統：grep sendFriendRequest in functions/src/index.ts + src/lib/firebase/friends.ts（看 schema shape）
- 既有 family doc schema: src/lib/types.ts 內 Family 含 members[]
- 既有 onWrite trigger 參考：Epic 5 B2 familyGoalMilestone (commit 40a7e02) + recomputeWalkerLeaderboards (commit 1245286)
- 必讀 AGENTS.md + functions/AGENTS.md

護欄
- 動 functions/src/index.ts + 新 functions/src/friendship-helpers.ts OK
- 動 firestore.rules 加 autoFriendEvents collection OK
- 不動既有 friendships schema
- 不動 sendFriendRequest manual flow
- 不動 family doc schema
- 不引入新 dependencies
- Functions 端不能 cross-import src/lib/

實作順序
1. Grep 既有 friendships schema (sendFriendRequest 寫 doc shape)
2. friendship-helpers.ts: createMutualFriendship(a, b) — deterministic pairId + idempotent
3. autoFriendFamilyMembers onWrite trigger — detect new members + batch friendship writes
4. Audit doc per trigger run
5. Rules: autoFriendEvents/{document=**} admin/server-only
6. Deploy: rules → functions → manual test 2 帳號 join family
7. Verify friends 頁自動出現新家人

預驗收
- 2 帳號 join 同 family → friends 頁互相看到
- Idempotent (已 friend 不重寫)
- Audit doc 紀錄 created/skipped pairs
- 退家 friendship 仍在 (per D1)
- npx tsc --noEmit pass

commit 拆解
1. feat(functions): friendship-helpers + createMutualFriendship
2. feat(functions): autoFriendFamilyMembers onWrite trigger + audit
3. feat(rules): autoFriendEvents audit rules

回報格式
- commit hash + 1 行 review note
- ship 後 summary 給 PM 收尾 roadmap

開工。
```
