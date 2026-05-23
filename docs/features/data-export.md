# 資料 Export — Download My Data

狀態：READY-FOR-DEV（PM 預設 5 個決策；user 看完無 push back 即可動工）
建立日期：2026-05-23
最後更新：2026-05-23
規格作者：PM session @ 3cb6fec
角色：Feature Builder（整 stack — callable + UI + i18n）

## User Story

作為**使用者**，我想下載自己在 Mango Pet 上的所有資料（一個 JSON 檔），因為：
- 法規（GDPR / 個資法）給我「資料可攜權」
- 我想看看自己累積了什麼（pets / walks / 健康紀錄等）做個 backup
- 上架條件必須提供這個功能 — **平行於 delete-account 的「我的資料權」**

## 為什麼是現在做

- delete-account 已 SHIPPED — 「忘記我」跟「給我我的資料」對稱平衡
- 資料量還小（每 user < 5MB），export 邏輯單純可同步處理
- PRD §6 上架 prerequisite

## 5 個 product decisions

### Decision 1: 格式 — **JSON**

JSON（machine-readable + 部分 human-readable）。CSV 不適合 nested schema（pets 有子集合 healthRecords）。

### Decision 2: 內容範圍 — 對應 delete-account D1 表（read-only 版）

**包含**：
- `users/{uid}` doc（含 fcmTokens — user 可看到自己有哪些裝置註冊推播）
- `users/{uid}/friends/*`、`/friendRequests/*`、`/favoriteRestaurants/*`、`/knowledgeBookmarks/*`
- Personal mode + family-scoped pets where `ownerUid === uid` OR `createdByUid === uid`
  - 含子集合 `healthRecords` / `walks` / `reminders` / `expenses`（pet 本身被 export 就連帶 export 全部子資料）
- Top-level walks where `walkerUid === uid`（我參與的 walks，即使 pet 是別人建的）
- Top-level reminders where `createdByUid === uid` OR `doneByUid === uid`（我建的 + 我勾過的）
- Top-level expenses where `payerUid === uid`
- Posts where `authorUid === uid`（含我的 reactions 在自己 post）
- Post reactions where `uid === uid` on 別人的 post
- Restaurant reviews where `authorUid === uid`
- Families where `memberUids` includes uid（含 family doc 的 name / inviteCode / 其他 member uids — 揭露你在哪些家庭，但不揭露其他 member 的 PII）

**不包含**：
- `deletedAccounts/*` audit（不是 user 主動建立的 data）
- `legacyCleanups/*` audit（同上）
- `leaderboards/{period}/entries/*`（aggregate stats，不是 raw user data，且資料隨 aggregateLeaderboards 重算）
- 別人 post 的 reactionCounts（aggregate）
- 別人寫的 reminder doneByUid 是你的（包含在你的 reminder export 的 attribution 即可）
- Restaurant 全文（餐廳是 community asset，你的 review 已 export）

### Decision 3: 派送方式 — **同步 download**

Callable 回 JSON object 給 client → client 端 `Blob` + `URL.createObjectURL` → 觸發 browser download `mango-pet-data-{uid}-{ISO}.json`。

替代 async email link：沒 email service，且 user 本來就在 App 內，同步是最直觀。

### Decision 4: 照片 — **URLs only**

JSON 內含 `photoURL` 字串（Firebase Storage public URL）。

**不**下載 binary（Storage object 要打 ZIP，工作量 L、檔案大）。Storage URLs 在 export 後仍可訪問（直到 user 刪帳號或主動刪照片）。

> Note: 對 GDPR 嚴格定義「資料可攜權」可能不夠（user 刪帳號後 URL 會失效），但 v1 對齊 vibe-coding solo 的 pragmatic 路線。未來如有 enterprise customer 要求再升級。

### Decision 5: 觸發點 — **Settings「Privacy & Data」section 之上**

新 section in Settings page，**在 Danger zone 之上**（先給 user 「下載」option 再給「刪除」option，順序符合 progression）。

UI:
- Section title「資料與隱私 / Privacy & Data」
- 按鈕「下載我的資料」/「Download my data」
- 點 → loading state → fetch → Blob → download

## 完成標準

### Phase 1: 後端 callable

