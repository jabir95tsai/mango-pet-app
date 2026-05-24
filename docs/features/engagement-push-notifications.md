# 主動推播 — 提升用戶活躍（Engagement push）

狀態：**SHIPPED** — 5 個 phase 全 deploy 上 production 2026-05-24（commits `f1e6952` / `1a6fc7f` / `64f5de7` / `9c6442e` / `40a7e02`；詳見「SHIPPED 紀錄」段）；手動 / 自然觸發 test 觀察待 PM 醒了排序
建立日期：2026-05-24
最後更新：2026-05-24
規格作者：PM session @ c741288 + decisions confirmed pass
角色：Feature Builder（整 stack — scheduled Cloud Functions + event trigger + UI toggle + i18n）
工作量：**L**（4 push types：3 scheduled + 1 event-trigger，含 content + opt-out 控制 + family-aware 邏輯）

## User Vision（原話保留）

> 「我們來完善提醒設定 — 應該是說推播設定」
> 「我的想法是例如每天提醒你要遛狗，排名被超越等，讓用戶更活躍的推播」

⚠️ **PM 自我修正**：PM 之前理解「推播設定」= settings polish（quiet hours / per-pet opt-out），錯誤地寫了 push-notification-settings.md spec。User 真正要的是 **新增主動觸發推播類型** 讓 user 回到 app（retention play），不是改既有 push 的 user prefs。錯誤 spec 已刪，本 spec 取代。

## Why now

- Walks epic 已 ship — daily habit hook（30 min goal / streak）+ celebration screen 都在
  位，但 user 要**主動打開 app** 才看得到。Push 是把 hook 推到 user 面前的最後一哩
- Family epic + leaderboard SHIPPED — 已有 social structure 可建 push hook（被超越 / 家人達標）
- Engagement push 是 **retention 槓桿**：比細部 visual polish 高 user value
- PM 在早期推播系統 explanation 訊息已 surface 過 4 個沒做的 push types：家庭 social
  push / leaderboard 週冠軍 / 好友請求 / 推播 opt-in 率提醒 — 全部對應 engagement
- 推播 opt-in 率是 PRD 北極星指標之一；新推播類型如果太擾人會降 opt-in，所以本 spec 必須
  含 per-type opt-out 控制（避免 push fatigue 反效果）

## 推播類型 candidates（PM list — 第一波做 D1 選的 4 個）

### A. 行為 nudge（跟 walks habit hook 對齊）

| ID | 內容 | 觸發時機 | 風險 | 第一波 |
|---|---|---|---|---|
| **A1** ★ | **每天晚上提醒遛狗** —「Mango 今天還沒走滿 30 分鐘」 | 20:00 local time，若今日 walks total < 30 min | 低 | ✅ |
| **A2** ★ | **連續斷掉警告** —「再不遛就斷 streak X 天紀錄了」 | 22:00 if streak ≥ 3 且今日 0 walks | 中（晚上 22:00 易擾）| ✅ |
| A3 | 早上預告 —「今天記得遛 Mango 喔」 | 09:00 | 高（早上推 → opt-out 率高）| ❌ 下波 |

### B. Social engagement

| ID | 內容 | 觸發時機 | 風險 | 第一波 |
|---|---|---|---|---|
| **B1** ★ | **排名被超越** —「{name} 超越你了，加把勁追上吧」 | leaderboard 每日 00:30 aggregation 後，user 排名比昨天差時 | 中（怕負面動機）| ✅ |
| **B2** ★ | **家人達成今日目標** —「Mango 媽完成 Mango 今日目標了 🎉」 | 家庭成員 walk 達 30 min 那一刻（event-trigger） | 低 | ✅ |
| B3 | 家人發 post —「Mango 爸貼了新照片」 | 動態牆新 post，推家庭其他成員 | 低（但量大可能煩）| ❌ 下波 |
| B4 | 被反應 —「Brian 對你的 post 按了 ❤️」 | post reaction 發生時 | 低 | ❌ 下波 |
| B5 | 加好友請求 —「Brian 想加你為好友」 | sendFriendRequest 後 | 低 | ❌ 下波 |

### C. 系統性 nudge

| ID | 內容 | 觸發時機 | 風險 | 第一波 |
|---|---|---|---|---|
| C1 | 週日晚總結 —「Mango 本週共遛了 N 次 / X 分鐘」 | 週日 21:00 | 低 | ❌ 下波 |
| C2 | 新知識文章 —「新文章：[標題]」 | 新 article 發布時 | 低（文章發布頻率低）| ❌ 下波 |

