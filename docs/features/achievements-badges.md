# 徽章 / 成就系統（Achievements）

> **狀態**：READY-FOR-DEV — PM spec（2026-06-02；user 3 決策已拍板）。徽章清單 §D 已定版 v1（26 枚；user 仍可增刪數值/品項）。
> **角色分工**：Backend（成就定義 + lifetime 統計來源 + 評估/授予 trigger + 解鎖 push）→ Feature Builder（`/app/achievements` 頁 + 入口）→ UI/UX（徽章視覺 / 已得·未得態 / 進度）。
> **歸屬**：gamification / 用戶活躍（北極星：每週活躍家庭數、每日遛狗完成率）；push 接 Epic 5。
> **依賴**：實作排在 iOS 並行期 main 乾淨時；動 production code 前讀近期 commit 避免撞檔。

## 背景（現況，立基於 code）

- **無現成 badge/achievement 系統**。
- 可用訊號：walks、leaderboard entry（`totalDistanceKm` / `totalDurationMin` / `walkCount` / `streakDays`，但**僅 family-mode、且已排除 guest**）、pets、family、posts/photos、reactions。
- 既有 trigger：`recomputeWalkerLeaderboards` onCreate(walks)、`aggregateLeaderboards` cron — 成就評估可掛同一條路徑。

## 範圍（user 2026-06-02 拍板）

1. **主體 = 以人（使用者）為主**（不是 per-dog）。
2. **顯示 = 新建「成就」頁**（`/app/achievements`），從 profile/設定進入。
3. **解鎖 → 推播通知**（接 Epic 5）。

---

## ⚠️ 關鍵：成就用的統計來源（Backend 必處理）

成就的「總遛狗數 / 里程 / streak」**不能直接讀 leaderboard entry** —— 那只算 family-mode 且排除 guest/personal-mode。成就要反映使用者**全部** walk。

- **要求**：用一個**涵蓋使用者所有 walk（family + personal）的 lifetime 統計**當成就依據。
- 來源 Backend 決定：擴充既有 `userDailyStats`（Epic 5 已有），或新建 `users/{uid}/stats`（lifetime walkCount / totalDistanceKm / totalDurationMin / currentStreak / longestStreak），在 walk onCreate 維護。
- guest 也要能累計（見下方 guest 段）。

---

## A. 成就定義（Backend，靜態在 code / shared-types）

`ACHIEVEMENTS` 常數陣列，每個：
```
{ id, category, title(i18n key), description(i18n key), icon(emoji/svg),
  criteria: { metric, threshold }, tier? }
```
- `metric` 例：`walkCount` / `totalDistanceKm` / `currentStreak` / `petCount` / `familyJoined` / `postCount` / `photoCount` / `leaderboardRank`。
- 同類分階（tier）：如遛狗數 1 / 50 / 200 各一枚。

## B. 授予狀態（Backend）

```
users/{uid}/achievements/{achievementId}
```
- `{ achievementId, earnedAt, progressSnapshot }`。**只在達標時寫一次**（idempotent，已得不重寫、不重推）。
- 進度（未得徽章的「47/50」）由前端用「定義 threshold + 當前 lifetime 統計」即時算，不需每枚存進度。

## C. 評估 / 授予（Backend，server-authoritative）

- 中央 helper `evaluateAchievements(uid)`：讀當前 lifetime 統計 + 已得集合 → 找出新達標 → 寫 achievement doc + 發 push。
- 掛載點（idempotent，重入安全）：
  - walk onCreate（walkCount / distance / streak 類）— 與 `recomputeWalkerLeaderboards` 同 trigger。
  - pets onCreate（第一隻 / 多寵）。
  - family 加入（家庭類）。
  - posts/photos onCreate（社群類）。
  - `aggregateLeaderboards` cron（排行榜名次類，如「週榜第一」）。
- 不開新的高頻 scheduled function（控成本）。

## D. 徽章清單（定版 v1 — 2026-06-02；user 仍可增刪數值/品項）

26 枚，7 類。`id` = Backend `ACHIEVEMENTS` 常數 key；`metric` = lifetime 統計來源（見 C 關鍵點）；`guest` = guest 是否可解（社群/排行榜類 ✗）。
title 兩語系（zh-TW / en），i18n key 建議 `Achievements.{id}.title` / `.desc`。

