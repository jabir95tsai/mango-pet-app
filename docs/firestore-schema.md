# Firestore Schema

> Source of truth for Mango Pet 的資料層形狀。Backend session 開工前先讀；其他角色想知道某欄位存哪先看這。
>
> 真正的型別宣告在 [`src/lib/types.ts`](../src/lib/types.ts)，這個文件不重複它，只解釋**結構、邊界、為什麼**。如果這份 doc 與 `types.ts` / `firestore.rules` / `firestore.indexes.json` 對不上，**code 是對的**，請更新這份 doc（並考慮為什麼會脫鉤）。
>
> 最後校對：2026-05-23（Feature Builder session — B1 personal mode schema/rules/indexes）

## TL;DR

- **共享單位是 family，不是 user**。寵物的健康紀錄、遛狗、提醒、開銷都 scope 到 `familyId`，所有家庭成員都能 read/write。
- **`familyId == null` 是合法狀態 — personal mode**（Phase B1，2026-05-23）。沒家庭時主功能仍能用，docs 寫入 `familyId: null`，權限改用「owner field 等於自己」把關：pets/`ownerUid`、walks/`walkerUid`、reminders/`createdByUid`、expenses/`payerUid`。Phase B3 的 `importPersonalToFamily` callable 之後負責把 personal docs 搬進家庭。
- **路徑慣例**：產品資料是 **top-level + `familyId` 欄位** 的扁平 collection，**不是** `users/{uid}/...` 巢狀。
- **legacy `users/{uid}/...` 路徑還在**（pets / reminders / walks / expenses / pets/healthRecords），rules 還開著讀寫，但 client lib 早已不再寫入，只剩 idempotent migration 函式從 legacy 讀資料、寫到新 top-level 路徑。等 [dedupe migration](features/mango-dedupe-migration.md) 跑完才動 cleanup。
- **每個 family-scoped collection 的 rule pattern**：兩條 OR — `isFamilyMember(familyId)` 或對應 collection 的 `isPersonal*Owner(data)`。read 仍容許 `resource == null`（migration helper 探測新 doc 存在性用）。
- **三個 callable + 兩個 scheduled function** 拿 Admin SDK 做 cross-user 寫入（家庭操作 / 好友配對 / leaderboard 聚合 / push 派送）。

---

## 集合總覽

### 目前在用（top-level + family-scoped 為主）

```
users/{uid}                                       — 使用者 profile（含 fcmTokens、familyIds、currentFamilyId）
users/{uid}/friends/{friendUid}                   — 雙向好友（兩邊各寫一份）
users/{uid}/friendRequests/{requestId}            — 待處理好友邀請（requestId == fromUid）
users/{uid}/favoriteRestaurants/{restaurantId}    — 收藏餐廳
users/{uid}/knowledgeBookmarks/{articleId}        — 收藏知識文章

families/{familyId}                               — 家庭主檔（memberUids、inviteCode、ownerUid）
families/{familyId}/migrations/{migrationId}      — ⚠ 尚未存在；dedupe migration spec 規劃中（見「待加 collection」）

pets/{petId}                                      — 寵物（top-level + familyId）
pets/{petId}/healthRecords/{recordId}             — 寵物健康紀錄（family rule 透過 parent pet 判定）

walks/{walkId}                                    — 遛狗紀錄（top-level + familyId + walkerUid）
reminders/{reminderId}                            — 提醒（top-level + familyId + createdByUid）
expenses/{expenseId}                              — 開銷（top-level + familyId + payerUid）

posts/{postId}                                    — 動態貼文（authorUid + visibility）
posts/{postId}/reactions/{uid}                    — 反應（uid == 反應者）

restaurants/{restaurantId}                        — 餐廳（公開讀）
restaurants/{restaurantId}/reviews/{reviewId}     — 餐廳評論

knowledgeArticles/{articleId}                     — 知識文章（公開讀，後台寫）

leaderboards/{period}                             — 排行榜時段主檔
leaderboards/{period}/entries/{uid}               — 排行榜條目（period 例：weekly_2026-W21）
```

### Legacy（仍在 rules 中，client lib 已不寫入；等 [dedupe](features/mango-dedupe-migration.md) + Legacy 清理 sprint 移除）