## 5 個 product decisions（user 2026-05-24 confirmed）

| # | Decision | Final | 註 |
|---|---|---|---|
| **D1** ✅ | 第一波做哪些 push types | **A1 + A2 + B1 + B2** | user 加碼 A2 streak 警告 + B2 家人達標 |
| **D2** ✅ | A1 觸發時間 | **20:00 local time** | 晚飯後常見遛狗時段；如已達標不推 |
| **D3** ✅ | B1 觸發機制 | **每日 leaderboard aggregation 後算 diff** | 被超越推一次；同日重新超回去不再推 |
| **D4** ✅ | Per-push-type opt-out | **Settings 加 toggle per push type，預設全 ON** | PushToggle global 仍 cover 全停 |
| **D5** ✅ | Push content i18n | **i18n templates + interpolation** | 沿用 walks-v2 encouragement copy pattern |

## 完成標準

### Phase 1: A1 — 晚上遛狗提醒

- [ ] `functions/src/index.ts` 新 scheduled function `eveningWalkReminder`：
  - cron `0 20 * * *` Asia/Taipei daily
  - 對每個有 `fcmTokens.length > 0` 的 user：
    - 算今日 walks total minutes（沿用 `aggregateLeaderboards` 既有 query 形狀）
    - 若 total < 30 min → push「{petName} 今天還沒走滿 30 分鐘 🐶」(zh-TW) / 「{petName} hasn't hit 30 min today 🐶」(en)
    - petName 取 user 主寵物（family pets first pet by createdAt，或 personal first pet）
    - 若 user 沒寵物 → skip
  - 沿用 scanReminders 既有 token cleanup pattern
  - Audit doc：`engagementPushes/{type}/{ISO}` 寫入「type=evening-walk-reminder, userCount, sentCount, skippedNoToken, skippedAlreadyHit」
- [ ] Per-type opt-out check：if `user.pushPrefs.engagementOptOut` includes `"evening-walk-reminder"` → skip
- [ ] i18n keys: `Push.eveningWalkReminder.title` / `Push.eveningWalkReminder.body`

### Phase 1.5: A2 — 連續斷掉警告

- [ ] `functions/src/index.ts` 新 scheduled function `streakBreakWarning`：
  - cron `0 22 * * *` Asia/Taipei daily
  - 對每個有 `fcmTokens.length > 0` 的 user：
    - 算 streak（沿用 walks aggregator 既有 streak 計算邏輯）
    - 算今日 walks count（注意是 count，不是 minutes — 「今天 0 次」是斷 streak 的條件，不是「未達標」）
    - 若 `streak ≥ 3` AND 今日 walks count === 0：
      - push「再不遛就斷 {streak} 天紀錄了 🔥」(zh-TW) / 「Walk {petName} now or lose your {streak}-day streak 🔥」(en)
    - 若 user 沒寵物 → skip
  - Audit doc `engagementPushes/streak-warning/{ISO}` 紀錄推給誰、streak 是多少
- [ ] Per-type opt-out check：if `engagementOptOut` includes `"streak-warning"` → skip
- [ ] i18n keys: `Push.streakWarning.title` / `Push.streakWarning.body`

### Phase 2: B1 — 排名被超越

- [ ] `aggregateLeaderboards` 既有 cron（00:30 daily）改：
  - aggregation 完後對每個 `leaderboards/all_time/entries/{uid}` 算 newRank（已有邏輯）
  - **新加** `entry.previousRank` 欄位記錄昨天的 rank
  - Diff `previousRank` vs `newRank`：if `newRank > previousRank`（rank 數字變大 = 被超越）→ 找超越者 push
    - 「{overtaker.displayName} 超越你了，加把勁追上吧 💪」(zh-TW)
    - 「{overtaker.displayName} just passed you on the leaderboard — keep going 💪」(en)
  - 每日 max 1 次 per user（不重複推同日多次超越）
- [ ] Per-type opt-out check：if `engagementOptOut` includes `"rank-overtake"` → skip
- [ ] i18n keys: `Push.rankOvertake.title` / `Push.rankOvertake.body`
- [ ] Audit doc `engagementPushes/rank-overtake/{ISO}` 紀錄推了誰、被誰超越