### 遛狗里程碑（metric: `walkCount`，guest ✓）
| id | emoji | zh-TW / en | 條件 |
|---|---|---|---|
| `walk-1` | 🐾 | 初次遛狗 / First Walk | walkCount ≥ 1 |
| `walk-10` | 🦴 | 遛狗新手 / Getting Started | ≥ 10 |
| `walk-50` | 🦮 | 遛狗達人 / Walk Pro | ≥ 50 |
| `walk-100` | 🏅 | 遛狗大師 / Walk Master | ≥ 100 |
| `walk-365` | 🏆 | 遛狗傳奇 / Walk Legend | ≥ 365 |

### 連續天數（metric: `longestStreak`，guest ✓）
> ⚠️ 用 **longestStreak（歷史最長）** 非 currentStreak — 徽章一旦得到就永久保留，不因斷掉而收回。Backend lifetime 統計需含 longestStreak。
| id | emoji | zh-TW / en | 條件 |
|---|---|---|---|
| `streak-3` | 🔥 | 三日有恆 / 3-Day Streak | longestStreak ≥ 3 |
| `streak-7` | 🔥 | 一週不輟 / Week Warrior | ≥ 7 |
| `streak-14` | 🔥 | 雙週堅持 / Two Weeks Strong | ≥ 14 |
| `streak-30` | 🔥 | 月度堅持 / Monthly Devotion | ≥ 30 |
| `streak-100` | 💯 | 百日不間斷 / Century Streak | ≥ 100 |

### 累計里程（metric: `totalDistanceKm`，guest ✓）
| id | emoji | zh-TW / en | 條件 |
|---|---|---|---|
| `dist-5` | 📏 | 暖身 5 公里 / 5 km | totalDistanceKm ≥ 5 |
| `dist-25` | 📏 | 25 公里 / 25 km | ≥ 25 |
| `dist-50` | 🥾 | 50 公里 / 50 km | ≥ 50 |
| `dist-100` | 🗺️ | 百里之行 / 100 km | ≥ 100 |
| `dist-250` | 🌍 | 250 公里 / 250 km | ≥ 250 |

### 累計時長（metric: `totalDurationMin`，guest ✓）
| id | emoji | zh-TW / en | 條件 |
|---|---|---|---|
| `time-600` | ⏱️ | 遛滿 10 小時 / 10 Hours | totalDurationMin ≥ 600 |
| `time-3000` | ⏱️ | 遛滿 50 小時 / 50 Hours | ≥ 3000 |

### 寵物（metric: `petCount`，guest ✓）
| id | emoji | zh-TW / en | 條件 |
|---|---|---|---|
| `pet-1` | 🐶 | 第一隻毛孩 / First Pet | petCount ≥ 1 |
| `pet-3` | 🏠 | 多寵之家 / Full House | ≥ 3 |

### 家庭（metric: `familyJoined`，guest ✗）
| id | emoji | zh-TW / en | 條件 |
|---|---|---|---|
| `family-join` | 👨‍👩‍👧 | 加入家庭 / Family Member | 加入任一 family |

### 社群（guest ✗）
| id | emoji | zh-TW / en | 條件 | metric |
|---|---|---|---|---|
| `post-1` | 📸 | 第一篇動態 / First Post | postCount ≥ 1 | postCount |
| `post-10` | ✍️ | 動態達人 / Storyteller | ≥ 10 | postCount |
| `react-10` | ❤️ | 廣受歡迎 / Crowd Pleaser | 單篇 post reactionCounts 加總 ≥ 10 | 單篇 reactionCounts（已 denormalized） |

### 排行榜（guest ✗；來源既有 leaderboard entries）
| id | emoji | zh-TW / en | 條件 |
|---|---|---|---|
| `rank-top10` | 📊 | 登上排行榜 / On the Board | 任一週 weekly 人榜或狗榜 rank ≤ 10 |
| `rank-1-week` | 👑 | 週榜第一 / Weekly Champion | weekly rank == 1 |
| `rank-1-month` | 🏆 | 月榜第一 / Monthly Champion | monthly rank == 1 |

### 資料來源備註（給 Backend）
- `walkCount` / `totalDistanceKm` / `totalDurationMin` / `longestStreak` → 來自 C 的 lifetime 統計（涵蓋全部 walk，**非** leaderboard entry）。
- `react-10` → 讀 post 自身 denormalized `reactionCounts` 加總（feed-comments-and-reactions-v2 已有）。
- `rank-*` → 讀既有 `leaderboards/*` 與 `dogLeaderboards/*` entry（guest 已被排除，天然不會誤得）。
- 排行榜類在 `aggregateLeaderboards` cron 評估即可（低頻）；其餘掛 walk/pets/family/post onCreate。

