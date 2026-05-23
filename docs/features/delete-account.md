# 刪除帳號功能

狀態：READY-FOR-DEV（PM 預設 5 個決策；user 看完無 push back 即可動工）
建立日期：2026-05-23
最後更新：2026-05-23
規格作者：PM session @ a889e66
角色：Feature Builder（整 stack — callable + rules + UI + i18n）

## User Story

作為**使用者**，我想要能完全刪除我的帳號，因為：
- 法規（GDPR / 個資法）給我刪除個人資料的權利
- 我可能不想再用 App、希望 footprint 盡可能消失
- 上架條件必須提供這個功能

並且**刪除我的帳號不該破壞家人的資料** — 我跟家人共用的 walks / reminders / expenses 留給家人，只是 author 顯示「已刪除的使用者」。

## 為什麼是現在做

- PRD §6「上架條件」明列「GDPR / 個資法基本合規」 — 上架 prerequisite，不是 nice-to-have
- 越早做使用者越少，cleanup 邏輯越單純（現在自己 + 測試家庭，等實際使用者上線就難 backfill）
- 家庭 epic + personal mode 都 ship 完，schema 範圍完整，可一次處理乾淨

## 5 個 product decisions（PM 預設方案，待 user push back）

### Decision 1: 個人 vs 共用資料的處理策略

**PM 預設**：hard delete 純個人，anonymize 共用

| 資料類型 | 策略 | 理由 |
|---|---|---|
| `users/{uid}` doc | Hard delete | 純個人 |
| Firebase Auth user | Hard delete（admin SDK）| 純個人 |
| `users/{uid}/friends/*` + 對方 reverse doc | Hard delete 雙向 | 對方那邊也要刪 |
| `users/{uid}/friendRequests/*` + 寄出去的 reverse | Hard delete 雙向 | 同上 |
| `users/{uid}/favoriteRestaurants/*` | Hard delete | 純個人 |
| `users/{uid}/knowledgeBookmarks/*` | Hard delete | 純個人 |
| Personal mode pets/walks/reminders/expenses（familyId === null）| Hard delete + 子集合 | 無人共用 |
| Personal mode pet 的 photos in Storage | Hard delete | 純個人 |
| Family-scoped pets — `createdByUid` / `ownerUid` → null | Anonymize | 留給家庭其他成員看見的寵物資料 |
| Family-scoped walks — `walkerUid` / `ownerUid` → null + `walkerName` → "（已刪除的成員）" | Anonymize | walks 紀錄留著，但 attribution 抹掉 |
| Family-scoped reminders — `createdByUid` / `doneByUid` → null | Anonymize | reminder 紀錄留著 |
| Family-scoped expenses — `payerUid` / `ownerUid` → null + `payerName` → "（已刪除的成員）" | Anonymize | expense 紀錄留著 |
| Family-scoped pet 的 photos in Storage | **保留** | 屬於 family，不是個人 |
| `posts/*` authored by user | Anonymize（authorUid → null, authorName → "（已刪除的使用者）"）| feed 已存在的內容不該突然消失 |
| `posts/*/reactions/{uid}` | Hard delete | 純個人，順便讓 post reactionCounts 減 1（增量更新）|
| `posts/*` 內含使用者的 photoURLs | **保留** | 已是 immutable URL，不抓回 |
| 餐廳 reviews authored by user | Anonymize（authorUid → null, authorName → "（已刪除的使用者）"）| review 仍對其他人有用 |
| `families/{familyId}` 的 memberUids 內含 uid | 從陣列移除（同 leaveFamily）| 自然觸發 |
| FCM tokens / fcmTokens 陣列 | Hard delete | 純個人 |
| `leaderboards/{period}/entries/{uid}` | Hard delete | 純個人 stats |

### Decision 2: 家庭 owner 刪帳號

**PM 預設**：沿用既有 `leaveFamily` callable 的 owner promotion 邏輯

- 多成員家庭：自動 promote `memberUids[0]` 為新 owner
- 單人家庭（只有自己）：family doc 也 hard delete（含 invite code reservation 釋放）