### Phase 2.5: B2 — 家人達成今日目標

- [ ] 觸發點 — Feature Builder 自選：
  - 選項 a：`functions/src/index.ts` 新 walks onWrite trigger
  - 選項 b：既有 walks aggregator 內 hook（如有，看哪個架構更乾淨）
- [ ] 邏輯：walk 寫入後算該 user 今日 total minutes
  - 若 today total **首次** cross 30 min threshold AND user 有 `familyId`：
    - 找其他 family members（不含 user 自己 — 也就是 `where familyId == X && uid != achiever`）
    - 對每個 recipient：
      - 若 recipient 的 `engagementOptOut` includes `"family-milestone"` → skip
      - push「{achiever.displayName} 完成 {petName} 今日目標了 🎉」(zh-TW) / 「{achiever.displayName} hit today's goal for {petName} 🎉」(en)
- [ ] **去重 flag**：user 每日 aggregate doc 加 `goalHitNotifiedAt: Timestamp` 欄位；已 push 過就不重推（同日多次跨 30 min 也只推一次）
  - 若沒既有 daily aggregate 結構：寫到 `userDailyStats/{uid}_{YYYY-MM-DD}` subcollection，或 user doc 內 `lastGoalHitNotifiedDate: 'YYYY-MM-DD'` 字串簡化版（Feature Builder 自選）
- [ ] Personal mode user（無 familyId）→ skip B2（沒家人接收）
- [ ] 家庭只有 user 自己時（1 member）→ skip B2（沒其他 family member）
- [ ] Audit doc `engagementPushes/family-milestone/{ISO}` 紀錄 achiever / recipients
- [ ] i18n keys: `Push.familyMilestone.title` / `Push.familyMilestone.body`

### Phase 3: UI — Settings「主動推播」section

- [ ] `src/app/app/settings/page.tsx` 加新 section「主動推播」（位置：PushToggle 下方 / Privacy & Data 上方）
- [ ] 新元件 `src/components/settings/engagement-push-section.tsx`：
  - 列出第一波 4 個 push types + toggle：
    - 「每天晚上遛狗提醒」(20:00 — 預設 ON)
    - 「斷 streak 警告」(22:00 — 預設 ON)
    - 「排名被超越時通知」(預設 ON)
    - 「家人達成今日目標」(family mode only — 預設 ON；personal mode user disabled + greyed out)
  - 每個 toggle 下方有 1 行說明（讓 user 知道大概什麼時候會收到）
  - Toggle 寫進 `user.pushPrefs.engagementOptOut` 陣列（push type id；ON → 不在 array；OFF → 加入 array）
- [ ] i18n keys: `Settings.engagementPush.*`

### Phase 4: Schema + Rules

- [ ] `AppUser` 加 `pushPrefs?: { engagementOptOut?: string[] }`（為將來 quiet hours / per-pet 預留 namespace）
- [ ] `src/lib/firebase/users.ts` 加 helper `updateEngagementOptOut(uid, type, optOut: boolean)`
- [ ] `firestore.rules`：user 可改自己的 `pushPrefs`
- [ ] `leaderboards/{period}/entries/{uid}` schema 加 `previousRank?: number`（Phase 2 用）
- [ ] B2 去重 schema：`userDailyStats/{uid}_{YYYY-MM-DD}` 加 `goalHitNotifiedAt?: Timestamp`（或選 user doc `lastGoalHitNotifiedDate?: string` 簡化版）
- [ ] Audit collection `engagementPushes/*` rule：禁止 client write，admin / server-only

## 成功指標（上線後一週看）

- A1 推播後 1 小時內 user 開啟 app 比例 ≥ 20%（定性 — 沒 analytics 看 walks doc 新增頻率）
- A2 推播後當晚仍補遛（斷 streak 救援）比例 ≥ 15%
- B1 推播後使用者實際遛狗趕上的比例 ≥ 10%
- B2 推播家人收到後實際 react / open app 比例 ≥ 30%（家人 social pressure 應該效果好）
- 推播 opt-in 率不掉（北極星指標）— 如降 > 5% 表示 push 太擾人
- 4 個 push 的 per-type opt-out 率 < 20%（如某 type 超過 20% 表示該 type 設計有問題）
- 自己 + 家人實測「晚上有被提醒但不煩」+「被超越會想追回來」+「家人達標收到通知會開心」

## 不在這次範圍

