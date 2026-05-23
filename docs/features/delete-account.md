# 刪除帳號功能

狀態：READY-FOR-DEV（D1 由 user 確認改為 full hard delete cascade 2026-05-23；D2-D5 沿用 PM 預設；可動工）
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
