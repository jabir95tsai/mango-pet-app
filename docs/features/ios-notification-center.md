# iOS 首頁通知中心 v1

狀態：**Phase 1 Backend 已部署（2026-11-15）**；Phase 2 iOS code 完成（2026-11-16），待模擬器 / 實機驗收；**納入 1.0 首版送審**（2026-11-16 使用者拍板）
建立日期：2026-11-15
規格作者：grilling session（使用者逐題確認 Q1–Q15）
平台：iOS（Web 不做，見「不做」）
工作量：**M**（Backend phase：1 subcollection + 3 triggers + rules/index/tests；iOS phase：1 頁 + bell 紅點）

## User Vision

> 「新增首頁的提醒 icon 的功能」

首頁右上角 bell（`apps/ios/src/components/home/home-top-bar.tsx`）目前純裝飾、無 onPress、無 badge。本 spec 讓它成為通知中心入口。

⚠️ 推翻 `home-v3-feed-first.md` 的「Reminders 入口在 home（不做）」：使用者 2026-11-15 確認首頁要有提醒入口。Pets「提醒」tab 仍是提醒的**主管理入口**，通知中心只列今日／逾期待辦。

## 決策紀錄（2026-11-15 使用者確認）

| # | 決策 | 結論 |
|---|---|---|
| Q1 | 「提醒」指什麼 | 寵物提醒 + 社交通知，同一個入口 |
| Q2 | 平台 | 只做 iOS |
| Q3 | 點 bell | 進新 stack 頁面 |
| Q4 | Badge | 紅點（不顯示數字） |
| Q5 | 資料架構 | 混合：提醒 client 端直接查 `reminders`；社交事件走 server inbox |
| Q6 | v1 社交事件 | 留言我的貼文、對我的貼文按表情、好友邀請 |
| Q7 | 紅點清除 | `lastSeenAt` 制：進頁即清 |
| Q8 | 版面 | 單頁兩區：待辦提醒（上）/ 動態（下），不用 tab |
| Q9 | 到期提醒是否讓紅點常亮 | **不要**，紅點只看 inbox |
| Q10 | 待辦區範圍 | 今日到期 + 逾期、未完成；可直接勾完成；點列跳 Pets 提醒 tab |
| Q11 | 點擊目的地 | 留言 / 表情 → `feed.tsx` 捲到該貼文；好友邀請 → `friends/index.tsx` |
| Q12 | 合併 | 表情依貼文合併（「Brian 等 3 人」）；留言不合併 |
| Q13 | 過濾 / 保留 | 自己的操作不寫入；封鎖者寫入時跳過 + client 再濾；client 只顯示最近 50 筆、不做 TTL；收回表情刪通知，刪留言保留通知 |
| Q14 | 推播 | 只進 inbox，不發推播 |
| Q15 | 分工 | Backend phase 先做，iOS phase 接上 |

## Phase 1 — Backend（角色：Backend）

### Schema：`users/{uid}/notifications/{notificationId}`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `type` | `"comment" \| "reaction" \| "friendRequest"` | |
| `actorUids` | `string[]` | 觸發者；reaction 合併時為多人（最新在前，最多保留 3 個供顯示） |
| `actorCount` | `number` | reaction 合併的總人數；其他型別為 1 |
| `postId` | `string?` | comment / reaction 必填 |
| `commentId` | `string?` | comment 必填 |
| `commentPreview` | `string?` | 留言前 80 字 |
| `friendRequestId` | `string?` | friendRequest 必填 |
| `createdAt` | `Timestamp` | 合併型別每次新增 actor 時更新為最新時間（讓它浮到頂、觸發紅點） |

Doc ID 規則（讓合併 / 刪除可冪等定位）：
- comment：`comment_{commentId}`
- reaction：`reaction_{postId}`（同篇合併為一則）
- friendRequest：`friendRequest_{requestId}`

共用型別放 `packages/shared-types`。

### Triggers（`functions/src`）

| Trigger | 行為 |
|---|---|
| `posts/{postId}/comments/{commentId}` onCreate | 寫給貼文作者；作者 == 留言者則跳過 |
| `posts/{postId}/reactions/{uid}` onCreate | upsert `reaction_{postId}`：把 uid 加進 `actorUids` 前端、`actorCount + 1`、更新 `createdAt`；作者自己按則跳過 |
| `posts/{postId}/reactions/{uid}` onDelete | 從 `actorUids` 移除、`actorCount - 1`；歸零則刪 doc |
| `users/{uid}/friendRequests/{requestId}` onCreate | 寫給被邀請者 |