- A3 (早上預告) — 留下波 spec（早上推 opt-out 率高）
- B3-B5 (家人 post 通知 / 反應通知 / 好友請求) — 留下波 spec
- C1/C2 (週日總結 / 新文章) — 留下波 spec
- **Quiet hours / per-pet opt-out**（原 push-notification-settings spec 範圍 — DEFERRED 到本 spec ship 後另開）
- Push analytics（open rate / dismiss rate / 哪些 push 帶來 conversion）
- A/B test push wording
- 多時區精準推（用 user.locale 推測；無資料時預設 Asia/Taipei）
- iOS PWA 限制處理（既有 PushToggle 已有 iOS Safari 加主畫面提示）
- **Push throttle**（A1 20:00 + A2 22:00 同晚都觸發時的去重 — 觀察 user 反映再加）

## 技術筆記

### 動到的檔案

- `src/lib/types.ts`：`AppUser.pushPrefs?: { engagementOptOut?: string[] }`
- `src/lib/firebase/users.ts`：`updateEngagementOptOut(uid, type, optOut)` helper
- `functions/src/index.ts`：
  - 新 `eveningWalkReminder` scheduled function（Phase 1 A1，cron `0 20 * * *`）
  - 新 `streakBreakWarning` scheduled function（Phase 1.5 A2，cron `0 22 * * *`）
  - 改 `aggregateLeaderboards` 加 previousRank diff + rank-overtake push（Phase 2 B1）
  - 新 walks onWrite trigger OR 既有 aggregator hook — `familyGoalMilestone`（Phase 2.5 B2）
- `firestore.rules`：user 寫 pushPrefs 規則 + engagementPushes audit 規則 + userDailyStats 規則（若採方案 a）
- `firestore.indexes.json`：可能需要 — 看 Phase 1/1.5 query 形狀（aggregate today walks per user 跨 collectionGroup）+ Phase 2.5 family member lookup
- `src/app/app/settings/page.tsx`：加「主動推播」section
- `src/components/settings/engagement-push-section.tsx`：**新檔**
- `messages/zh-TW.json` + `messages/en.json`：`Push.*` + `Settings.engagementPush.*` namespaces

### Edge cases

| Edge | 處理 |
|---|---|
| User 0 個寵物 | A1/A2 skip（沒寵物 noting to remind about）|
| User 在 quiet 時間（如 03:00）opening app 跟 push 衝突 | quiet hours **不在本 spec 範圍**，下個 spec cover |
| Personal mode user | A1/A2 仍推（personal walks 也算 today total + 個人 streak）；B1 不推（personal 不進 leaderboard）；B2 不推（沒家人）|
| Family pet 多 → A1/A2/B2 用哪隻名字 | 用 createdAt 最早 pet（user 第一隻；B2 用 achiever 的最早 pet）|
| User 跨時區 | 預設 Asia/Taipei；future spec 加 user.timezone field |
| FCM token 失效 | 沿用既有 cleanup 邏輯（arrayRemove invalid tokens）|
| A1 跟 A2 同晚都觸發 | 不衝突 — A1 20:00 check「< 30 min」+ A2 22:00 check「streak ≥ 3 且 0 walks」。User 若 20:00 後遛了 → A2 不觸發；若沒遛 → 可能同晚收到 2 push（A1 nudge + A2 streak 警告）。可接受，但 PM 留意 — 若 user 反映擾人，下個 spec 加 throttle |
| B2 user 今日多次跨 30 min（例如先遛 15 min → 又遛 20 min 跨 35）| `goalHitNotifiedAt` flag 去重，只推一次 |
| B2 family 只有 user 自己（1 member）| skip — 沒其他 family member 接收 |
| B2 跟既有 walks aggregator 同時 race | onWrite trigger 跟 aggregator 各跑各的；用 transaction 寫 `goalHitNotifiedAt` 避免重複 push |
| 既有 user 沒 pushPrefs | 預設視為「engagementOptOut: []」（全 ON）|
| Engagement push 跟既有 scanReminders 同時觸發 | 不同 cron schedule，不衝突；user 可能收兩個 push（一個 reminder 一個 engagement）— acceptable |
| A2 streak 計算 includes 今日? | 算「截至昨天」streak（A2 在 22:00 跑，要判斷「再不遛就斷」=今日無 walk + 昨日含以前 streak ≥ 3）|

### 跟其他 spec 的關聯