```
users/{uid}/pets/{petId}
users/{uid}/pets/{petId}/healthRecords/{recordId}
users/{uid}/reminders/{reminderId}
users/{uid}/walks/{walkId}
users/{uid}/expenses/{expenseId}
```

清理依賴：roadmap #3 dedupe 跑完且驗證 → roadmap #5 移除上述 match block 與對應 collection 資料。

### 待加 collection（規格已存在但尚未實作）

| 路徑 | 何時建 | 來源 |
|---|---|---|
| `families/{familyId}/migrations/{migrationId}` | dedupe migration 動工時 | [features/mango-dedupe-migration.md](features/mango-dedupe-migration.md) |

---

## Document schemas

> TypeScript 形狀以 `src/lib/types.ts` 為準。下面只列**Firestore 上實際儲存的欄位 + 為什麼**，型別細節點連結到 `types.ts`。

### `users/{uid}` — [AppUser](../src/lib/types.ts#L11)

| 欄位 | 寫入時機 | 備註 |
|---|---|---|
| `uid` | upsertUser（首次登入） | 與 doc id 同；冗餘存方便 collectionGroup query |
| `displayName`, `email`, `photoURL`, `authProvider`, `locale` | upsertUser | provider 推斷自 `user.providerData[0].providerId` |
| `createdAt`, `lastSeenAt` | upsertUser；lastSeenAt 一小時節流一次 | serverTimestamp |
| `defaultPostVisibility` | upsertUser，預設 `"friends"` | 影響發貼文預設選項 |
| `allowFriendRequests` | upsertUser，預設 `true` | 目前 lib 沒檢查；未來 friends UI 可選擇關閉 |
| `fcmTokens?: string[]` | `enablePush` arrayUnion / `disablePush` arrayRemove / scanReminders 失敗時 arrayRemove | 失效 token 由 scanReminders + sendTestPush 自我清理 |
| `familyIds?: string[]` | createFamily / joinFamilyByCode / leaveFamily / removeFamilyMember | 家庭成員資格清單 |
| `currentFamilyId?: string` | createFamily（auto-set）/ joinFamily（auto-set）/ setCurrentFamily（client 直寫）/ leave 時 FieldValue.delete() | 是 client 端決定看哪個 family 的「active 選擇」 |

⚠ **PII 弱點**：`firestore.rules` 目前允許**任何登入者讀任何 user doc**。`email` / `fcmTokens` / `familyIds` 都被洩漏。修法是把 PII 拆到 sub-doc（如 `users/{uid}/private/contact`）— 已在風險清單，未動工。

### `families/{familyId}` — [Family](../src/lib/types.ts#L31)

| 欄位 | 寫入時機 | 備註 |
|---|---|---|
| `name` | createFamily | 最長 40 chars，server 端 trim |
| `ownerUid` | createFamily；leaveFamily 若 owner 離開則晉升 `memberUids[0]` | 唯一寫 `removeFamilyMember` 用來 gate 「owner-only」操作 |
| `memberUids: string[]` | createFamily / joinFamilyByCode 加 / leaveFamily / removeFamilyMember 刪 | Source of truth；rule 用它判定 isFamilyMember |
| `inviteCode` | createFamily / regenerateInviteCode | 6 位數字字串；唯一性靠 reserveUniqueInviteCode 重試（max 10 次）|
| `inviteCodeExpiresAt?` | 目前沒寫入 | type 預留；未來想加邀請碼過期可用 |
| `createdAt` | createFamily | serverTimestamp |

**寫入路徑**：100% 經 Cloud Function callable（createFamily / joinFamilyByCode / leaveFamily / regenerateInviteCode / removeFamilyMember）。client 不可直寫，rule 禁。

### `pets/{petId}` — [Pet](../src/lib/types.ts#L50)

| 欄位 | 寫入時機 | 備註 |
|---|---|---|
| `familyId` | createPet | 對應 active family；rule 用它判 isFamilyMember。**B1 起允許 `null`**（personal mode；rule fall back 到 ownerUid 等於 self）|
| `ownerUid` | createPet | 建立者，給 attribution 用；family mode 不是權限邊界（任何 family 成員都能改），**personal mode（`familyId == null`）是權限邊界** |
| `name`, `species`, `breed?`, `birthday?`, `gender?`, `weightKg?`, `bio?`, `photoURL?` | createPet / updatePet | 一般欄位 |
| `createdAt` | createPet | serverTimestamp |