### Decision 3: Confirmation flow

**PM 預設**：兩階段，destructive 警告 + displayName 輸入確認

1. Settings 頁加「危險區（Danger zone）」section（紅色標題）
2. 點「刪除帳號」→ confirmation dialog：
   - 紅色 destructive warning icon + 「無法復原」訊息
   - 列出將刪 / 保留的資料概況（X 個 pets / Y 個 walks / Z 個 families…）
   - 輸入框：「請輸入你的顯示名稱以確認」(disabled 確認按鈕直到 match)
   - 「確認刪除」按鈕（destructive 紅色）+ 「取消」按鈕

### Decision 4: 處理時機

**PM 預設**：同步處理（callable 一次跑完，平均 < 5 秒）

- 使用者數小，無需 async queue
- 即時 feedback 體驗較好
- 失敗可 rollback（atomic batch）

### Decision 5: Audit doc 保留

**PM 預設**：寫 `deletedAccounts/{uid}-{ISO}` doc，永久保留

- 記錄：deletedAt、處理 summary（多少 docs hard deleted / anonymized）、初始 reason（user-initiated）
- 用於合規 audit、debug、未來如使用者投訴「我沒刪過」可查
- 不含 PII（uid 是 firestore-generated，無 email / name）

## 完成標準

### Phase 1: 後端 callable

- [ ] 新 callable `deleteUserAccount({ confirmDisplayName: string })` in `functions/src/index.ts`
  - 驗證 confirmDisplayName 跟 user doc displayName 一致（防誤觸 + 多語言環境的安全網）
  - 依 Decision 1 表格全部處理（batch / transaction，部分失敗 rollback）
  - Decision 2 sleeve：family owner promotion / single-member family deletion
  - 寫 `deletedAccounts/{uid}-{ISO}` audit doc
  - 最後 Firebase Admin SDK `auth.deleteUser(uid)`
  - 回傳 summary 給 client（pets deleted, walks anonymized, ...）
- [ ] Rules update：
  - `deletedAccounts/*`：禁止任何 client write，admin SDK 寫入；read 限本人（user 看不到別人的 deleted record）— **但 user 自己 deleted 後也讀不到了，所以 read 允許 false 即可**
  - Family-scoped collection 的 read rule 處理 `authorUid === null` / `walkerUid === null` 的 doc 不爆 permission denied（如果現有 rule 寫 `resource.data.familyId != null && isFamilyMember(familyId)` 的 family-scoped check 不依賴 uid 欄位 → 應該無需改 rule，但要驗）

### Phase 2: Frontend

- [ ] `src/app/app/settings/page.tsx` 加「Danger zone」section（紅色標題、紅色 border）
- [ ] 「刪除帳號」按鈕（red, destructive variant）
- [ ] 新元件 `src/components/settings/delete-account-dialog.tsx`：
  - destructive warning UI
  - 顯示資料概況（async fetch counts before showing）
  - displayName 輸入確認（live validate）
  - 確認 / 取消按鈕
- [ ] `src/lib/firebase/users.ts` wrapper `deleteAccount(confirmDisplayName)`
- [ ] 刪除成功 → 自動登出 → router push `/` + toast「帳號已刪除，再會」
- [ ] 失敗 → error message in dialog（保留輸入給 user 重試）
- [ ] i18n keys: `Settings.dangerZone.*`（zh-TW + en）

### Phase 3: Edge cases

- [ ] 使用者中途 cancel dialog → 不觸發任何刪除
- [ ] 使用者輸入錯誤 displayName 點刪除 → 不發 request
- [ ] callable 處理一半失敗 → rollback + 顯示 partial-failure error message
- [ ] 使用者有 0 個 pets / 0 個 family → 仍可刪
- [ ] 使用者是多家庭 owner → 每個家庭都 promote 處理
- [ ] 跑刪帳號的同時使用者在另一個 tab 寫資料 → 可接受（最後幾筆寫的 doc 可能被 cleanup 漏掉，但不爆）

