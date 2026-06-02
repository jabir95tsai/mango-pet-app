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