特殊：`weightKg` 在 createRecord(type='weight') 時會自動同步寫入，讓 pet card 不用 query healthRecords 也能顯示最新體重。

### `pets/{petId}/healthRecords/{recordId}` — [HealthRecord](../src/lib/types.ts#L135)

| 欄位 | 寫入時機 | 備註 |
|---|---|---|
| `petId` | createRecord | 與 parent 同；冗餘存方便 collectionGroup query |
| `recordedByUid?` | createRecord | 記錄人 attribution |
| `type` | createRecord | `weight` / `feeding` / `vaccine` / `vet` / `medication` |
| `recordedAt` | createRecord | 使用者選的日期，不是 server time |
| `data` | createRecord | 依 type discriminated union（見 types.ts） |
| `notes?`, `createdAt` | createRecord | serverTimestamp |

rule 透過 parent pet 的 `familyId` 判定權限：`get(/databases/.../pets/{petId}).data.familyId`。

### `reminders/{reminderId}` — [Reminder](../src/lib/types.ts#L161)

| 欄位 | 寫入時機 | 備註 |
|---|---|---|
| `familyId` | createReminder | 對應 active family；**B1 起允許 `null`**（personal mode；rule fall back 到 createdByUid 等於 self）|
| `createdByUid` | createReminder | 建立者 attribution；**personal mode（`familyId == null`）是權限邊界** |
| `petId?` | createReminder | optional — 全家通用提醒可不指定 |
| `title`, `description?`, `triggerAt`, `repeat`, `notifyBeforeMinutes` | createReminder / updateReminder | repeat: `none`/`daily`/`weekly`/`monthly`/`yearly` |
| `done` | completeReminder（non-repeat 設 true）/ uncompleteReminder（false） | repeat reminder 永遠 false（advance 而非 complete） |
| `doneAt?` | completeReminder | serverTimestamp |
| `doneByUid?` | completeReminder（含 repeat advance） | 「家裡誰勾的」歸屬顯示用；rule 用 diff 確保不能假冒他人 |
| `notified?`, `notifiedAt?` | scanReminders 派送成功後 | repeat reminder advance 時 reset 為 false |
| `createdAt` | createReminder | serverTimestamp |

**rule 特別之處**：update 時若動到 `doneByUid`，**必須**設成 `request.auth.uid` 或刪除欄位（不能假冒他人勾）。詳見 `firestore.rules` reminders match block。

### `walks/{walkId}` — [Walk](../src/lib/types.ts#L251)

| 欄位 | 寫入時機 | 備註 |
|---|---|---|
| `familyId` | createWalk | 對應 active family；**B1 起允許 `null`**（personal mode；rule fall back 到 walkerUid 等於 self）|
| `walkerUid`, `walkerName?`, `walkerPhotoURL?` | createWalk | 實際遛狗的成員；**personal mode（`familyId == null`）是權限邊界**。Personal walks **不計入** leaderboard（防刷分），守在 aggregateLeaderboards |
| `ownerUid` | createWalk（鏡像 walkerUid） | **legacy 相容**：leaderboard aggregation 仍 group by ownerUid。Legacy 清理 sprint 後可移除 |
| `petId`, `petName?` | createWalk | petName 冗餘存避免 join |
| `startedAt`, `endedAt`, `distanceKm`, `durationMin` | createWalk | 距離與時長算好才寫 |
| `path?: WalkPathPoint[]` | createWalk | optional；自動 GPS 才有，手動補登沒有 |
| `isManual` | createWalk | UI 標記用 |
| `score` | createWalk | `lib/scoring.ts` 計算的加權分數 |
| `notes?`, `createdAt` | createWalk | serverTimestamp |

rule 特別之處：update 只允許 walker 本人（編輯 notes 用，目前 lib 未開放）；delete 任何家庭成員可（清髒資料）。

### `expenses/{expenseId}` — [Expense](../src/lib/types.ts#L352)

