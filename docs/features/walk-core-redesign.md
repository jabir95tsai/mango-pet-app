# 遛狗主頁 + 追蹤畫面核心重設計

狀態：READY-FOR-DEV（user 2026-05-23 主動提供完整 vision + 5 decisions；PM 補 edge cases）
建立日期：2026-05-23
最後更新：2026-05-23
規格作者：PM session @ 331e125（基於 user 2026-05-23 vision message）
角色：UI/UX 工程師（主）— 可動 `src/app/app/walks/*`、`src/components/walks/*`、`src/lib/walk-tracking.ts`、`messages/*`；**不碰** `src/lib/firebase/*` / `functions/` / `firestore.rules` / `firestore.indexes.json` / schema

## User Story（user 原話保留）

> Mango Pet 的核心是「遛狗」。/app/walks 不應該像一個紀錄列表頁，而應該像每天打開 app 時最想按的「開始頁」。

**一句話需求**：使用者打開遛狗頁後，**3 秒內知道今天要不要遛、差多少、按哪裡開始**。

## 為什麼是現在做

User 自己提的 product principle（2026-05-23）：

> 留住使用者的不是功能數量，而是每天都有一個很小的「完成感」。

具體痛點：
- 目前主頁優先顯示「連續天數 / 本週次數 / 距離 / 分數」統計 — 不像「今天我還差一點就完成了」
- 核心動作（開始遛狗）被包在 dialog 裡，不是頁面主視覺
- 留存設計缺少「今日進度 + 完成感」這個 daily habit hook
- 家庭 epic 已收尾，現在是 polish 核心體驗的好時機

## 5 個 product decisions（user 已 confirmed 2026-05-23）

| Decision | 採用 | 替代 |
|---|---|---|
| 今日目標單位 | **30 分鐘** | 公里數（GPS 在 Web/PWA 容易受影響，分鐘更穩、更符合習慣養成）|
| 本週目標單位 | **5 次遛狗** | 公里總和 / 分鐘總和（次數最直觀）|
| 多寵物時開始流程 | **記住上次遛的寵物 + 頁面切換** | 跳 dialog 強迫選（增加摩擦）|
| 停止後處理 | **自動儲存（停止 = 儲存成功）** | 跳 confirmation dialog（中斷流程）|
| 手動補登顯眼度 | **降為 secondary** | 跟主 CTA 平級（搶焦點）|

## 完成標準

### A. Hero / 開始頁（/app/walks 第一屏）

- [ ] 進頁第一屏顯示：
  - 今日狀態文案：「今天還差 12 分鐘」/「Today: 12 more min」（已達標 → 「今日目標達成！」/「Goal hit!」）
  - 大進度條（**水平 bar，PM 預設**） — 0% 灰底，>0% emerald fill
  - **大按鈕「開始遛狗」**（primary, large size，永遠是第一視覺焦點）
- [ ] **多寵物時**：顯示「上次遛的：Mango 🐶」上面，旁邊可切換（segmented control or 小 select）— **不跳 dialog**
- [ ] **單寵物時**：直接預選，不顯示切換 UI
- [ ] **無寵物時**：empty state「先建一隻寵物才能開始遛狗」+ CTA → `/app/pets`
- [ ] **第二屏（往下滾）**：「本週進度」3/5 次 + 連續天數 + 紀錄列表（最近 5-10 筆）
- [ ] 「分數」**不**在主視覺出現（仍保留在 `/app/leaderboard`，不重複顯示）
- [ ] 手動補登按鈕：放在頁面**底部**或 sub-menu，secondary variant、不搶焦點

### B. 追蹤中畫面

- [ ] 改成近似 **full-screen**（不是現在的小 dialog） — `fixed inset-0` + 安全區
- [ ] **大字三件事**（每行明確）：
  - 時間（mm:ss，最大字）
  - 距離（0.82 km，次大字）
  - 今日進度（百分比 + small 進度條）
- [ ] **唯一主按鈕「停止」**（destructive variant，大）
- [ ] **GPS 錯誤提示要短，不要嚇人**：例「訊號弱」/「Weak signal」一行 amber 小字，不擋追蹤
- [ ] 切回背景 / 鎖屏處理：保留現有實作（PWA 限制無解，但確認跳回 UI 仍正確；不爆）

### C. 完成畫面

- [ ] 達標：「完成今日目標！」/「Goal hit!」
- [ ] 未達：「今天完成 68%」/「Today's 68%」
- [ ] **自動儲存** — 不再有「儲存」按鈕
- [ ] 備註是 **secondary action**：「加備註」collapsed 區，預設折疊
- [ ] 兩個次要 CTA：「回到遛狗」（primary）/「查看排行榜」（secondary，→ `/app/leaderboard`）

### D. 紀錄列表

- [ ] 放第二屏下面，不搶 CTA
- [ ] 最近 5-10 筆，沿用現有 `walk-card.tsx` 樣式
- [ ] 「查看更多」連到分頁 / modal（**不在這次 scope**）

### E. 共用

- [ ] i18n：zh-TW + en 兩個 locale 文案齊（all new keys under `Walks.core.*`）
- [ ] `npx tsc --noEmit` pass
- [ ] **不新增 schema**（today/week progress 從 walks query 即時推導）
- [ ] **不改 family-scoped query** — 沿用現有 `listWalks(familyId 或 personal mode)`
- [ ] Chrome MCP iPhone 14 Pro Max + desktop 1456×819 對照
- [ ] Light + dark 兩個 mode