### UI 分層（給 UI/UX）
- 同類分階（如遛狗 1→10→50→100→365）：已得顯示最高階徽章 + 各階為里程碑；未得顯示「下一階進度」（如 walkCount 47 → walk-50 進度 47/50）。
- guest ✗ 類：guest 帳號顯示為鎖定 + 「綁定帳號解鎖」提示（對齊 guest-login gating）。

> v1 共 26 枚。數值/品項 user 可再增刪；改動只需動 Backend `ACHIEVEMENTS` 常數 + i18n。

## E. 成就頁（Feature Builder + UI/UX）

- 新 route `/app/achievements`；入口從 profile / 設定頁。
- 徽章 grid：**已得**（彩色 + earnedAt 日期）/ **未得**（灰階 + 進度條「47/50」）。
- 依類別分區；i18n（zh-TW + en）。
- 沿用 mango token / Avatar / reduced-motion 規範。

## F. 解鎖推播（Backend，接 Epic 5）

- 授予新徽章 → push「🏅 恭喜解鎖『{徽章名}』」。
- 沿用 engagement-push 框架：opt-out namespace 加 `achievement` type、有 token、不對自己以外發（這是給本人，正常）。
- 解鎖頻率低 → 無洗版/成本疑慮；不需 throttle（但同一次 evaluate 解多枚時可合併一則「解鎖 N 枚」）。

## G. Guest 處理（對齊 guest-login spec）

- 成就是**個人功能** → guest **可累計並解鎖個人類徽章**（遛狗/里程/streak/寵物），鼓勵參與 + 強化升級動機。
- **社群/排行榜類徽章對 guest 不適用**（guest 不發文、不上榜）。
- guest 升級（linkWithCredential）uid 不變 → 已得徽章**自動保留**（與 guest-login 升級保留一致）。

---

## 開放問題（PM 有預設）

1. **徽章清單最終版**：D 表為提案，待 user 增刪。
2. **lifetime 統計來源**：擴充 `userDailyStats` vs 新 `users/{uid}/stats` → Backend 提案。
3. **成就頁入口位置**：profile vs 設定 vs 兩者 → PM 預設「設定頁一個入口 + （若有 profile 頁）profile 一個」。
4. **既有使用者 backfill**：上線時用既有 lifetime 統計補發已達標徽章？PM 預設 **backfill 一次**（讓老用戶上線就看到應得徽章；一次性 callable / migration，evaluate 全 user）。

## Handoff

- **→ Backend**：lifetime 統計來源（C 的關鍵點）+ `ACHIEVEMENTS` 定義 + `users/{uid}/achievements` + rules（讀：本人；寫：限 function）+ `evaluateAchievements` 掛各 trigger + 解鎖 push（Epic 5 + `achievement` opt-out type）+ 上線 backfill。
- **→ Feature Builder**：`/app/achievements` 頁 + 入口 + 進度計算（定義 threshold × lifetime 統計）+ i18n。
- **→ UI/UX**：徽章視覺（已得/未得/進度條）、分類版面、reduced-motion。
- **→ PM（後續）**：收 user 對 D 徽章清單的 sign-off；上線後看成就頁開啟率 + 是否拉升遛狗完成率/留存。

---

## ✅ Backend 已交付（Backend session 2026-06-02 — commit 6f7afc0 on main）

**Deployed to `mango-pet-app`**：firestore:rules + functions（onWalkCreatedAchievements / onPetCreatedAchievements / onPostCreatedAchievements / backfillAchievements 新建；onReactionCreated / joinFamilyByCode / aggregateLeaderboards 更新）皆部署成功。**Prod e2e PASS**：真實 user 建 walk → lifetime stats 維護（walkCount/dist/longest）+ 授予 walk-1/dist-5/pet-1；guest 建 walk → 同樣得個人徽章、**無任何社群/排行榜徽章洩漏**（guest gating 正確）；trigger log 無 error。**未新增 index**。

### Feature Builder 直接用