| 欄位 | 寫入時機 | 備註 |
|---|---|---|
| `familyId` | createExpense | 對應 active family；**B1 起允許 `null`**（personal mode；rule fall back 到 payerUid 等於 self）|
| `payerUid`, `payerName?` | createExpense | 實際付錢的成員；**personal mode（`familyId == null`）是權限邊界** |
| `ownerUid` | createExpense（鏡像 payerUid） | **legacy 相容**，同 walks |
| `petId`, `petName?` | createExpense | |
| `amount`, `currency: "TWD"` | createExpense | 整數新台幣；currency 預留多幣別未來 |
| `vendor?`, `category`, `spentAt`, `notes?` | createExpense / updateExpense | category 列舉見 types.ts |
| `items?: string[]` | createExpense | AI receipt 抓出來的行項目；手動可留空 |
| `source: "manual" \| "ai_scan"` | createExpense | UI 用來標 AI 圖示 |
| `receiptURL?` | type 預留，目前 lib 沒寫入 | 想存收據圖時用 |
| `createdAt` | createExpense | serverTimestamp |

rule 特別之處：update 只允許 payer；delete 任何家庭成員可。

### `posts/{postId}` — [Post](../src/lib/types.ts#L77)

| 欄位 | 寫入時機 | 備註 |
|---|---|---|
| `authorUid`, `authorName`, `authorPhotoURL` | createPost | 冗餘存避免每次 render 都 join user |
| `petIds: string[]` | createPost | 關聯哪些寵物 |
| `text`, `photoURLs: string[]` | createPost（photoURLs 等上傳完才 updateDoc 寫入） | photos 用 Promise.allSettled，部分失敗仍保留貼文 |
| `visibility` | createPost | `private` / `friends` / `public` |
| `createdAt` | createPost | serverTimestamp |
| `reactionCounts: Record<emoji, number>` | createPost 初始化全 0；setReaction increment +/-1 | rule 允許任何登入者改這個欄位（用 `hasOnly(["reactionCounts"])`）|

⚠ **rule 弱點**：reactionCounts 沒擋負值，理論上 increment(-100) 可以打亂顯示。風險清單 P2。

### `posts/{postId}/reactions/{uid}` — 反應子集

| 欄位 | 寫入時機 | 備註 |
|---|---|---|
| `uid` | setReaction | 與 doc id 同 |
| `emoji` | setReaction | ReactionEmoji 列舉 |
| `reactedAt` | setReaction | serverTimestamp |

rule 簡單：read by signed-in user；write only by 自己（uid == request.auth.uid）。

### `restaurants/{restaurantId}` — [Restaurant](../src/lib/types.ts#L195)

| 欄位 | 寫入時機 | 備註 |
|---|---|---|
| `name`, `address`, `location {lat,lng}` | createRestaurant | location 不用 GeoPoint，純 object（簡化 client） |
| `geohash?`, `googlePlaceId?`, `phone?`, `website?` | createRestaurant | googlePlaceId 用來去重 |
| `petFriendlyLevel`, `hasWaterBowl?`, `hasPetMenu?`, `allowsLargeDogs?` | createRestaurant | tagging |
| `averageRating`, `reviewCount` | createRestaurant 初始化 0；addReview / deleteReview 重算 | 重算用 (avg*count ± rating) / newCount，可能浮點誤差累積（未實作 |
| `submittedByUid?`, `verified` | createRestaurant；verified 預設 false | 目前沒 admin 路徑改 verified |
| `createdAt` | createRestaurant | serverTimestamp |

rule：read 公開（`if true`）；create 限 signed-in 且 submittedByUid 是自己；update/delete 一律禁（client 改不了）。

### `restaurants/{restaurantId}/reviews/{reviewId}` — [RestaurantReview](../src/lib/types.ts#L230)

| 欄位 | 寫入時機 | 備註 |
|---|---|---|
| `restaurantId` | addReview | 冗餘存方便 collectionGroup |
| `authorUid`, `authorName`, `authorPhotoURL` | addReview | 冗餘 |
| `rating: 1-5` | addReview | clamp 在 server lib 端 (`Math.max(1, Math.min(5, ...))`) |
| `text`, `photoURLs?`, `createdAt` | addReview | serverTimestamp |

rule：read 公開；create 限 signed-in 且 authorUid 是自己；update/delete 限作者。

### `knowledgeArticles/{articleId}` — [KnowledgeArticle](../src/lib/types.ts#L312)