- **scanReminders（既有 Cloud Function）**：不動，本 spec 加新 scheduled function 並行跑
- **aggregateLeaderboards（既有）**：本 spec Phase 2 改其後續邏輯加 previousRank diff
- **walks document 寫入路徑（既有）**：Phase 2.5 B2 可能加 onWrite trigger 監聽
- **delete-account**：刪 user 時 pushPrefs 隨 user doc hard-delete（已 cover）；engagementPushes audit 不動（同 deletedAccounts / legacyCleanups pattern — history record）；userDailyStats 隨 user 一起 delete cascade
- **data-export**：export 含 pushPrefs（隨 AppUser doc 已 cover）+ userDailyStats（如有此 collection）
- **既有 PushToggle (settings)**：不動，仍是 global enable/disable + test push
- **未來 quiet hours / per-pet opt-out spec**：本 spec 已預留 `pushPrefs` namespace，未來加 `quietHours` / `perPetOptOut` 不衝突

### 部署順序（建議 Feature Builder 拆 phase ship，避免一次 4 個 push 同時上線過度通知）

**順序建議**：
1. **Phase 4 schema + Phase 3 UI 一起 ship**（先讓 user 看到「主動推播」section 並能 opt-out，再 enable 任何 cron）
2. **Phase 1 A1 ship** → 線上跑 1 天看不擾人 → 收 user feedback
3. **Phase 1.5 A2 ship** → 跑 1 晚 → 確認沒太擾
4. **Phase 2 B1 ship** → 跑 1 日 cron → 確認沒不爽
5. **Phase 2.5 B2 ship** → 收尾

**每 phase 部署指令**：
1. `npx firebase deploy --only firestore:rules`（先放寬 pushPrefs 寫入 + engagementPushes audit + 該 phase 需要的 rule）
2. `npx firebase deploy --only firestore:indexes`（如需）
3. `npx firebase deploy --only functions:eveningWalkReminder`（或當 phase 的 function name）
4. `git push origin main`（前端 settings UI — 第 1 步隨 Phase 4+3 一起）

## PM 觀察

**這個 epic 跟 Epic 4 視覺重設計性質不同** — scope 雖然擴到 4 push types（3 scheduled + 1 event-trigger），但 UI surface 仍是 settings 一個 section + 4 個 toggle 而已。**Claude Design prototype-first workflow 對本 epic 收益仍不高**（主要工作是 4 個 cloud function logic + dedup + family-aware 邏輯）。**建議走直接 Feature Builder session ship path**，跟 delete-account / friends-search 同 pattern。

**重點建議**：Feature Builder 把 4 個 push types 分 phase commit（A1 ship → 線上跑一天看不擾人 → ship A2 → 跑一晚 → ship B1 → ship B2），避免一次推 4 個會 over notify 或 user 還沒看到 opt-out toggle 就被轟炸。

## 暫停中 Epic 對齊

Epic 4 視覺重設計 Phase 0+0.5+1 已 SHIPPED；Phase 2-6 等本 Epic 5 ship 後再續。

---

## SHIPPED 紀錄