共同規則：
- 寫入前檢查收件者是否封鎖 actor，是則跳過（沿用既有封鎖資料來源，見 `apps/ios/src/lib/posts.ts` 的過濾邏輯與 functions 內 moderation helpers）。
- 留言被刪除時**不**刪通知（Q13）。
- 收件者帳號已刪除 / 不存在則跳過。
- 不發推播（Q14）；不把 engagement push 寫進 inbox。

### `users/{uid}.notificationsLastSeenAt`

- `Timestamp`，iOS 進通知頁時用 `serverTimestamp()` 寫入。
- 既有 `users/{uid}` update rule 已允許本人寫自己的 doc（且無欄位白名單，見 backlog「users/{uid} update rule 無欄位白名單」），不需改 rule；若之後補白名單，記得加入此欄位。

### Rules

```
match /users/{uid}/notifications/{notificationId} {
  allow read: if request.auth != null && request.auth.uid == uid;
  allow write: if false; // Admin SDK only
}
```

### Index

- `notifications` 依 `createdAt desc` 單欄位排序，預設 index 即可；若實作需要額外 composite 再補 `firestore.indexes.json`。

### 驗收

- [x] security tests：本人可讀、他人不可讀、client 不可寫（`functions/tests/notifications.test.cjs`）
- [x] trigger 單元測試：自己操作跳過、封鎖者跳過、reaction 合併 / 收回 / 歸零刪除、刪留言不刪通知（同上）
- [x] functions typecheck + test pass — typecheck ✅；`notifications.test.cjs` 5/5 ✅（2026-11-15 emulator；全套 103/105，2 項 r15 失敗為既有問題，見 backlog）
- [x] deploy rules + functions（2026-11-15 使用者同意；`firestore:rules` + 4 個 `notifyOn*` 已部署至 mango-pet-app，asia-east1；production 端到端未驗，待 iOS Phase 2）

實作備註（2026-11-15 Backend）：
- `functions/src/notifications.ts` + `index.ts` 的 `notifyOnCommentCreated` / `notifyOnReactionCreated` / `notifyOnReactionDeleted` / `notifyOnFriendRequestCreated`；與既有 push trigger 分開，互不阻擋。
- reaction 每次事件都從 `posts/{postId}/reactions` 重算 `actorUids`（依 `reactedAt` 新→舊、前 3）與 `actorCount`，重送 / 亂序事件會收斂，不靠 ±1。只有新增的 actor 實際被列入時才更新 `createdAt`。
- 被自動審核隱藏的留言（`findObjectionableTerm`）不寫通知。
- 收件者檢查（profile 存在、無 `deletedAccounts` fence、actor 不在 `blockedUids`）與寫入在同一 transaction。

## Phase 2 — iOS（角色：iOS Feature Builder，視覺交 iOS UI/UX 對齊）

開工前必讀 `docs/design-system.md`（warm-glass、`--radius-*`、reduced-motion 必做）。

### Bell 紅點（`home-top-bar.tsx`）

- 加 `onPress` → `router.push("/notifications")`。
- 紅點條件：`notifications` 最新一筆 `createdAt` > `users/{uid}.notificationsLastSeenAt`（缺值視為從未看過）。只 listen `orderBy(createdAt desc).limit(1)`。
- 到期提醒**不影響**紅點（Q9）。
- a11y：`accessibilityRole="button"`；label 有未讀時為「通知，有新通知」，否則「通知」。
- 觸控區 ≥ 44pt。

### 新頁 `apps/ios/app/notifications.tsx`

Stack 頁面，同 `achievements.tsx` / `family.tsx` 模式（`RouteHeader` + `Screen`）。進頁（focus）即寫 `notificationsLastSeenAt`。

**區塊 1：待辦提醒**
- 查 `reminders`：沿用 Pets 提醒既有查詢（家庭模式 = 家庭共享，個人模式 = 自己的），篩 `dueAt <= 今日結束` 且未完成。
- 每列可勾完成：用 `useReminderActions`（保留 `doneByUid` 歸屬）。
- 點列 → Pets 頁「提醒」tab（`PET_TABS`）。
- 無待辦時整區隱藏。