- [ ] 新 callable `exportUserData()` in `functions/src/index.ts`
  - 只 export 呼叫者自己的資料（`req.auth.uid` 為準），不接 `targetUid` 參數
  - 依 Decision 2 全部 collections 讀完
  - 組裝成 JSON 物件，schema：
    ```ts
    {
      meta: {
        exportedAt: ISO_string;
        schemaVersion: "v1";
        uid: string;
      };
      user: AppUser;  // users/{uid} doc
      friends: { uid, displayName, photoURL, addedAt }[];
      friendRequests: { sent: [], received: [] };
      favoriteRestaurants: { restaurantId, addedAt }[];
      knowledgeBookmarks: { articleId, addedAt }[];
      pets: Pet[];  // 含子集合在每個 pet 物件內
      walks: Walk[];        // top-level 我參與的
      reminders: Reminder[]; // top-level 我建的或我勾過的
      expenses: Expense[];   // top-level 我付的
      posts: Post[];         // 含 reactions 子集合
      postReactionsOnOthers: PostReaction[];  // 我反應在別人 post
      restaurantReviews: RestaurantReview[];  // 我寫的
      families: { familyId, name, inviteCode, memberUids, ownerUid, createdAt }[];
    }
    ```
  - 回傳給 client（同步，預期 < 5MB）
  - **Optional**：寫 `userExports/{uid}-{ISO}` audit（PM 預設**不寫** — export 不是 destructive，audit 價值低）
- [ ] Rules：不需新 collection 規則（callable 用 Admin SDK 繞過 rules 讀資料）

### Phase 2: Frontend

- [ ] `src/app/app/settings/page.tsx` 加「Privacy & Data」section（在 Danger zone 之上）
- [ ] 新元件 `src/components/settings/export-data-button.tsx`：
  - 按鈕「下載我的資料」（primary or secondary variant，不是 destructive）
  - 點 → 顯示 loading spinner + 「準備中...」
  - 呼叫 wrapper → 拿 JSON → 觸發 download
  - 成功 → toast「資料已下載」+ button 回到可點狀態
  - 失敗 → error message in section（保留 retry）
- [ ] `src/lib/firebase/users.ts` wrapper `exportMyData(): Promise<UserDataExport>`（type alias 看 spec Phase 1）
- [ ] i18n keys: `Settings.privacyData.*`（zh-TW + en）

### Phase 3: Edge cases

- [ ] 0 pets / 0 family / 從沒登入過 → 仍可 export，JSON 內對應欄位為 `[]`
- [ ] callable timeout（檔案太大）→ error message「資料量超出範圍，請聯絡支援」
- [ ] Download 中 user 切到別頁 → browser 仍會完成 download
- [ ] Network 斷 → error toast，retry button

## 成功指標（上線後一週看）

- 至少 1 個使用者 export 過（PM 自己測試也算）
- JSON 結構對應 Decision 2 範圍完整
- 檔案能用瀏覽器打開、文字 editor 看內容（human-readable enough）

## 不在這次範圍

- 照片 binary ZIP（太複雜，URLs 已足）
- CSV format
- 排程 / 自動週期 export
- Import 功能（不是 backup-restore）
- 跟 PWA file system API 整合（純 browser download 即可）
- 加密 export 檔案（user 自己決定怎麼存）

## 技術筆記

### 動到的檔案

- `functions/src/index.ts`：新 callable `exportUserData`
- `src/lib/firebase/users.ts`：wrapper `exportMyData()`
- `src/lib/types.ts`：新 type `UserDataExport`（matching Phase 1 schema）
- `src/app/app/settings/page.tsx`：Privacy & Data section
- `src/components/settings/export-data-button.tsx`：**新檔**
- `messages/zh-TW.json` + `messages/en.json`：`Settings.privacyData.*` namespace

### 跟 delete-account 的關聯

delete-account 是「destructive cleanup with cascade」；本 spec 是「read-only snapshot of same data scope」。Phase 1 callable 的 query 形狀**幾乎跟 deleteUserAccount 的 read-list 階段一樣** — Feature Builder 可以 review delete-account 的讀資料邏輯重用。

### 部署順序

1. `npx firebase deploy --only functions:exportUserData`
2. `git push origin main`（前端 UI）

（無 rules / indexes 改動）

## 開放問題

- [x] **Decision 1**：JSON ✓
- [x] **Decision 2**：對應 delete-account D1 範圍 ✓
- [x] **Decision 3**：同步 download ✓
- [x] **Decision 4**：URLs only ✓
- [x] **Decision 5**：Settings Privacy & Data section ✓
- [ ] Audit doc 寫 `userExports/*` 還是不寫？PM 預設不寫（export 不是 destructive，audit 價值低；如 user 想留 record，回 PM 後加 1 行寫入即可）