**1. 徽章定義（ACHIEVEMENTS，26 枚 / 7 類）**
- 從 `@/lib/types` import `ACHIEVEMENTS`（型別 `Achievement`）。canonical 在 `@mango/shared-types`（web + iOS 共用）。每枚：`{ id, category, emoji, metric, threshold, rankPeriod?, guest }`。
- i18n key 自行用 `Achievements.{id}.title` / `.desc`（zh-TW + en）。**Backend 不提供顯示文案**（只在 push body 用一份內部 title bank）。emoji 已在常數內。

**2. 已得徽章 doc**
- path `users/{uid}/achievements/{achievementId}`，型別 `AchievementGrant` = `{ achievementId, earnedAt, progressSnapshot? }`。**只在達標寫一次**（idempotent，已得不重寫不重推）。
- rules：**讀本人、寫限 function**。前端只讀。

**3. lifetime 統計（進度條來源）**
- path `users/{uid}/stats/lifetime`，型別 `LifetimeStats` = `{ walkCount, totalDistanceKm, totalDurationMin, currentStreak, longestStreak, lastWalkDayIdx, updatedAt }`。涵蓋**全部 walk（family + personal，含 guest）**。rules：讀本人、寫限 function。
- ⚠️ 連續徽章門檻比對 **`longestStreak`**（永不收回），不是 currentStreak。

**4. 進度怎麼算（未得徽章「47/50」）**
- 純前端：`進度 = 對應 metric 的 lifetime 值 ÷ achievement.threshold`。metric→來源對照：
  - `walkCount` / `totalDistanceKm` / `totalDurationMin` / `longestStreak` → 讀 `users/{uid}/stats/lifetime`。
  - `petCount` → count `pets where ownerUid==uid`（或前端已有的 pets 清單長度）。
  - `postCount` → count `posts where authorUid==uid`。
  - `singlePostReactions`（react-10）→ 任一 post 的 `reactionCounts` 加總 ≥ 10（後端已自動授予；前端顯示用）。
  - `familyJoined`（family-join）→ `user.familyIds.length > 0`。
  - `leaderboardRank`（rank-*）→ 後端在每日 cron 授予；前端顯示已得/未得即可，不需自算 rank。**rank 類比較邏輯反向**（rank ≤ threshold 才達標；`rankPeriod` 指週榜/月榜）。
- 同類分階：已得顯示最高階；未得顯示「下一階進度」。

**5. guest gating（對齊 guest-login）**
- guest 可解：walks / streak / distance / duration / pets（`guest:true` 的徽章）。
- guest 不可解：family / social / rank（`guest:false`）→ 前端顯示鎖定 + 「綁定帳號解鎖」。判斷用 achievement.guest 旗標。
- 升級（linkWithCredential）uid 不變 → 已得徽章自動保留。

### 評估 / 授予掛載點（後端，已上線）
- walk onCreate（`onWalkCreatedAchievements`，**獨立** trigger、不排除 personal-mode）→ 維護 lifetime stats + 評估 walk/dist/dur/streak。
- pets onCreate（`onPetCreatedAchievements`）→ petCount。
- posts onCreate（`onPostCreatedAchievements`）→ postCount。
- reaction onCreate（`onReactionCreated` 內加一段）→ react-10（讀 post reactionCounts）。
- joinFamilyByCode callable → family-join。
- aggregateLeaderboards 每日 cron（`runRankAchievements`）→ rank-top10 / rank-1-week / rank-1-month（讀當日寫好的 walker + dog entries）。**未開新高頻 scheduled function**。

### 解鎖 push（§F，已上線）
- 授予新徽章 → push「🏅 恭喜解鎖『{名}』」；同一次 evaluate 解多枚 → 合併一則「解鎖 N 枚」。
- opt-out type **`achievement`** 已加進 `ENGAGEMENT_PUSH_TYPES`，Settings 可加開關。push deep-link → `/app/achievements`。

### 上線 backfill（task 7，已部署，**尚未執行**）
- `backfillAchievements` callable：**admin custom claim 必要**、**預設 dry-run**（`{dryRun:false}` 才實寫、`{targetUid}` 可先測單人）。重建 lifetime stats（從 walks）+ 補發老用戶已達標徽章；**backfill 不發 push**（避免老徽章洗版）。audit `achievementsBackfills/{ISO}`。
- ⚠️ **上線流程**：先 `{dryRun:true}` 看 audit/log 的 grant 數合理 → 再 `{dryRun:false}` 正式跑一次。需要有人持 admin claim 觸發（比照 cleanupLegacyPaths / gcAnonymousUsers 模式）。