| 欄位 | 寫入時機 | 備註 |
|---|---|---|
| `title { "zh-TW", en }` | seed-knowledge.mjs 腳本 | i18n object |
| `category` | seed | `feeding`/`training`/`health`/`breed`/`lifestyle` |
| `contentMd { "zh-TW", en }`, `excerpt?` | seed | Markdown |
| `coverImageURL?`, `authorName`, `publishedAt`, `tags?` | seed | |

rule：read 公開；write 一律禁（只能 admin SDK 寫；目前用 [`scripts/seed-knowledge.mjs`](../scripts/seed-knowledge.mjs)）。

### `leaderboards/{period}/entries/{uid}` — [LeaderboardEntry](../src/lib/types.ts#L291)

period 範例：`weekly_2026-W21`、`monthly_2026-05`、`all_time`

| 欄位 | 寫入時機 | 備註 |
|---|---|---|
| `uid`, `displayName`, `photoURL`, `city?` | aggregateLeaderboards（每日 00:30 Asia/Taipei） | profile snapshot |
| `totalScore`, `totalDistanceKm`, `totalDurationMin`, `walkCount` | aggregateLeaderboards | 從該 period 範圍內的 walks 聚合 |
| `streakDays` | aggregateLeaderboards | 由 walkDays Set 推算（連續天數，含今天或昨天才有 streak）|
| `updatedAt` | aggregateLeaderboards | serverTimestamp 寫入時 |

rule：read 限 signed-in；write 一律禁（Cloud Function 用 Admin SDK 繞過 rule）。

### `users/{uid}/friends/{friendUid}` + `users/{uid}/friendRequests/{requestId}`

| 路徑 | 欄位重點 | 寫入時機 |
|---|---|---|
| `friends/{friendUid}` | uid / displayName / photoURL / addedAt | `acceptFriendRequest` callable 在雙方各寫一份 |
| `friendRequests/{requestId}` | fromUid / fromName / fromPhotoURL / requestedAt（requestId == fromUid） | sendFriendRequest 直寫；rule 限 requestId == fromUid 防偽 |

`removeFriend` callable 在雙方各刪一份。

### `users/{uid}/favoriteRestaurants/{restaurantId}` + `users/{uid}/knowledgeBookmarks/{articleId}`

簡單收藏 marker：`{ addedAt: serverTimestamp }`。Rule 限 owner 自己。

---

## Security Rules 重點

完整版見 [`firestore.rules`](../firestore.rules)。核心 pattern：

### Helpers

```js
function inFamily(familyId, uid) {
  return exists(/databases/$(database)/documents/families/$(familyId))
    && uid in get(/databases/$(database)/documents/families/$(familyId)).data.memberUids;
}

function isFamilyMember(familyId) {
  return request.auth != null && inFamily(familyId, request.auth.uid);
}
```

### 標準 family-scoped collection pattern（Phase B1 後：dual mode）

```js
// Per-collection personal-owner predicates (rules 上方 helper)
function isPersonalPetOwner(d) {
  return d.familyId == null && request.auth != null
    && d.ownerUid == request.auth.uid;
}
// 同樣 pattern for walks/walkerUid, reminders/createdByUid, expenses/payerUid

match /pets/{petId} {
  allow read: if resource == null
    || isPersonalPetOwner(resource.data)
    || isFamilyMember(resource.data.familyId);
  allow create: if request.auth != null
    && request.resource.data.ownerUid == request.auth.uid
    && (
      request.resource.data.familyId == null
      || isFamilyMember(request.resource.data.familyId)
    );
  allow update: if (isPersonalPetOwner(resource.data)
                    || isFamilyMember(resource.data.familyId))
    && (isPersonalPetOwner(request.resource.data)
        || isFamilyMember(request.resource.data.familyId));
  allow delete: if isPersonalPetOwner(resource.data)
    || isFamilyMember(resource.data.familyId);

  match /healthRecords/{recordId} {
    allow read, write: if resource == null
      || isPersonalPetOwner(get(/databases/$(database)/documents/pets/$(petId)).data)
      || isFamilyMember(get(/databases/$(database)/documents/pets/$(petId)).data.familyId);
  }
}
```

**為什麼 dual mode**：personal mode docs 寫入 `familyId: null`，rule fall through 到 `isPersonal*Owner(data)` 分支（owner field 必須等於 `request.auth.uid`）。family mode docs 寫入 `familyId: "fam_xxx"`，走原本 `isFamilyMember(familyId)` 分支。兩條 OR — 任一條件成立即可。