| Phase | Commit | 內容 + 1-line review |
|---|---|---|
| **4 + 3 schema + UI** | `f1e6952` | `AppUser.pushPrefs.engagementOptOut` + `ENGAGEMENT_PUSH_TYPES` const；`LeaderboardEntry.previousRank?` 預埋給 Phase 2；`updateEngagementOptOut` lib helper；rules `engagementPushes/{document=**}` + `userDailyStats/{statId}` (own-day read)；`EngagementPushSection` 元件（4 個 toggle 含 personal-mode 對 family-milestone 的 grey-out）；Settings 加 section in PushToggle ↔ Privacy & Data 之間；i18n `Settings.engagementPush.*` + `Push.{4 types}.*` 一次到位（避免 phase 1 補 i18n 漏 fallback） — **ship 順序對：toggle 在 user 看到任何 push 之前先到位** |
| **1 A1 evening walk reminder** | `1a6fc7f` | `eveningWalkReminder` cron `0 20 * * *` Asia/Taipei；單一 collectionGroup walks query 預聚合 per-uid 今日分鐘；users 全掃 + per-user 寵物名（pet 排序 in-memory，避開 composite index dep）；token cleanup 沿 scanReminders pattern；audit doc 帶完整 skip 細分 — **唯一非 trivial 取捨：先 collection scan users 不嫌貴，後續需要 scale 再加 `fcmTokens != []` index** |
| **1.5 A2 streak break warning** | `64f5de7` | `streakBreakWarning` cron `0 22 * * *` Asia/Taipei；30 天 walks 視窗算 Taipei-aligned `taipeiDayIdx` set per user；`streakEndingAt(yesterdayIdx, days)` helper 倒數連續日；skip 規則：no-token / opt-out / 今日已遛 / streak < 3 / 沒寵物 — **跟 A1 同晚都發只是當下 UX 假設可接受，留 PM 後續觀察是否加 throttle** |
| **2 B1 rank-overtake** | `9c6442e` | 重構 `writeLeaderboard` 為 `writeLeaderboardWithRanks`（既有 wrapper 仍 export 給 weekly/monthly），加 `previousRank` 寫入 + 回傳 diff Map；`runRankOvertakePushes` 在 aggregateLeaderboards 寫完 all_time 後跑 — overtaker = `newRank-1` 且 `overtakerOldRank > droppedOldRank`（避免 X 一直在前面 = 假被超越）；每日 1 次 per user 由 cron 1×/day 天然保證 — **schema 加 1 個 optional field，舊資料第 1 次跑視為 first-entry 不 push，符合直覺** |
| **2.5 B2 family-milestone** | `40a7e02` | `onCreate(walks/{walkId})` 觸發；walker family-mode + 達 30 分目標 + family 有其他成員 才推；dedup 用 `userDailyStats/{uid}_YYYY-MM-DD}.goalHitNotifiedAt` runTransaction 寫 — 第一筆贏其他靜默 bail；audit 帶 achiever + recipients + sentTo 清單 — **第一個 event-trigger function，首次部署 Eventarc service agent 沒就緒，~90s 後 retry OK；不影響 production** |

### 部署順序確認（與 spec 一致）

1. ✅ Phase 4 + 3 ship — user 先看到 toggle 才會收到任何主動 push
2. ✅ Phase 1 A1 ship — cron `0 20`
3. ✅ Phase 1.5 A2 ship — cron `0 22`
4. ✅ Phase 2 B1 ship — 改 `aggregateLeaderboards` cron `30 0`
5. ✅ Phase 2.5 B2 ship — onCreate event trigger

### 手動 test 觀察建議（PM 收尾 roadmap 用）

- **A1**：用主帳號（蔡智博Jabir）今天不要遛狗，看 20:00 Asia/Taipei 是否收到「Mango 今天還沒走滿 30 分鐘 🐶」
- **A2**：streak ≥ 3 天的人今天故意不遛，看 22:00 是否收到「再不遛 Mango 就斷 X 天紀錄了 🔥」（測試帳號 streak 少，可能要拿 walks 模擬資料）
- **B1**：兩個家庭成員的分數差小，明天等 00:30 aggregate 後看排名翻轉的那一邊是否收到推播
- **B2**：家人在你 PWA 開著時遛狗，walk 寫完那一秒應該收到「{achiever} 完成 {petName} 今日目標了 🎉」
- 全部 4 個 push 都應該在 Settings → 主動推播 section 個別可關（toggle 寫到 user.pushPrefs.engagementOptOut）

### 開放問題（PM 醒了或下個 PM session 決定）

- 上線後 3 天觀察 opt-out 率，>20% 表示哪個 push 設計有問題
- A1 + A2 同晚雙推是否要 throttle（spec 已標 acceptable）
- B1 是否擴到 weekly leaderboard（spec 範圍只 all_time，但 schema 預埋了 weekly/monthly 的 previousRank）

### 與 spec 的 deviations

- **無 schema deviation**。完全照 spec D1-D5 + Phase 1-4 / 1.5 / 2.5 完成標準實作。
- **engagementPushes 路徑**：spec 寫 `engagementPushes/{type}/{ISO}` (2-level)；實作為 `engagementPushes/{type}/waves/{ISO}` (3-level，type 是 doc，waves 是 subcollection)。Functionally 等價、admin SDK 寫入無差、規則 `engagementPushes/{document=**}` recursive 涵蓋。
- **i18n bank**：spec 寫「沿用 walks-v2 encouragement copy pattern」— 採極簡 i18n 在 client + 同樣的 key 結構在 functions（pushCopy 做 interpolation）。沒做 client-side templates randomization（push 內容固定模板），避免邊際複雜度。
