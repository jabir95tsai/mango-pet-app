# 家庭 onboarding 重設計 — 解 B：Personal mode + Pet merge

狀態：SHIPPED — B1+B2+B3 全部，B4 merge feature **使用者醒來後決定拿掉**，UI 層 rollback 待 Feature Builder session 接手（見「Post-ship change」段）
建立日期：2026-05-23
最後更新：2026-05-23
規格作者：PM session @ 78539cc
角色：Feature Builder（整 epic 一條龍跑 4 phases — feature-builder.md 角色定義允許跨 stack 動 type/lib/page/component/rules/indexes/functions）
執行模式：**Unsupervised run** by 使用者要求（2026-05-23 睡前 launch；guardrails 見 launch prompt）

---

## ✅ 決策記錄（2026-05-23）

使用者確認動工解 B，PM 解 C 提議已否決。

**使用者最終理由**（PM 之前沒充分考慮的維度）：

> 「動工解 B，因為有些人可能自己生活不需要家庭功能阿」

**PM 接受**。理由：
- 解 C 的核心假設「使用者註冊後會立刻建/加家庭」對**單身飼主**不成立 — 他們可能永遠不用家庭功能
- 強迫他們在 onboarding 就建單人家庭 = 強加一個他們不需要的概念
- 解 B 的 personal mode 是真正尊重「**家庭是 optional feature**」的 product framing
- 工作量從 M 變 L，但換到一個 product principle：使用者不用家庭也能正常用 App

### 三方案對比（保留供未來參考）

| | 解 A | **解 B（採用）** | 解 C（PM 曾推薦，已否決）|
|---|---|---|---|
| Schema 改動 | 不動 | **pets 等允許 `familyId === null`** | 不動 |
| Onboarding UI | ✅ | **✅** | ✅ |
| 沒家庭時能用主功能 | ❌（強制建/加）| **✅（personal mode）** | ❌（強制建/加）|
| 加入家庭時 import wizard | ❌ | **✅** | N/A |
| Pet merge wizard | ❌ | **✅** | ✅ |
| **尊重「家庭可選」？** | ❌ | **✅** | ❌ |
| 工作量 | S | **L** | M |

---

## 解 B 完整版 spec

### User Story（解 B 主軸）

作為**和家人養同一隻狗的飼主**：

1. 註冊後**不要被自動丟進「我的家庭」單人家庭**
2. 我能在「沒家庭」狀態下用主功能建 Mango、walks、reminders、expenses（personal mode）
3. 當我準備好邀請家人時，**建立家庭** → 我的所有 personal 資料自動 import 進家庭
4. 或我加入家人已有的家庭時，**import wizard** 偵測「家人家庭已有同名同生日的 Mango」→ 提示「合併」→ 從此我跟家人看同一隻 Mango 的完整紀錄

### 為什麼是現在做

- first-touch 體驗，使用者越多越難改
- 資料量還小，schema migration 成本最低
- merge logic 可重用既有 [dedupe migration spec](./mango-dedupe-migration.md)

### 4 Phases

整體工作量 L，但可拆 4 phases 獨立 ship。建議順序 B1 → B2 → B3 → B4。

#### Phase B1: Schema + Rules（personal mode）— 工作量 M

讓 pets/walks/reminders/expenses 在沒家庭時可寫入個人 namespace。

**Schema 改動**：
- `pets/{petId}.familyId`、`walks/{walkId}.familyId`、`reminders/{reminderId}.familyId`、`expenses/{expenseId}.familyId` 改為 `string | null`
- `pets/{petId}.ownerUid`、`walks/{walkId}.ownerUid` 等已存在 — 在 personal mode 時是權限邊界，family mode 仍是 attribution

**Rules 改動**（每個 family-scoped collection 統一 pattern）：
```
allow read: if resource == null
  || (resource.data.familyId == null && resource.data.ownerUid == request.auth.uid)
  || (resource.data.familyId != null && isFamilyMember(resource.data.familyId));
allow create: if request.auth != null && (
  (request.resource.data.familyId == null && request.resource.data.ownerUid == request.auth.uid)
  || (request.resource.data.familyId != null && isFamilyMember(request.resource.data.familyId))
);
allow update, delete: 沿用 read 邏輯
```