### 注意 / 已知行為
- ACHIEVEMENTS 數值/品項要調 → 改 `@mango/shared-types` 的 `ACHIEVEMENTS` + `functions/src/achievements.ts` 鏡像（兩份保持同步）+ i18n。functions 不能 import workspace package，故刻意雙份。
- 進度不存每枚 doc（只存已得）；未得進度前端即時算。
- 排行榜類在 cron（日級）評估，當天遛狗後最快隔天 00:30 才授予 rank 徽章（設計如此，低頻控成本）。

---

## ✅ Feature Builder 已交付（Web/PWA session 2026-06-02 — commits 5f796f7 + 4ae994f）

**Shipped to main → App Hosting（prod live + Chrome MCP 驗過）。**

### 做了什麼
- **`/app/achievements`** 頁（`apps/web/src/app/app/achievements/page.tsx`）：8 類分區（walks/streak/distance/duration/pets/family/social/rank），每區 earned/total 計數 + BadgeCard grid。
- **資料層** `lib/firebase/achievements.ts`：讀 `users/{uid}/stats/lifetime` + `users/{uid}/achievements` grants + `getCountFromServer` 算 pet/post 數。頁面用 `allSettled` 降級。
- **進度邏輯** `lib/achievements.ts`（純函式，好測）：per-metric current value + 0..1 progress；**earned 來自 backend grant（authoritative），不前端重算**。`singlePostReactions` / `leaderboardRank` 無前端值 → 只顯示 earned/未得、無進度條。
- **BadgeCard**：earned（彩色 + 解鎖於 date）/ 未得（灰階 + 47/50 進度條）/ guest-locked（鎖 + 點擊開升級 dialog，對齊 guest-login gating）。
- **設定頁入口**「成就徽章」row → `/app/achievements`（所有人可見，guest 也能解個人徽章）。
- **achievement push opt-out**：engagement section 本來就 iterate `ENGAGEMENT_PUSH_TYPES`（已含 `achievement`），補上缺的 i18n label/hint 即自動出現開關（先前顯示 raw key，已修）。
- **i18n** zh-TW + en：完整 `Achievements` namespace（26 枚 title/desc + 8 categories + 頁面字串）+ `Settings.achievements` + `Settings.engagementPush.achievement`。⚠️ i18n 已搬到 `packages/shared-i18n/src/messages/*.json`（非舊的 `apps/web/messages`）。

### Prod 驗證（Chrome MCP，真 guest）
建第 3 隻寵物 → backend `onPetCreatedAchievements` 即時授予 → 頁面 **pet-1 + pet-3 彩色 + 「解鎖於 2026年6月2日」**、summary「已解鎖 2/26」✅；未得徽章灰階 + 進度條 ✅；家庭/社群/排行榜對 guest 鎖定 + 「綁定帳號解鎖」CTA ✅；設定入口 + 解鎖成就 push 開關 ✅。

### 過程中修的 bug（commit 4ae994f）
- pet-count `getCountFromServer(pets where ownerUid==uid)` 被 rules **permission-denied**（family pet 需 isFamilyMember，list/aggregation query 無法預驗）→ allSettled 把 petCount 吞成 0（pet 徽章顯示 0/1、每次 load 噴 console error）。改成 `where ownerUid==uid AND familyId==null`（personal pets，同 listPersonalPets 的允許形狀）。family-mode 寵物因此不進「未得進度條」，但 earned 來自 grant 仍正確。

### → UI/UX Handoff
- 徽章視覺最終態（彩色/灰階/進度條/鎖定）目前是**功能性結構**，用 mango token + grayscale；請接手做最終 palette / 動效 / reduced-motion / emoji-vs-svg。
- §D「同類分階：已得顯示最高階、未得顯示下一階進度」目前是**全 tier 平鋪**（每階一個 tile）。若要收斂成「最高階 + 下一階進度」由 UI/UX 決定資訊密度。
- BadgeCard 在 `apps/web/src/components/achievements/badge-card.tsx`；分區/grid 在 page。
- 入口目前只在設定頁（無 profile 頁）；若之後加 profile，再加一個入口。nav 是否要放 `/app/achievements` 由 UI/UX/PM 決定（目前未動 app-nav）。

### → Backend（提醒，非本 session）
- `backfillAchievements` 仍 **尚未執行**（task 7）→ 老用戶（含我測試 guest 早於成就上線建立的 2 隻舊寵物）的已達標徽章尚未補發。跑 backfill（先 dry-run）後老資料才會亮。
