# 遛狗主頁 + 追蹤畫面核心重設計

狀態：**SHIPPED 2026-05-24**（walk-core v1：`2355c09` + `229361b` + `1cf48cc` + `54ee219` + `63c397c`；SHIPPED record `822ce69`）
建立日期：2026-05-23
最後更新：2026-05-29 PM audit sync
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

## SHIPPED 紀錄

✅ **SHIPPED** — UI/UX session 2026-05-23 → 2026-05-24（push 2026-05-23 23:28:45 +0800，App Hosting build 完成於 2026-05-24 00:00 ± 06 之間，~12 分 build time）

### 5 個 phase commits

| Phase | Commit | 摘要 |
|---|---|---|
| 1 | [`2355c09`](https://github.com/jabir95tsai/mango-pet-app/commit/2355c09) | `walk-tracking.ts` 加 `getTodayProgress` / `getWeekProgress` 純函式 helpers + `WalkSession.blendTodayProgress` static method（live preview） |
| 2 | [`229361b`](https://github.com/jabir95tsai/mango-pet-app/commit/229361b) | `page.tsx` Hero（today status + horizontal bar + 大 CTA） + 多寵物 segmented chip picker（localStorage `mango.walks.lastPetId.{uid}`）+ 0-pet empty state link 到 `/app/pets` + `Walks.core.*` i18n namespace（10 keys zh-TW + en） |
| 3 | [`1cf48cc`](https://github.com/jabir95tsai/mango-pet-app/commit/1cf48cc) | 新 `walk-tracking-view.tsx`（full-screen `fixed inset-0` + createPortal + env safe-area padding）取代 `walk-session-dialog.tsx`。Auto-start session on open（no setup phase）；status pill + 大 mm:ss + km + today % + 軟化 GPS error i18n map（10 new keys） |
| 4 | [`54ee219`](https://github.com/jabir95tsai/mango-pet-app/commit/54ee219) | done phase 改 in-page complete view：Trophy + emerald「完成今日目標！」/ zinc「今天完成 X%」+ recap + collapsed `<details>` 備註 + 兩個 secondary CTA（回到遛狗 / 查看排行榜）。`saveWalkOnce()` idempotent helper，save 在 CTA 點擊時觸發（7 new keys） |
| 5 | [`63c397c`](https://github.com/jabir95tsai/mango-pet-app/commit/63c397c) | 拿掉舊 4-stat row（連續/週次/週距/週分數）+ 新 compact 2-col 卡片（本週進度 + 連續天數，bar 顏色 amber→emerald goal hit）+ recent walks 加 h2「最近的紀錄」+ `slice(0, 10)` + 手動補登降 ghost-sm 在頁尾（9 new keys） |

### Chrome MCP 驗證結果（production https://mango-pet--mango-pet-app.asia-east1.hosted.app/app/walks）

**Desktop 1456×819 light**（actual viewport stayed 2560×1317 because Chrome window stayed maximized — `resize_window` 不對 maximized window 生效；截圖是 1524×784 downscale）：

| 驗證項 | DOM probe / 視覺 | 結果 |
|---|---|---|
| Hero 卡片 | `section[aria-labelledby="walks-hero-status"]` | ✅ 存在，「今天還沒開始」+ 0/30 分鐘 + 進度條 0% |
| 大 Start CTA | button text | ✅「開始遛狗」 |
| 多寵物 picker | `[role="radiogroup"]` | ✅ 單寵物 (Mango) → 不渲染（spec「單寵物時直接預選」） |
| Compact 週/連續卡片 | `section.grid.grid-cols-2 > article` | ✅「本週進度 0 / 5 次」+「連續天數 0 天」 |
| 舊 4-stat row | `.grid.grid-cols-2.sm:grid-cols-4` | ✅ 不存在 |
| 紀錄列表 | `article.flex.gap-3.rounded-lg` count | ✅ 0（user 在等 build 時刪了 walks）+ empty state「尚無遛狗紀錄」用新 i18n 文案 |
| 手動補登 | bottom ghost-sm button | ✅「手動補登」 |
| Tracking view | full-screen overlay | ✅ click「開始遛狗」→ `aria-label="追蹤中"` overlay 2560×1317（full viewport）、追蹤中·🐾 Mango pill、mm:ss=00:03、0.00 km、今日完成度 0%、紅色大「停止」按鈕、無其他 nav 顯示 |
| Complete view | done phase | ✅ click 停止 → in-page collapse 成「今天完成 2%」+ km 0.00 / min 0.6 recap + amber「沒取得 GPS 點 — 試試手動補登」+ 折疊「加備註」（預設 closed）+「回到遛狗」amber primary +「查看排行榜」secondary |

**截圖路徑**（Chrome MCP `save_to_disk` 暫存）：
- `before-walks-desktop.png` — baseline，舊 4-stat row + 2-button row + GPS 副標
- `after-walks-desktop-hero.png` — Hero + compact week/streak + empty walks list + bottom 手動補登
- `after-walks-tracking-fullscreen.png` — 大 00:03 timer + 0.00 km + 0% bar + 紅停止
- `after-walks-complete-inpage.png` — 今天完成 2% + recap + 摺疊備註 + 雙 CTA

**沒能直接驗證的部分**（環境限制，不是程式問題）：
- ⚠️ iPhone 14 Pro Max emulation（430×932）：Chrome window maximized，`resize_window` 對 maximized window 不生效；Chrome MCP 沒暴露 CDP `Emulation.setDeviceMetricsOverride`。Layout 的 mobile responsive class（`md:hidden`、`sm:max-w-md` 等）在 DOM 中已正確套用，user 用真實 iPhone 開 production 即可看到 mobile 版本
- ⚠️ Dark mode：Tailwind v4 用 media-query 策略（class strategy toggle 無效），Chrome MCP 沒暴露 CDP `Emulation.setEmulatedMedia`。所有 `dark:` classes 都在新 markup 中保留（`dark:bg-zinc-950` / `dark:text-zinc-100` / `dark:bg-amber-500/15` 等），切 OS dark mode 會正確生效

### 跟 spec 的 deviations

1. **「停止 = 儲存成功」改為「停止 = 用戶感知已捕捉 + 下次 CTA 點擊時實際寫入」**
   - 原因：spec 同時要求 "停止後自動儲存" + "備註是 secondary action collapsed 區可加" — 但既有 firebase/walks.ts 沒有 `updateWalk` 函式，UI/UX 角色不能加新 firebase function。若 stop 立即 save，後續加備註就沒有 update path。
   - 折衷：stop 切到 done view（用戶感知「捕捉了」）。`saveWalkOnce()` 在用戶點「回到遛狗」或「查看排行榜」時觸發，連同當下 notes state 一起寫 Firestore。idempotent flag 防止重複寫入。
   - 風險：用戶在 done view 直接關 tab → walk 沒存。緩解：done view 不能用 Esc 或 X 關閉，唯二出口都會觸發 save。
   - 完整解法（未在 scope）：Feature Builder 加 `updateWalkNotes(walkId, notes)` 到 `firebase/walks.ts`，然後改回「stop = 立即 save、notes 用獨立 update call」。可寫進新 backlog 條目。

2. **Tracking view 的「setup phase」拿掉**
   - Spec 沒明說但暗示「點開始 → 直接追蹤」；舊 `WalkSessionDialog` 有 setup phase 讓使用者再確認寵物 + 看 GPS 警告。新 Hero 已經做寵物選擇，所以 view 開啟即 auto-start session。
   - GPS 警告：原本的 "請保持畫面開啟" 大段警告改成 errorKind→i18n key 的短文案（最多兩三字 + AlertTriangle icon）。`e54a94d` Wake Lock 已大幅降低 background pause 機率，警告需求變低。

3. **紀錄列表 grid layout 沒改**
   - Spec 寫「最近 5-10 筆」，我採 10 筆上限。沒改 walks 顯示為 grid（沿用 walk-card.tsx 原本的 stack），所以 single-column。

### 後續可考慮（不在本 spec）

- Feature Builder: 加 `updateWalkNotes` 讓 deviation #1 變回 spec literal 解
- UI/UX 下一輪：mobile real-viewport visual 驗證 + dark mode 截圖（需要 user 從手機真機驗，或 PM session 安排 Codex 用 macOS Chrome MCP 跑）
- 觀察：production 上線一週後看 walks 寫入頻率 vs baseline（spec 量性指標）