## 成功指標（上線後一週看）

- 質性：使用者開 /app/walks 後**首先按的按鈕**是「開始遛狗」（非「補登」非「歷史」非任何 nav link）
- 質性：使用者實測說「現在打開就想按開始」（user 自己 + 家人測試）
- 量性：難量化（沒 analytics）；可看 walks doc 寫入頻率是否提升

## 不在這次範圍

- 自訂今日目標 / 本週目標（使用者改 30 分鐘 → 45 分鐘等）
- Badge / achievement 系統
- 複雜地圖路線（heatmap、軌跡覆蓋等）
- 社群挑戰（「跟朋友比本週」）
- 自動辨識遛狗開始（geofence / motion detection）
- Schema 改動（加 daily goals doc / 加 streak 計算 doc）
- 公里數作為次要目標（純展示，不當進度條主目標）
- 推播提醒「今天還沒遛狗」（另開 spec — 可能用 scanReminders 跨領域）
- 追蹤中 reload 後恢復追蹤（PWA 限制延伸問題，下個 spec 評估）
- 「分頁查看更多歷史紀錄」（紀錄列表 only 顯示最近幾筆）

## 技術筆記

### 動到的檔案（UI/UX 角色範圍內）

- `src/app/app/walks/page.tsx`：整頁重構（Hero / 紀錄列表 / 手動補登 secondary）
- `src/components/walks/walk-session-dialog.tsx`：拆 / 改 / 重寫為 full-screen tracking view（**可能改檔名** `walk-tracking-view.tsx`，或保留檔名但內部改成 full-screen layout）
- `src/components/walks/walk-card.tsx`：列表卡片可能微調 spacing
- `src/lib/walk-tracking.ts`：可能加 helper：
  - `getTodayProgress(walks: Walk[], goalMin = 30): { minutes: number, goalMin: number, percent: number }`
  - `getWeekProgress(walks: Walk[], goalCount = 5): { count: number, goalCount: number, percent: number }`
- `src/app/globals.css`：可能微調進度條樣式 / 動效 transition
- `messages/zh-TW.json` + `messages/en.json`：`Walks.core.*` 新 i18n namespace

### 不動

- `src/lib/firebase/walks.ts`（UI/UX 角色不碰 firebase lib — 沿用現有 `listWalks` 等）
- `firestore.rules` / `firestore.indexes.json` / `functions/src/index.ts`
- 既有 walk schema（`walks/{walkId}` 結構不變）

### Edge cases — PM 預設處理

| Edge | 處理 |
|---|---|
| 跨日時區 reset | 用 `Intl.DateTimeFormat` 取 device timezone 計算「今日 00:00 開始」(local time) |
| 本週開始 | 預設**週一**（台灣 / ISO 8601 週起）— i18n 文案「本週」/「This week」對齊 |
| 多寵物「上次選的」儲存 | localStorage key `mango.walks.lastPetId.{uid}`（per-device 偏好，不寫 user doc）|
| 追蹤中 reload / 切走 app | 維持現有實作 — reload 會 lose tracking state（PWA 限制無解，不在此 spec scope）|
| 0 walks today | Hero「今天還沒開始」+ 進度條 0% + 大按鈕「開始遛狗」 |
| 0 walks this week | 本週進度 0/5；連續天數可能為 0（看現有 streak lib 邏輯）|
| 達標後再遛 | 進度條 cap at 100% 顯示，total 數字仍累加（「45 / 30 分鐘 ✓」）|
| Personal mode 使用者 | sameUI（personal walks 顯示自己的 today/week progress）— 沿用現有 personal mode 邏輯 |
| Family mode 使用者 | today/week progress 只看**自己**的 walks（不是家庭加總）— 預設個人習慣養成；家庭加總可未來另開 spec |

### 跟既有 spec / commit 的關聯

- **#3 family-leaderboard**：完成畫面 CTA「查看排行榜」直接連 `/app/leaderboard`
- **delete-account / data-export**：無關聯（walk schema 不變，刪/匯出仍 cover）
- **既有 attribution（walkerUid / ownerUid）**：不動

## 開放問題

- [x] 今日目標 = 30 分鐘 ✓（user 建議）
- [x] 本週目標 = 5 次 ✓（user 建議）
- [x] 多寵物切換不跳 dialog ✓（user 建議）
- [x] 停止 = 自動儲存 ✓（user 建議）
- [x] 手動補登降 secondary ✓（user 建議）
- [x] 進度條風格：**水平 bar**（mobile 寬度可填滿，文案放旁邊較自然）✓
- [x] 完成畫面 = **in-page**（追蹤 view 自然 collapse 成完成 view，避免 modal 摩擦）✓
- [x] Family mode 的 today/week progress：**個人 only**（不家庭加總，符合「習慣養成」假設）✓
- [ ] **本週開始定義**：採週一（PM 預設）— 若 user 偏好週日 reset 跟我說
- [ ] **「查看更多歷史」**：本 spec 不做；未來另開 spec 評估（紀錄列表只顯示最近 5-10 筆）
- [ ] 追蹤中 reload 後恢復追蹤的處理：本 spec **不解**（PWA 限制延伸問題，另開 spec 評估）