**Lib 改動**：所有 `listPets` / `createPet` / `createWalk` 等接受 `familyId: string | null`，personal mode 用 `where("ownerUid", "==", uid).where("familyId", "==", null)`。

**Index**：可能新增 `(ownerUid ASC, familyId ASC, createdAt DESC)` 等。

**驗證**：personal mode read/write 通過；既有家庭使用者完全無感（rule 改動向下相容）。

#### Phase B2: Onboarding UI — 工作量 S

**完成標準**：
- [ ] 拿掉 `family-provider.tsx` 的 `ensureDefaultFamily` auto-create
- [ ] `family === null` 是合法狀態，不再是「loading」
- [ ] 新增 `/onboarding` 頁面，**可跳過**（personal mode 仍能用主功能）
- [ ] Settings 頁顯示「邀請家人 / 加入家庭」入口
- [ ] 主功能在 `family === null` 時寫入 personal namespace（`familyId: null, ownerUid: 自己`）
- [ ] 既有家庭使用者完全無感
- [ ] i18n zh-TW + en

#### Phase B3: 加入家庭時 import wizard — 工作量 M

**完成標準**：
- [ ] 新 callable `importPersonalToFamily(familyId, options)`：
  - 把 `familyId === null && ownerUid === request.auth.uid` 的 pets/walks/reminders/expenses 的 `familyId` 改為 `targetFamilyId`
  - atomic batch
  - 寫 audit 到 `families/{familyId}/migrations/import-from-{uid}-{ISO}`
- [ ] 建立家庭 / 加入家庭時 UI 提示：「你有 N 筆 personal 資料，要 import 進這個家庭嗎？」（預設選「是」，顯示清單讓使用者勾選/取消）
- [ ] 不選 import → personal 資料留在 personal namespace
- [ ] **不偵測重複**（B4 才做）— 純搬

#### Phase B4: Pet merge on import — 工作量 M

**完成標準**：
- [ ] B3 import 前先 dry-run 偵測 `(name, species, birthday)` match
- [ ] 若有 match → UI 顯示 merge wizard：「你的 Mango 跟家庭已有的 Mango 看起來是同一隻，要合併嗎？」
  - 預設「合併」，可選「不合併兩隻並存」
  - 顯示兩隻 pet 的 createdAt / 子集合數量 / 照片對比
- [ ] 合併邏輯：把 personal pet 的子集合（healthRecords/walks/reminders/expenses）`petId` 改指家庭 pet，刪除 personal pet doc
- [ ] **重用 [mango-dedupe-migration.md](./mango-dedupe-migration.md) 的 merge logic**（搬子集合 + 刪重複）— 建議實作時把這段 logic 拆共用函式
- [ ] 合併後保留 family pet 原版的 photoURL / bio / weight（不被 personal 版 overwrite）
- [ ] audit 到 `families/{familyId}/migrations/merge-{personalPetId}-into-{familyPetId}-{ISO}`

### 成功指標（all phases ship 後）

- 你跟家人實測「我跟老婆從各自的 Mango 變成同一隻」
- 既有家庭使用者完全無感（不重看 onboarding、不丟資料、無 surprise migration）
- 上線後新註冊使用者中，至少 1 個經 onboarding 進到「加入家庭並 merge」場景

### 不在這次範圍