## 成功指標

- 上線後使用者實際刪過帳號至少 1 次（PM 自己測試也算）
- 刪完後其他家庭成員看 family pets/walks 仍正常顯示（anonymized 但不消失）
- 家庭 owner 刪完後 family 仍可運作（新 owner promote 成功）
- `deletedAccounts/` audit doc 寫入完整
- 沒有 leaked uid 留在其他 doc 內（無 dangling reference）

## 不在這次範圍

- 軟刪除 / undo（30 天可恢復）— too complex for v1
- 資料 export（download my data）— 另開 spec（GDPR 也要求，但獨立功能）
- 刪除單一資料而非整個帳號（已有各 CRUD）
- 大量帳號管理面板（admin tool）
- Rate limit / fraud detection（誤觸 / 惡意大量刪）
- Email notification「你的帳號已刪除」— 沒 email service，且 user 也收不到了

## 技術筆記

### 動到的檔案

- `functions/src/index.ts`：新 callable `deleteUserAccount`
- `firestore.rules`：`deletedAccounts/*` 規則 + 既有 rule 對 null author 的容錯 review
- `src/lib/firebase/users.ts`：wrapper `deleteAccount(confirmDisplayName)`
- `src/app/app/settings/page.tsx`：加 Danger zone section
- `src/components/settings/delete-account-dialog.tsx`：**新檔**
- `messages/zh-TW.json` + `messages/en.json`：新 i18n keys

### Audit doc shape

```ts
deletedAccounts/{uid}-{ISO}: {
  deletedAt: Timestamp;
  reason: "user-initiated";
  summary: {
    personalPetsDeleted: number;
    personalWalksDeleted: number;
    personalRemindersDeleted: number;
    personalExpensesDeleted: number;
    familyPetsAnonymized: number;
    familyWalksAnonymized: number;
    familyRemindersAnonymized: number;
    familyExpensesAnonymized: number;
    postsAnonymized: number;
    reactionsDeleted: number;
    reviewsAnonymized: number;
    familiesLeft: number;
    familiesDissolved: number;  // 單人家庭被刪掉
  };
}
```

### 與既有功能的關聯

- **`leaveFamily` callable**：deleteUserAccount 內部對每個 familyId 呼叫類似 leaveFamily 邏輯（owner promotion + memberUids 移除）
- **B4 dormant code**：`mergeAndImportToFamily` 共用 helper（搬子集合）— **可考慮重用**作為 anonymize 的 building block，但 anonymize 不是 merge，差異大；建議獨立寫
- **`#4 mango-dedupe-migration`**：類似工作量 M 級的 batch 處理，可參考其 dry-run + audit 設計

### 部署順序

1. `firebase deploy --only firestore:rules`（先放寬 deletedAccounts/* + null author 容錯）
2. `firebase deploy --only functions:deleteUserAccount`
3. `git push origin main`（前端 settings UI 最後）

## 開放問題（PM 建議在 Decision 段已 surface；user 看完 push back）

- [ ] Decision 1 資料策略：採 PM 預設「hard delete personal / anonymize shared」？
- [ ] Decision 2 family owner：採 PM 預設「沿用 leaveFamily 邏輯」？
- [ ] Decision 3 confirmation：採 PM 預設「displayName 輸入確認」？（替代方案：什麼都不輸入直接點 = 太危險；password 確認 = OAuth 沒 password 無法做）
- [ ] Decision 4 處理時機：採 PM 預設「同步處理」？（替代：async queue 處理大量 batch — 現階段 overkill）
- [ ] Decision 5 audit：採 PM 預設「永久保留 deletedAccounts」？（替代：1 年後自動清；GDPR 不強制保留期，但 audit 需要時可查）
- [ ] **排序問題**：插隊家庭 epic 還是等家庭 epic 收完？PM 建議等家庭 epic 收完（B4 rollback + live test → #1b → #3 prereq → #3 → #4 → 然後做這個）。理由：家庭 epic 是 in-flight，刪帳號是 nice-to-have 但不擋使用者目前流程
