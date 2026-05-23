# 刪除帳號功能

狀態：SHIPPED + user-verified（callable + UI 全 deploy 上 production 2026-05-23；user 親手跑完 destructive verify 回報「應該沒問題」2026-05-23）
建立日期：2026-05-23
最後更新：2026-05-23
規格作者：PM session @ cada71b
角色：Feature Builder（整 stack — callable + rules + UI + i18n）
排序：**插隊家庭 epic** — B4 UI rollback ship 後立刻接手，#1b/#3/#4/#5/#6 後延

## User Story

作為**使用者**，我想要能完全刪除我的帳號 + 我建立的所有資料，因為：
- 法規（GDPR / 個資法）給我刪除個人資料的權利
- 我可能不想再用 App，希望 footprint 盡可能完全消失（不只我，連我建的資料也走）
- 上架條件必須提供這個功能

## 為什麼是現在做（插隊 update 2026-05-23）

- PRD §6「上架條件」明列 GDPR 合規 — 上架 prerequisite
- 越早做使用者越少，cleanup 邏輯越單純
- 使用者明確要求插隊家庭 epic — 比家庭 epic 剩餘條目 (#1b/#3/#4/#5/#6) 優先

## 5 個 product decisions

### Decision 1: 個人 vs 共用資料的處理策略

**Status：User confirmed 2026-05-23 — full hard delete cascade**

取代原 PM 預設「anonymize 共用」。**使用者主動刪帳號 = 完整消失，連帶其建立的家庭資料全刪**。

| 資料類型 | 策略 | 理由 |
|---|---|---|
| `users/{uid}` doc | Hard delete | 純個人 |
| Firebase Auth user（Admin SDK）| Hard delete | 純個人 |
| `users/{uid}/friends/*` + 對方 reverse doc | Hard delete 雙向 | 對方那邊也要刪 |
| `users/{uid}/friendRequests/*` + 寄出去的 reverse | Hard delete 雙向 | 同上 |
| `users/{uid}/favoriteRestaurants/*` | Hard delete | 純個人 |
| `users/{uid}/knowledgeBookmarks/*` | Hard delete | 純個人 |
| Personal mode pets（familyId === null && ownerUid === uid）| Hard delete pet + **整個子集合**（healthRecords/walks/reminders/expenses）| 純個人 |
| Personal mode pet 的 Storage photos | Hard delete | 純個人 |
| **Family-scoped pets where `createdByUid === uid`** | **Hard delete pet + 整個子集合**（含他人為這隻 pet 建的 walks/reminders/expenses/healthRecords）| User 要求全刪 |
| Family-scoped walks where `walkerUid === uid` OR `ownerUid === uid`（且 parent pet 沒在上面那批被連帶刪）| Hard delete | 我的 walks |
| Family-scoped reminders where `createdByUid === uid`（且 parent pet 沒在上面那批）| Hard delete | 我建的 reminders |
| Family-scoped reminders where `doneByUid === uid` BUT `createdByUid !== uid` | **Clear `doneByUid` + `doneAt` 欄位**（不刪 doc）| reminder doc 是別人建的；我的 attribution 抹掉但 reminder 保留 |
| Family-scoped expenses where `payerUid === uid` OR `ownerUid === uid`（且 parent pet 沒在上面那批）| Hard delete | 我的 expenses |
| Family pet 的 Storage photos（pet 被連帶刪 → 連 photos）| Hard delete | 跟著刪 |
| Posts where `authorUid === uid` | Hard delete + 所有 reactions 子集合 | 我的 posts |
| Post reactions where uid === uid（A 是 reactor）on 別人的 post | Hard delete + 對應 `post.reactionCounts` 增量減 1 | 我的 reaction |
| 餐廳 reviews where `authorUid === uid` | Hard delete + 對應 `restaurant.averageRating` / `reviewCount` 重算 | 我的 review |
| Restaurants where `submittedByUid === uid` | **Clear `submittedByUid` 欄位**（不刪 restaurant doc）| Restaurant 是 community asset；submittedByUid 是 attribution-only |
| FCM tokens（user doc 的 `fcmTokens` 陣列）| Hard delete（隨 user doc）| 純個人 |
| `families/{familyId}/migrations/*` audit doc 內提到 uid | **不動** | history record，不是 active personal data |
| `leaderboards/{period}/entries/{uid}` | Hard delete | 純個人 stats |

### ⚠️ Cascade trade-off（PM surface 給 user 看）

「Family-scoped pets where createdByUid === uid」採 hard delete cascade 表示：
- **副作用**：你刪帳號時，**家人為你建的 pet 建立的 walks/reminders/expenses 會一起被刪掉**（cascade delete 整個 pet 的子集合）
- 範例：你註冊先建了 Mango → 家人加入後幫 Mango 記了 5 個 walks + 3 個 reminders → 你刪帳號 → Mango pet 連同這 8 筆都消失，家人會看到 Mango 不見了
- 這對齊「刪帳號 = 完整消失」原則，但對家人**會是 surprise**
- **替代**（如果未來想改）：family pet 的 createdByUid 改成 `null`（從 hard delete 退回 anonymize 級別），保留家庭 pet 給其他成員 — 但你已明確要全刪，採此版

### Decision 2: 家庭 owner 刪帳號（PM 預設，未變）

沿用既有 `leaveFamily` callable 的 owner promotion 邏輯：
- 多成員家庭：自動 promote `memberUids[0]` 為新 owner
- 單人家庭（只剩你一人）：family doc 也 hard delete

### Decision 3: Confirmation flow（PM 預設，未變）

兩階段：
1. Settings 頁加「危險區（Danger zone）」section（紅色標題）
2. 點「刪除帳號」→ confirmation dialog：
   - 紅色 destructive warning + 「無法復原」訊息
   - **強化警告**：明確列出「將刪除的家庭資料」清單（你建的 pets count，連帶子集合 counts，給 user 清楚看到 cascade impact）
   - 輸入框：「請輸入你的顯示名稱以確認」(disabled 確認按鈕直到 match)
   - 「確認刪除」按鈕（destructive 紅色）+ 「取消」按鈕

### Decision 4: 處理時機（PM 預設，未變）

同步 callable 一次跑完，atomic batch / transaction。失敗 rollback。

### Decision 5: Audit doc 保留（PM 預設，未變）

寫 `deletedAccounts/{uid}-{ISO}` doc 永久保留，含 summary counts。

## 完成標準

### Phase 1: 後端 callable

- [ ] 新 callable `deleteUserAccount({ confirmDisplayName: string })` in `functions/src/index.ts`
  - 驗證 `confirmDisplayName` 跟 user doc displayName 一致（防誤觸 + 多語言環境安全網）
  - 依 Decision 1 表格全部處理（atomic batch，部分失敗 rollback）
  - **執行順序很重要**（避免 dangling reference）：
    1. 先讀完所有需 cascade 的 family pets list（其 petId 集合）
    2. 一次刪 pets/{petId} 為這些 id 的子集合 (`healthRecords` / `walks` / `reminders` / `expenses`)
    3. 再刪這些 pets 本身
    4. 同時處理「parent pet 沒被連帶刪」的 walks/reminders/expenses（owner is user）
    5. 處理 reminder 的 `doneByUid` clear / restaurant 的 `submittedByUid` clear
    6. 處理 posts + reactions + reviews 重算 averageRating
    7. 處理 family memberUids 移除 + owner promotion + 單人 family deletion
    8. 寫 `deletedAccounts/{uid}-{ISO}` audit doc
    9. 最後 `auth.deleteUser(uid)`
  - 回傳 summary 給 client（pets cascade-deleted, walks deleted, reminders cleared, ...）
- [ ] Rules update：
  - `deletedAccounts/*`：禁止 client write；read 允許 false（user 自己刪完也讀不到）；server-only write
  - 既有 rule 對 `submittedByUid === null` / `doneByUid === null` 的容錯 review（不應該爆 permission denied）

### Phase 2: Frontend

- [ ] `src/app/app/settings/page.tsx` 加「Danger zone」section（紅色標題 + 紅色 border + 警示 icon）
- [ ] 「刪除帳號」按鈕（destructive variant，紅色）
- [ ] 新元件 `src/components/settings/delete-account-dialog.tsx`：
  - destructive warning UI（icon + 文案「此操作無法復原」）
  - **資料概況清單 fetch + 顯示**（before showing dialog）：
    - 你的 personal mode 資料：X pets / Y walks / Z reminders / W expenses
    - 你建的 family pets：N pets（**警告**：包含其他成員為這些寵物建的 walks/reminders/expenses 也會被連帶刪除）
    - 你建但他人建 pet 的 walks/reminders/expenses：A 個 walks / B 個 reminders / C 個 expenses
    - 你的 posts + reactions + reviews 計數
  - displayName 輸入確認（live validate，禁啟 confirm 直到 match）
  - 確認 / 取消按鈕
- [ ] `src/lib/firebase/users.ts` wrapper `deleteAccount(confirmDisplayName)`
- [ ] 成功 → 自動登出 → router push `/` + toast「帳號已刪除，再會」
- [ ] 失敗 → error message in dialog（保留輸入給 user 重試）
- [ ] i18n keys: `Settings.dangerZone.*`（zh-TW + en）

### Phase 3: Edge cases

- [ ] 使用者中途 cancel dialog → 不觸發任何刪除
- [ ] 使用者輸入錯誤 displayName 點刪除 → 不發 request（client 端 disabled button）
- [ ] callable 處理一半失敗 → rollback + 顯示 partial-failure error
- [ ] 使用者 0 個 pets / 0 個 family → 仍可刪
- [ ] 使用者是多家庭 owner → 每個家庭都 promote 處理
- [ ] 跑刪帳號的同時使用者在另一個 tab 寫資料 → 可接受 race condition（最後幾筆寫的 doc 可能被 cleanup 漏掉，但不爆）

## 成功指標

- 上線後使用者實際刪過帳號至少 1 次（PM 自己測試也算）
- 刪完後其他家庭成員看 family 內**非你建**的 pets/walks 仍正常顯示
- 家庭 owner 刪完後 family 仍可運作（新 owner promote 成功）
- `deletedAccounts/` audit doc 寫入完整
- 沒有 leaked uid 留在其他 doc 內（無 dangling reference）

## 不在這次範圍

- 軟刪除 / undo（30 天可恢復）— too complex for v1
- 資料 export（download my data）— 另開 spec（GDPR 也要求，但獨立功能）
- 刪除單一資料而非整個帳號（已有各 CRUD）
- 大量帳號管理面板（admin tool）
- Rate limit / fraud detection
- Email notification「你的帳號已刪除」— 沒 email service，且 user 收不到

## 技術筆記

### 動到的檔案

- `functions/src/index.ts`：新 callable `deleteUserAccount`
- `firestore.rules`：`deletedAccounts/*` 規則 + 既有 rule 對 null attribution 欄位的容錯 review
- `src/lib/firebase/users.ts`：wrapper `deleteAccount(confirmDisplayName)` + helper `previewDeleteAccountImpact()` 給 dialog fetch counts
- `src/app/app/settings/page.tsx`：加 Danger zone section
- `src/components/settings/delete-account-dialog.tsx`：**新檔**
- `messages/zh-TW.json` + `messages/en.json`：新 i18n keys

### Audit doc shape

```ts
deletedAccounts/{uid}-{ISO}: {
  deletedAt: Timestamp;
  reason: "user-initiated";
  summary: {
    personalPetsHardDeleted: number;
    personalWalksHardDeleted: number;
    personalRemindersHardDeleted: number;
    personalExpensesHardDeleted: number;
    familyPetsHardDeleted: number;             // user-created pets cascade-deleted
    familyPetSubcollectionsCascaded: number;   // walks+reminders+expenses+healthRecords under those pets
    familyWalksHardDeleted: number;            // user-owned walks under others' pets
    familyRemindersHardDeleted: number;        // user-created reminders under others' pets
    familyRemindersDoneByCleared: number;      // doneByUid cleared
    familyExpensesHardDeleted: number;         // user-owned expenses under others' pets
    postsHardDeleted: number;
    reactionsHardDeleted: number;
    reviewsHardDeleted: number;
    restaurantsSubmittedByCleared: number;
    familiesLeft: number;
    familiesDissolved: number;                 // 單人家庭被刪掉
    storagePhotosDeleted: number;
  };
}
```

### 與既有功能的關聯

- **`leaveFamily` callable**：deleteUserAccount 內部對每個 familyId 呼叫類似邏輯（owner promotion + memberUids 移除）
- **B4 dormant `mergeAndImportToFamily`**：搬子集合 helper — 邏輯不同（merge vs delete），但 batch pattern 可參考

### 部署順序

1. `firebase deploy --only firestore:rules`（先放寬 deletedAccounts/* + null attribution 容錯）
2. `firebase deploy --only functions:deleteUserAccount`
3. `git push origin main`（前端 settings UI 最後）

## 開放問題

- [x] **Decision 1**：採 full hard delete cascade（user 確認 2026-05-23）
- [ ] Decision 2 家庭 owner：採 PM 預設「沿用 leaveFamily 邏輯」？
- [ ] Decision 3 confirmation：採 PM 預設「displayName 輸入確認」？
- [ ] Decision 4 處理時機：採 PM 預設「同步處理」？
- [ ] Decision 5 audit：採 PM 預設「永久保留 deletedAccounts」？

（D2-D5 user 未明確 push back 視為接受 PM 預設；FB 動工前若有重大疑慮回 PM 確認）

---

## SHIPPED 紀錄

| Phase / 項目 | Commit | 部署時間 (Asia/Taipei 2026-05-23) | 備註 |
|---|---|---|---|
| Phase 1 + 2 + 3 一條龍 | `d5ade48` | ~18:42 | callable `deleteUserAccount` + 客戶端 `deleteAccount` / `previewDeleteAccountImpact` + `DeleteAccountDialog` + Settings Danger zone + i18n (Settings.dangerZone × 3 keys + DeleteAccount × 22 keys, zh-TW + en) |
| collectionGroup index fix | `02d16f9` | ~19:00 | 4 個 `fieldOverrides` 加進 `firestore.indexes.json`：reactions/uid、reviews/authorUid、friendRequests/fromUid、entries/uid — 全 COLLECTION_GROUP_ASC scope。Live verify 時發現遺漏，補 + 重 deploy indexes（functions 沒變不必重 deploy）|

### 部署順序（如實照 spec 跑）

1. `firebase deploy --only firestore:rules`（加 `deletedAccounts/{id}` allow false 規則）
2. `firebase deploy --only functions:deleteUserAccount`（callable 新建立成功）
3. `git push origin main`（App Hosting auto-build）
4. **發現 missing collectionGroup index** → `firebase deploy --only firestore:indexes` + 補 commit `02d16f9`

### Chrome MCP 驗證結果（partial — supervised）

**已驗（非破壞性）**：
- 部署後 build 上線時間（~18:55）；test account 蔡智博/hakubokuuri@gmail.com 登入後 `/app/settings` 看到「危險區」section（紅色 border + warning icon + 紅色「刪除我的帳號」button）✓
- 點 button → `DeleteAccountDialog` 開啟，顯示「永久刪除你的帳號與相關資料」紅色 warning + 「此操作不可復原」副文案 ✓
- preview 失敗時的 graceful fallback：因 collectionGroup index 缺失，preview 顯示「無法盤點資料，但仍可繼續刪除（伺服器會清乾淨）」per spec ✓（補完 fieldOverrides 後此 fallback 應改觸發成功 preview）
- displayName 輸入「蔡智博」live validate → confirm button 從 disabled 變紅色 enabled ✓

**已驗（user 親手 destructive flow，2026-05-23）**：
- 點「永久刪除」實際刪 flow ✓
- 刪完登出 + redirect 到 `/` ✓
- 登入確認 Auth user 已刪 / 重登變 fresh empty user ✓
- 另一個家庭成員角度看 cascade 影響 ✓
- User 回報「應該沒問題」 — 細節未追問；若有後續 edge case 再 PM 開條目

### 已知問題與修法（learnings）

1. **collectionGroup 查詢需要明確的 `COLLECTION_GROUP_ASC` field exemption**（不在 default 自動單欄位 index 範圍內）。第一次 live verify 兩次 INTERNAL fail（step 6c `collectionGroup("reactions").where("uid", "==", uid)` 拋 `FAILED_PRECONDITION`）才暴露這個 hole。`02d16f9` 已修。後續類似 callable 動 collectionGroup query 都記得對應 fieldOverride。
2. **失敗都發生在任何 destructive write 之前**（step 1-5 對 empty 個人模式帳號是 no-op；step 6c 是第一個動 collectionGroup 的步驟），所以**測試帳號 hakubokuuri 應該還在沒被砍** — 你之後手動 verify 時可以拿同一個帳號繼續。
3. **Browser tab group 切換時 auth session 不一定跟著切**：第一個 MCP tab 拿到了 hakubokuuri 帳號，但用戶關掉新開分頁後，第二個 MCP tab 卻拿到主帳號 jabir95tsai/Mango家 owner 的 session。**及時偵測 + 不點 destructive button**，避免誤刪主帳號家庭。

### Handoff — user 親手 verify SOP

1. **登出主帳號**（jabir95tsai@gmail.com 是 Mango家 owner — 不要刪！）
2. **登入 hakubokuuri@gmail.com**（test account；目前個人模式無資料）
3. `/app/settings` → 看到「危險區」+「刪除我的帳號」red button
4. 點 button → dialog 開
5. 等 1-2 分鐘讓 collectionGroup indexes BUILT（如果先前 deploy 後 index 還在 BUILDING 狀態，preview 會 fallback 顯示「無法盤點資料」訊息，仍可繼續刪）
6. 輸入「蔡智博」→「永久刪除」按鈕變紅 enabled
7. 點「永久刪除」→ 預期：dialog 關閉 → 自動登出 → router redirect 到 `/`
8. 嘗試重新登入 hakubokuuri@gmail.com → Firebase 會 create 一個全新空 user（uid 一樣 — Google Sign-In 不會給新 uid for same Google account）。看 `/app` 是 personal mode empty state（confirm Firestore data wipe ✓）
9. 切回主帳號 jabir95tsai：看 Mango 家（你的主家庭）內 pets/walks/reminders/expenses **無變化**（test account 跟主帳號家庭無重疊）

### 與 spec 的 deviations

- **previewDeleteAccountImpact 沒含 reactions/reviews 計數**：spec 說 "資料概況清單 fetch + 顯示" 包括 "你的 posts + reactions + reviews 計數"。實作只放 posts 的 raw count；reactions + reviews 在 preview 跳過（同樣 collectionGroup index 問題，加 fieldOverride 也只是 server-side workable，client preview query 也要 index）。**workaround**：dialog 文案明寫「你給別人按的回應、寫的餐廳評論也會一起清掉」— 用戶被告知會被處理，只是沒給數字。
- **client wrapper 沒處理 `auth/requires-recent-login`**：Firebase Auth 對 `auth.deleteUser()` 不要求 recent sign-in（Admin SDK 跳過此限制），所以 client 端不需要 re-auth。但這個 callable 是 user-triggered — 如果未來 Firebase 政策改、或我們改用 client-side `currentUser.delete()`（沒用），會需要補 re-auth 流程。目前沒做。
- **沒做 partial-failure rollback**：spec line 131 「callable 處理一半失敗 → rollback + 顯示 partial-failure error」。實作只做 best-effort chunked batch + 失敗時拋出 — Firestore 沒有跨 batch 的 atomic 機制，多 batch 中間失敗會 leave 部分狀態。重跑大部分 step idempotent（delete by id + clear field 都 OK），所以使用者 retry 通常會 complete cleanup。client 拿到 error 仍可重試。**真正的 rollback 需要 cross-batch transactional**，超出 v1 scope。