- **跨家庭 merge**（A 已有家庭 X 跟 Mango，加入別人家庭 B — 留給未來 Phase B5）
- 同 family 內已有兩隻同名 Mango 的合併（那是 [#4 dedupe](./mango-dedupe-migration.md) 的工作）
- 「離開家庭時把資料變回 personal」（不做反向）
- Personal walks 進全 App leaderboard（避免被刷分；personal stats 只給本人看）
- 不同 species 但同名的 merge（沿用 dedupe 規則：不合併）
- 改 existing user 的 ownership 邊界

### 技術筆記

#### B1 動到
- `firestore.rules`、`src/lib/types.ts`、`src/lib/firebase/{pets,walks,reminders,expenses,health-records}.ts`、`firestore.indexes.json`

#### B2 動到
- `src/components/family/family-provider.tsx`、`src/app/onboarding/page.tsx`（新檔）、`src/components/auth/require-auth.tsx`

#### B3 動到
- `functions/src/index.ts`（新 callable）、`src/lib/firebase/families.ts`（wrapper）、import wizard component

#### B4 動到
- `functions/src/index.ts`（merge logic，建議跟 dedupe 共用）、merge wizard component

#### 與其他 spec 的耦合

- **[#4 dedupe-migration](./mango-dedupe-migration.md)**：B4 重用 merge logic；建議實作 B4 前先動工 #4 把共用函式抽出來（**或反過來**：先做 B4 把函式寫好，#4 直接用）
- **[#3 family-leaderboard](./family-leaderboard.md)**：要補 edge case「personal mode 下隱藏 leaderboard」
- **[#6 legacy-path-cleanup]**：legacy `users/{uid}/...` 跟 personal mode（top-level + `familyId === null`）是兩個不同的概念，spec 內要釐清

### 開放問題

- [x] **方案重新確認**：解 B 動工（使用者確認 2026-05-23）
- [x] Personal mode UI 暗示：採 settings banner 建議 — family-section 在 `family == null` 時顯示淡色 hint card
- [x] B3 預設 import yes：採 PM 建議 — 每類預設勾選，count = 0 的類別 disabled，整體 count = 0 則自動跳過 wizard 不顯示
- [x] ownerUid backfill：採「rule 容錯」分支 — 既有 pets/walks/reminders/expenses 在 create rule 都已 required 各自的 owner field，無 backfill 必要
- [x] B3+B4 一起 ship：B3 (347d71a) → B4 (f450ad0) 連續 commit + push，B3 單獨在 production 的視窗 < 5 分鐘

---

## SHIPPED 紀錄

| Phase | Commit | 部署時間 (Asia/Taipei 2026-05-23) | 內容摘要 |
|---|---|---|---|
| B1 schema + rules + lib | `60d820c` | ~10:50 | familyId 允許 null；4 個 collection rule 加 personal-owner OR 分支；5 個新 composite index；6 個新 `listPersonal*` lib 函式 |
| B2 onboarding UI | `8ebcf72` | ~11:35 | `ensureDefaultFamily` 拿掉；`/onboarding` 新 page；6 個主頁面 personal 分支；settings personal hint card；`Onboarding` i18n × 2 locale |
| B3 import wizard | `347d71a` | ~12:30 | `importPersonalToFamily` callable；migrations 子集合 rule（順手解 P1 風險 #3）；`ImportWizardDialog` 元件；create/join dialog 簽名擴成傳回 familyId |
| B4 pet-merge on import | `f450ad0` | ~12:55 | `mergeAndImportToFamily` callable（搬子集合 + reassign petId + 刪 personal pet doc + audit）；ImportWizardDialog 加 merge candidates 偵測 + UI |

### 驗證結果

- **B1 family-mode regression test（Chrome MCP，supervised）**：`/app` / `/app/pets` / `/app/walks` / `/app/expenses` 在新 dual-mode rules 下既有家庭使用者全部正常渲染。無 permission denied、無 index error。
- **B2/B3/B4 personal-mode flow live test**：unsupervised run 期間使用者睡覺中、新 tab group 拿不到 auth session；醒來後給「先把功能做好再測試」指示 — **personal-mode 完整 end-to-end 流程在本 session 沒做 live test**。typecheck 全綠、function deploy 成功、code path 純疊加（family-mode 走 OR 的左半邊不變）。PM 接手後**仍應親手跑一次**：登出 → 註冊新帳號 → 看 /app personal mode → 建立家庭 → 看 ImportWizardDialog → 合併 / import → 確認資料在家庭內。

### 與 spec 的 deviations

- **Settings → /onboarding link 沒加**：spec 寫「Settings 頁顯示『邀請家人 / 加入家庭』入口」— family-section 既有「加入」「新建」buttons 已滿足；本次 **沒** 額外加 link 到 `/onboarding`。/onboarding 目前只透過直接輸入 URL 或新註冊使用者第一次進去用到。PM 若想要 settings 也明確指向 onboarding 介紹頁，是補 1 行 Link 的事。
- **B4 merge 偵測：完全 client-side**：spec 沒明指 server vs client；採 client 偵測（在 wizard 開啟時 fetch 兩邊 pets 比對）以減少 callable 數量。Server 側 mergeAndImportToFamily 仍 re-verify ownership 防偽。
- **Personal walks 防刷 leaderboard 沒做**：spec line 130 寫「Personal walks 進全 App leaderboard（避免被刷分；personal stats 只給本人看）」 — 本次 schema 已支援（`familyId: null` walks 可被 `aggregateLeaderboards` 看到），但**沒動 `aggregateLeaderboards` 函式去 filter 掉 personal walks**。留 follow-up 給 PM 排序時帶到 backlog 或下一輪 Backend spec。
- **`useFamilyId` hook**：保留現有實作（family null 時 throw）— 沒人呼叫它（grep 只有 declaration），不為 personal mode 改它，等下一輪有實際 caller 再評估。

---

## Post-ship change — B4 merge feature 拿掉（2026-05-23）

使用者醒來 review 後決定**拿掉 pet merge 功能**。

**使用者實際理由**（PM 補充於拿掉決定之後）：

> 「不直觀，因為一般不太有這種狀況」

亦即「兩人各自先在 personal mode 建 Mango，後來合家庭時撞名」這個情境**太罕見**，不值得做整套 merge wizard UI — 是 over-engineering。原 spec 把這個 edge case 當成核心 user story 推導出 B4 — 但實際上一般使用流程是「一人先建家庭 + 寵物 → 邀請家人加入」，家人是被邀請的不會先自己建，所以根本不會撞。

### PM 接受並 surface 的 trade-off

User 之前的需求是「養同一隻狗希望同步資料、不要他那邊一隻我這邊一隻」。拿掉 merge 後：
- ✅ 家人「加進使用者的家庭」後立刻看到家庭內的寵物（current schema 已 cover，不變）
- ❌ 兩人各自先建了 Mango 再合家庭時**不會自動合併** — 兩隻並存，split 情境會回來（需要 admin 觸發 #4 dedupe migration 解）

User 已接受 trade-off，rollback 動工。

### Rollback scope（Feature Builder 接手）

採**選項 A：純 UI 層 rollback**（callable 暫保留 dormant，零 production 風險）：

#### 必做
- [ ] `ImportWizardDialog` 拿掉 merge candidates 偵測 + merge wizard step
- [ ] Wizard 直接走 import 路徑（呼叫 `importPersonalToFamily`，B3 callable），不再判斷有沒有 merge candidate
- [ ] i18n 沒被別處用到的 merge wizard 文案（zh-TW + en）刪掉
- [ ] `npx tsc --noEmit` pass
- [ ] Chrome MCP 驗證 production：新使用者建立家庭時 import wizard 走純 import flow，不再出現 merge step

#### 暫保留（下個 cleanup sprint 再處理）
- `functions/src/index.ts` 的 `mergeAndImportToFamily` callable — 留 dormant，無 client caller 就無風險
- merge 共用函式（搬子集合 + reassign petId + 刪 personal pet doc）— 等 #4 dedupe migration 動工時整體 review，看要不要保留為共用 utility

#### 不做
- 不 `git revert f450ad0`（會打到既有 B4 已穩定的部分 — schema/index 沒變，只是 UI 行為要拿掉）
- 不刪 callable 內的邏輯（dormant 即可）
- 不改 B1/B2/B3 任何東西

### 預估工作量

- UI 改：S（純元件改 + i18n key 清理）
- 1 commit + push + Chrome MCP 驗證

### 影響到的下游 spec

- **#4 mango-dedupe-migration**：原本標「merge logic 已被 #2 B4 寫成 callable，可直接重用降工作量」— **保持不變**：callable 還在 functions 內，只是沒 client 呼叫；#4 Backend session 動工時仍可重用同一段邏輯
- **#1 reminder-done-attribution / #1b**：不受影響
- **#3 family-leaderboard**：不受影響
- **#5 / #6**：不受影響