**update 規則**：兩段 AND — 「**動之前** caller 對 doc 有權限」**且**「**動之後** caller 對 doc 仍有權限」。防止 caller 把 doc 改成自己無法存取的狀態（e.g., 改 `ownerUid` 到別人 uid）。

**`resource == null` 為什麼必要**：migration helper 用 getDoc 探測「同 id 的新 doc 是否已存在」。若 doc 不存在，Firestore 套 rule 時 `resource.data.familyId` undefined → 預設 deny；明確允許 read of non-existing docs 修掉這條（不洩漏資訊 — snapshot 只回「doesn't exist」）。同樣 pattern 套在 walks / reminders / expenses。

**Walks / Expenses 的 update 例外**：兩者 update rule 已限定到 `walker == self` / `payer == self`，本身就把 personal + family 兩種模式都涵蓋（owner 寫自己的東西在兩種模式都成立）。不另寫 personal 分支。

### families 主檔

```js
match /families/{familyId} {
  allow read: if request.auth != null
    && request.auth.uid in resource.data.memberUids;
  allow create, update, delete: if false;  // 一律經 callable
}
```

⚠ 風險清單 P1 #4：read 沒處理 `resource == null` — 不存在的 familyId 會 permission denied 而不是 not-found。

### posts reactions 例外 pattern

```js
allow update: if request.auth != null && (
  resource.data.authorUid == request.auth.uid
  || (request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly(["reactionCounts"]))
);
```

任何登入者可改 reactionCounts，**沒擋負值**（風險清單 P2 #6）。

### reminders doneByUid 防偽

```js
allow update: if isFamilyMember(resource.data.familyId)
  && (
    !request.resource.data.diff(resource.data).affectedKeys().hasAny(["doneByUid"])
    || !("doneByUid" in request.resource.data)
    || request.resource.data.doneByUid == request.auth.uid
  );
```

動到 `doneByUid` 必須等於 `request.auth.uid` 或不存在；不能假冒「媽媽已餵」。

---

## Indexes

完整版見 [`firestore.indexes.json`](../firestore.indexes.json)，下面對應到實際 query：

| Collection / Group | Fields | 被誰用 |
|---|---|---|
| `posts` (COLLECTION) | visibility ASC, createdAt DESC | `listPublicPosts` |
| `posts` (COLLECTION) | authorUid ASC, createdAt DESC | `listMyPosts` |
| `posts` (COLLECTION) | authorUid ASC, visibility ASC, createdAt DESC | `listFriendsPosts`（`authorUid in chunk` + `visibility in [...]` + orderBy；每 chunk ≤ 30 uids）|
| `reminders` (COLLECTION_GROUP) | done ASC, notified ASC, triggerAt ASC | `scanReminders`（collectionGroup query）|
| `reminders` (COLLECTION) | familyId ASC, triggerAt ASC | `listReminders`, `listUpcomingReminders` |
| `reminders` (COLLECTION) | familyId ASC, triggerAt DESC | `listOverdueReminders` |
| `reminders` (COLLECTION) | familyId ASC, done ASC, triggerAt ASC | 預留（目前 lib 端 filter，未來想 server 端 filter 時用）|
| `walks` (COLLECTION_GROUP) | ownerUid ASC, startedAt DESC | legacy 路徑與 leaderboard aggregation |
| `walks` (COLLECTION) | familyId ASC, startedAt DESC | `listWalks` |
| `pets` (COLLECTION) | familyId ASC, createdAt ASC | `listPets` |
| `pets` (COLLECTION) | ownerUid ASC, familyId ASC, createdAt ASC | `listPersonalPets`（B1）|
| `expenses` (COLLECTION) | familyId ASC, spentAt DESC | `listExpenses`, `listExpensesInRange` |
| `expenses` (COLLECTION) | payerUid ASC, familyId ASC, spentAt DESC | `listPersonalExpenses`（B1）|
| `walks` (COLLECTION) | walkerUid ASC, familyId ASC, startedAt DESC | `listPersonalWalks`（B1）|
| `reminders` (COLLECTION) | createdByUid ASC, familyId ASC, triggerAt ASC | `listPersonalReminders`, `listPersonalUpcomingReminders`（B1）|
| `reminders` (COLLECTION) | createdByUid ASC, familyId ASC, triggerAt DESC | `listPersonalOverdueReminders`（B1）|
| `healthRecords` (COLLECTION_GROUP) | type ASC, recordedAt ASC | `listWeightSeries` |
| `healthRecords` (COLLECTION_GROUP) | type ASC, recordedAt DESC | `listRecords` |

