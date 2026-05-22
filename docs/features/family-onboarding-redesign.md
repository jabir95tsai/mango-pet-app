# 家庭 onboarding 重設計 — 解 B：Personal mode + Pet merge

狀態：READY-FOR-DEV（解 B 確認動工 by 使用者 2026-05-23；PM 解 C 提議已被否決，理由見「決策記錄」段）
建立日期：2026-05-23
最後更新：2026-05-23
規格作者：PM session @ 78539cc
角色：Feature Builder + Backend 深度合作（schema、rules、callable 都會動）

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

- [ ] **方案重新確認**：你看完上方 PM 建議後仍要解 B 還是換解 C？
- [ ] Personal mode UI 是否視覺暗示「你還沒加入家庭」？建議：settings 顯示 banner，主功能不擾
- [ ] B3 預設「import yes」會不會嚇到？建議：預設 yes 但顯示清楚清單可勾選
- [ ] Phase B1 schema migration：existing pets 沒有完整 ownerUid 的怎麼補？建議：寫一次 backfill 把 createdByUid 複製到 ownerUid，或 rule 容錯（`ownerUid == null` 時 fallback 到 family rule）
- [ ] B4 在 B3 ship 後才上線（B3 期間「import 不去重」是可接受的暫態嗎）？建議：B3 +B4 一起 ship，避免短期間使用者用 B3 import 後資料變更亂