**區塊 2：動態**
- `orderBy(createdAt desc).limit(50)`。
- client 端再濾一次封鎖者（之後才封鎖的人）。
- 列內容：actor 頭像（`UserAvatar`）+ 文案 + 相對時間。
  - comment：「{name} 留言了你的貼文：{preview}」
  - reaction：「{name} 對你的貼文按了表情」/「{name} 等 {count} 人對你的貼文按了表情」
  - friendRequest：「{name} 想加你為好友」
- 點擊：comment / reaction → `feed.tsx` 並捲到 `postId`（feed 需支援 `?postId=` param；貼文已不存在則僅開 feed）；friendRequest → `friends/index.tsx`。
- 新於「本次進頁前的 lastSeenAt」的列可有淡色底標示（進頁時先記住舊值再寫入）。

**空狀態**：兩區皆空 → 現有 `EmptyState`。
**訪客帳號**：照常顯示，動態區自然為空，不加鎖定提示。

### i18n

`packages/shared-i18n` 新增 `Notifications.*`（zh-TW + en）：title、sections.reminders、sections.activity、comment、reaction、reactionMany、friendRequest、empty、bellUnread。沿用既有 `Home.notifications`。

### 驗收

- [x] iOS typecheck pass（2026-11-16）；`apps/ios/scripts/notifications.test.cjs`（到期篩選 / 封鎖過濾）2/2
- [ ] 他人留言 / 按表情 / 送好友邀請 → bell 出現紅點 → 進頁紅點消失
- [ ] 表情合併文案正確；收回表情後該列消失
- [ ] 待辦勾完成後從列表移除，Pets 提醒 tab 同步，完成者顯示正確
- [ ] 點擊導向正確（含貼文已刪除）
- [ ] VoiceOver 可讀 bell 狀態與各列；reduced-motion 下無動畫
- [ ] 實機驗收（依專案慣例批次）

以上未勾項目 code 已實作，尚未完整驗收。

模擬器 smoke（2026-11-16，iPhone 18 Pro，真實帳號資料）：紅點顯示 → 進頁後回首頁紅點消失 ✅；待辦列（逾期驅蟲藥）與表情動態列顯示、新列淡底 ✅；點表情列 → feed 捲到該貼文 ✅；點待辦列 → Pets「提醒」tab ✅。未測：勾完成（會改真實資料）、新通知觸發紅點、留言 / 好友邀請列、貼文已刪除、VoiceOver、reduced-motion。

實作備註（2026-11-16 iOS Feature Builder）：
- 資料層 `apps/ios/src/lib/notifications.ts`：`useHasUnreadNotifications`（inbox limit 1 + 自己 user doc 兩個 listener；pending serverTimestamp 視為「現在」）、`subscribeNotifications`、`markNotificationsSeen`。
- `app/notifications.tsx`：focus 先讀舊 lastSeen（淡底標示用）再寫入；blur 再寫一次，避免停留期間進來的通知回首頁又亮紅點。動態區 realtime，收回表情即消失。
- 待辦列：外層 Pressable 跳 `/(tabs)/pets?tab=reminders`；VoiceOver 以 custom action「標記完成」勾選（內層勾勾按鈕視覺可點）。`PetReminderCard.onDelete` 改為選填，通知頁不顯示刪除。
- Pets 頁支援 `?tab=`，套用後 `setParams` 清掉，讓下次同值仍生效。
- feed `?postId=`：只在已載入的 feed（自己最近 30 篇等）中找；找不到（已刪除或太舊）就停在頂端。reduced-motion 下 scroll 不動畫。
- 頁面本身無動畫，reduced-motion 只影響 feed 捲動。

## 不做（v1）

- Web / PWA 版（已記 backlog）
- 推播（B4 被反應 / B5 加好友請求仍屬 engagement push 下一波）
- engagement push 歷史進 inbox
- 家庭新成員加入通知
- 每則個別已讀狀態、數字 badge
- 通知 TTL 清理 / 刪除通知
- 通知頁內接受 / 拒絕好友邀請
- 單篇貼文頁