> Single-field 自動 index 不在這列。Restaurant 目前只用 orderBy(createdAt desc) + limit，不需 composite。

---

## Storage paths

定義在 [`src/lib/firebase/storage.ts`](../src/lib/firebase/storage.ts)：

```
users/{uid}/pets/{petId}/avatar.{ext}        — 寵物大頭照
users/{uid}/posts/{postId}/{idx}.{ext}       — 貼文照片
```

[`storage.rules`](../storage.rules)：

```js
match /users/{uid}/{allPaths=**} {
  allow read: if request.auth != null;        // ⚠ 任何登入者可讀
  allow write: if request.auth.uid == uid
    && request.resource.size < 10 * 1024 * 1024
    && request.resource.contentType.matches("image/.*");
}
```

⚠ 風險清單 P2 #10：read 對所有登入者開放，依賴 Firestore rule 先擋住 post doc 才能避免拿到 photo URL。defense-in-depth 弱。

---

## Migration 狀態

| 集合 | Client lib 寫入新路徑？ | Legacy 路徑還可讀寫？ | 何時清理 |
|---|---|---|---|
| `pets` | ✅ 只寫 top-level | ✅（rule 還開） | roadmap #5 |
| `reminders` | ✅ 只寫 top-level | ✅ | roadmap #5 |
| `walks` | ✅ 只寫 top-level | ✅ | roadmap #5 |
| `expenses` | ✅ 只寫 top-level | ✅ | roadmap #5 |
| `pets/healthRecords` | ✅ 只寫 top-level | ✅ | roadmap #5 |

`src/components/family/family-provider.tsx` 在每個 `(uid, familyId)` 第一次載入時，跑 5 個 `migrateLegacy*ToFamily()` 函式（全 idempotent — 用 `getDoc(newRef)` 探測，存在則跳過）。完成後存 `localStorage["mango.migrated.{uid}.{familyId}"]="1"` 不再重跑。

⚠ 重複資料來源：legacy `users/{uid}/pets/...` 與 family auto-create 時 client 又建一份的歷史，導致部分使用者 `/app/pets` 看到兩隻 Mango。解法見 [features/mango-dedupe-migration.md](features/mango-dedupe-migration.md)（callable Cloud Function，dryRun + audit doc）。動工前需先加 `families/{familyId}/migrations/{id}` rule（風險清單 P1 #3）。

---

## 已知 schema 風險（與 Backend session 風險清單對應）

| 嚴重度 | 項目 | 狀態 |
|---|---|---|
| P1 | `users/{uid}` rule 過寬（PII 外洩） | 需拆 sub-doc，未動工 |
| P1 | `families/{familyId}/migrations/{id}` rule 缺失（擋 dedupe） | dedupe 動工前的硬 prerequisite |
| P1 | `families/{familyId}` rule 沒 `resource == null` 容錯 | 一行修法，未動工 |
| P2 | `posts` reactionCounts 沒擋負值 | 順便修，未動工 |
| P2 | App Hosting console 殘留錯誤 `APP_ID`（地雷） | 純 console 操作，未動工 |
| P2 | Storage rules 過寬 | 依賴 Firestore rule 擋，未動工 |
| P2 | `scanReminders` N+1 | 性能優化，未動工 |
| P2 | `aggregateLeaderboards` collectionGroup 全 walks | 未來規模問題，未動工 |

---

## 修改這份 doc 的時機

| 動作 | 是否要回來改 |
|---|---|
| 加 / 改 collection 的欄位 | **要**（同步表格）|
| 改 rule pattern / helper | **要**（更新「Security Rules 重點」）|
| 加 / 刪 index | **要**（更新 indexes 表）|
| 改 lib query 形狀 | 若觸發新 index 需求，**要**；否則只改 lib |
| 加新 Cloud Function | 視情況（影響 schema 才要） |
| 改 storage path | **要**（更新 Storage paths）|

每次動工結束、commit 前自查：「我這個 commit 有沒有改到上面任何一條 trigger？」有就把這份 doc 一起更新。
