# 遛狗體驗 v2 — 拍照 + 結算 celebration + Motivation 元素

狀態：SHIPPED — Phase 1 `375ecba` + Phase 2 `7fde453`（2026-05-24 push；Chrome MCP 驗收待 build 上線後做）
建立日期：2026-05-24
最後更新：2026-05-24
規格作者：PM session（基於 user 2026-05-24 vision message — 5 個需求中的 3 個）
角色：Feature Builder（整 stack — walk schema + Storage + UI + i18n）

## User 原話（5 個需求，本 spec 處理 3 個）

> 加入遛狗的拍照功能 / 加入一些吸引人的元素讓使用者想要遛狗 / 遛狗結束後增加結算畫面，使使用者有成就感

（另兩個需求：「提醒搬到我的寵物」→ 另開 `reminders-to-pets-page.md`；「開始按鈕移到下方」→ PM push-back，見另一份 PM 訊息）

## Why now

User 自己 2026-05-23 提的 product principle：
> 留住使用者的不是功能數量，而是每天都有一個很小的「完成感」。

Walk-core v1 已 ship（30 min daily / 5x weekly / full-screen tracking / in-page complete）— v2 是把「完成感」放大 + 加入「拍照留念」這個情感 hook，讓遛狗從「完成 task」升級為「有故事可看的回憶」。

## 5 個 product decisions

| Decision | PM 預設 | 替代 |
|---|---|---|
| **D1 拍照觸發點** | tracking view 中 camera icon button | completion view 後補拍 / 兩處都做（PM 不推薦：tracking 中拍最自然，後補容易忘） |
| **D2 每次 walk 拍照上限** | **5 張** | unlimited（Storage cost 失控）/ 1 張（太死板）|
| **D3 結算 celebration 動畫** | **always 顯示**（達標 emerald confetti、未達 zinc 平實 recap）| 只有達標才動畫（未達 user 感覺被打槍）|
| **D4 連續天數 streak badge 位置** | **Hero 區永遠在**（戴在進度條旁，數字醒目 + 🔥 icon when ≥3 days）| 只結算畫面顯示（hero 沒 streak 動能少）|
| **D5 鼓勵文案來源** | **預設集合**（i18n random pick 自 ~10 段文案 / 根據時間 + streak + pet 名字組合）| user 自訂（額外設定頁 + DB schema 改，over-engineering）|

## 完成標準

### Phase 1: 拍照功能

#### Schema + Storage

- [ ] `walks/{walkId}` schema 加 `photoURLs?: string[]`（optional，新欄位 — 既有 walks 沒此欄位不爆）
- [ ] Storage path: `walks/{walkId}/photos/{idx}-{timestamp}.jpg`（`idx` 0-4 對應 D2 上限 5 張）
- [ ] Storage rules: `walks/{walkId}/photos/*` 沿用既有 `users/{uid}/*` pattern（signed-in user read + walker write）— 但要明確處理 cross-user：family-scoped walk 的 photo 應**家庭成員都可讀**
- [ ] 客戶端壓縮：沿用 `src/lib/image-processing.ts` 既有 pipeline（HEIC→JPEG + compress）

#### UI — Tracking view（`walk-tracking-view.tsx`）

- [ ] 大字三件事（時間/距離/今日進度）下方加 **camera icon button**：
  - icon: `Camera` from lucide-react
  - label: 「拍照 (0/5)」/「Photo (0/5)」隨拍隨更新
  - disabled 當已達 D2 上限
  - 點 → `<input type="file" accept="image/*" capture="environment">` 觸發系統相機
- [ ] 已拍照片顯示為 **horizontal scrollable thumbnail strip**（在 camera button 下方）
- [ ] 每張 thumbnail 右上小 X icon 可刪除（誤拍時撤回）
- [ ] 上傳中 thumbnail 顯示 loading shimmer；上傳完成顯示完整 image
- [ ] 上傳失敗 → 該位置紅色 retry icon

#### UI — Completion view (Phase 4 of walk-core)

- [ ] 結算 recap 區下方加 **「本次紀錄」photo grid**（如有照片）
- [ ] Grid 2 cols on mobile, 3 cols on desktop, square thumbnails
- [ ] 點 thumbnail → lightbox / 全屏 preview（沿用 feed post 既有 photo viewer 元件如有，否則 simple modal）

#### i18n keys（zh-TW + en）

- `Walks.photo.button` / `Walks.photo.limitReached` / `Walks.photo.uploading` / `Walks.photo.failed` / `Walks.photo.delete` / `Walks.photo.viewLightbox`

### Phase 2: 結算 celebration + Motivation 元素

#### A. 結算畫面 expansion

當前 walk-core v1 完成畫面（`saveWalkOnce` 觸發後）只顯示 Trophy + 文案 + recap + 兩個 CTA。v2 expansion：

- [ ] **達標時（today >= 30 min）**：
  - 全屏淡入 emerald gradient 背景（CSS animation, no library）
  - 大字 Trophy + 「完成今日目標！」/「Goal hit!」
  - **CSS-only confetti**（用 ~20 個 absolutely positioned div + keyframes animation；no `canvas-confetti` library — keep bundle 小）
  - 連續天數 update 動畫：之前 X 天 → 跳到 X+1 天，數字 scale up + 🔥 icon pop in（如 ≥3 天）
  - 本週進度 bar 從之前 % 滑到新 %（CSS transition 0.6s ease）
- [ ] **未達時（today < 30 min）**：
  - 全屏淡入 zinc gradient（不悲傷，平靜）
  - Trophy 換 `Footprints` icon + 「今天完成 X%」/「Today's X%」
  - 鼓勵 sub-text：「再 Y 分鐘就達標 — 明天加油 💪」/「Y more min to goal — try again tomorrow」
  - 連續天數**只更新數字**，不 confetti（沒達標不算進 streak）
  - 本週進度 bar 仍滑動到新 %

#### B. Recap 數據 expansion

當前 recap 只有「時間 / 距離 / 平均速度」3 個。v2 加：

- [ ] **第 4 個**: 本次 walk vs **本週平均**對比（「比平均長 12 分鐘」/「Longer than weekly avg by 12 min」）
- [ ] **第 5 個**: 估算消耗（**寵物**，用 distance × 寵物體重 × factor：每 1kg / 1km ≈ 1.2 大卡）「Mango 消耗約 X 大卡」（誤差大，但有趣）
- [ ] 不顯示「分數」（仍在 leaderboard，不重複）

#### C. Motivation 元素（Hero 區）

- [ ] **連續天數 streak badge** 永遠在 Hero 區（進度條旁邊）：
  - 0-2 天：純數字小灰色
  - 3-6 天：數字 + amber 🔥 icon
  - 7+ 天：數字 + emerald 🔥 icon + 「連續一週！」/「One week streak!」hover tooltip
- [ ] **鼓勵文案**（hero 區進度條上方一行 sub-text）：i18n random pick from ~10 段
  - 時間 + 寵物名變數可插入
  - 範例 zh-TW：
    - 「Mango 已經等你 X 小時了 🐶」（X = since last walk）
    - 「Mango 上次散步是昨天，今天該動了」（streak 1 天）
    - 「連續 X 天！別斷掉 🔥」（streak ≥ 3）
    - 「今天還沒開始 — 走出去吧 ☀️」（0 walks today）
  - 範例 en：對應翻譯
  - 邏輯：根據 (today minutes, last walk time, streak, pet name) 選最相關那段
- [ ] **不**加：天氣 API（成本 + 隱私複雜）/ 季節主題（過度設計）/ 競爭文案（負面動機）

### D. 完成標準（共用）

- [ ] i18n zh-TW + en 全齊
- [ ] `npx tsc --noEmit` pass
- [ ] Chrome MCP iPhone + desktop 對照 light/dark
- [ ] Confetti animation 在 prefers-reduced-motion 下停用（accessibility）
- [ ] Phase 1 跟 Phase 2 可獨立 ship（但建議一條龍跑）

## 成功指標（上線後一週看）

- 質性：自己 + 家人實測「拍照很順手，沒中斷追蹤節奏」
- 質性：「結算畫面看到 confetti / 數字跳動有成就感」
- 量性：上線後 3 天內 walks doc 內 `photoURLs.length > 0` 的比例 > 30%

## 不在這次範圍

- 影片錄製
- 即時定位分享給家人（family live tracking）
- 路徑回放 / heatmap
- 推播「我正在遛狗」給家人
- 拍照地點 GPS metadata embedding（隱私複雜）
- 多張 photo collage 自動拼貼
- Schema 改動 except `walks.photoURLs?`
- 自訂鼓勵文案（user 寫自己的 motivation messages）
- 競爭性元素（「快點，鄰居比你多遛 X 分鐘」— 負面動機）
- 季節 / 天氣 API 整合（成本不可預測）

## 技術筆記

### 動到的檔案

- `src/lib/types.ts`：`Walk` type 加 `photoURLs?: string[]`
- `src/lib/firebase/walks.ts`：`createWalk`/`updateWalk` 接受 `photoURLs?`
- `src/lib/image-processing.ts`：沿用既有 HEIC→JPEG + compress（不動）
- `src/components/walks/walk-tracking-view.tsx`：加 camera button + thumbnail strip
- `src/components/walks/walk-completion-view.tsx`（如獨立檔，或合在 tracking-view）：加 photo grid + celebration + recap expansion + streak update animation
- `src/app/app/walks/page.tsx`：Hero 加 streak badge + 鼓勵文案
- `src/lib/walk-tracking.ts`：加 helper `getStreakInfo(walks)` / `getEncouragementMessage(stats, petName)`
- `src/app/globals.css`：CSS confetti keyframes + streak animation
- `messages/zh-TW.json` + `messages/en.json`：`Walks.photo.*` + `Walks.celebration.*` + `Walks.streak.*` + `Walks.encouragement.*` 新 namespace
- `storage.rules`：family-scoped walk photos read permission（如需）

### 部署順序

1. `npx firebase deploy --only storage`（如改 storage rules）
2. `git push origin main`（前端 + functions 改動可一起，walks schema 是 additive 不需 migration）

### Edge cases

| Edge | 處理 |
|---|---|
| 拍照後 walk 中斷 / 未保存 | photos 上傳到 Storage 但 walk doc 沒建 → orphan photos。處理：完成 walk 才寫 `photoURLs` 到 walk doc；若 user 中斷 → 30 天後 Storage GC script 清 orphan（**out of scope**，留 backlog） |
| iOS Safari 不支援 capture | Fallback：純 file picker（user 從相簿選） |
| Streak 0 天 | Hero 不顯示 🔥 icon，純數字「0」灰色 |
| 鼓勵文案根據 streak/last walk 算 | 用 i18n message templates + JS string interpolation；keys 含變數如 `{petName}`、`{hours}` |
| Confetti accessibility | `@media (prefers-reduced-motion: reduce) { .confetti { display: none; } }` |
| 既有 walks 沒 photoURLs | Type optional，UI render 時 `walk.photoURLs?.length` 容錯 |

### 跟既有 spec / commit 的關聯

- **walk-core-redesign（v1）**：本 spec 是 v2，沿用 v1 的 hero / tracking-view / complete-view 結構；v1「Hero 大按鈕第一視覺焦點」原則保留 — 詳見 PM push-back 訊息
- **delete-account**：walks 含 photos 是個人資料，cascade delete 已 cover 全 walk doc + 子集合；photos Storage 物件也要刪 — `deleteUserAccount` callable Phase 1 spec 已列「Family pet 的 Storage photos」hard delete，本 spec 沿用同樣 walk photos hard delete pattern。建議 FB 動工時順手 review delete-account callable 確認 walk photos 也被處理（spec 沒明列 walk photos 因為當時 walks 沒 photo field）
- **data-export**：walks export 含 photoURLs（已 cover — pet 子集合 export 含 photoURLs；walk 是 top-level 但欄位 export 自動含）

## 開放問題

- [x] D1 拍照觸發點：tracking 中 ✓
- [x] D2 上限 5 張 ✓
- [x] D3 always celebration ✓
- [x] D4 streak badge Hero 永遠在 ✓
- [x] D5 鼓勵文案預設集合 ✓
- [x] 拍照失敗 retry：採極簡 — 失敗顯示紅色 AlertTriangle 覆蓋層，user 自己手動刪 + 重拍。沒做自動 retry (PM 建議 3 次 retry 留 backlog 觀察是否需要)
- [x] Orphan photos：留 backlog（spec 已聲明 out of scope）— 30 天 GC script 由 Backend session 另排
- [x] Lightbox：寫了 simple inline modal（feed 既有 PhotoViewer 沒檢查必要 — walks 流程只需要看，不需編輯）
- [x] 鼓勵文案：精簡為 4 段（noWalksToday / streakKeep / petWaiting / lastWalkYesterday）by `getEncouragementHint` 邏輯路由。PM spec 範例 10 段沒全做 — 覆蓋核心 4 種情境已足，user 不喜歡可後續加 keys

---

## SHIPPED 紀錄

| Phase | Commit | 內容 |
|---|---|---|
| Phase 1 — photo capture | `375ecba` (recovery) | `Walk.photoURLs` schema additive，`walkPhotoPath` helper，`createWalk` 帶 photoURLs，tracking-view 加 camera button + thumbnail strip + completion grid + lightbox modal，`Walks.photo` × 7 i18n keys |
| Phase 2 — celebration + motivation | `7fde453` | CSS `walk-confetti` + `walk-streak-pop` keyframes（含 prefers-reduced-motion 隱藏）；completion view 加 emerald/zinc gradient backdrop + confetti overlay + streak pop badge + 「比平均長 N 分鐘」+「Mango 消耗約 X 大卡」recap tiles；Hero 加 streak badge (0-2 灰 / 3-6 amber / 7+ emerald) + 4 段 encouragement 文案；helpers `getWeeklyAvgMinutes` / `estimatePetCalories` / `getEncouragementHint` in `walk-tracking.ts`；`Walks.celebration` / `Walks.streak` / `Walks.encouragement` × 13 i18n keys |

部署時間 (Asia/Taipei 2026-05-24): commit timestamps 直接看 git log；Phase 2 push → App Hosting auto-build (~5-8 min)。

### Storage / rules / functions / indexes

無改動 — 既有 `users/{uid}/{allPaths=**}` storage rule 已 cover walk photo path（uploader == self, signed-in 家庭成員 read）。

### Bookkeeping anomaly（記錄 — 不影響 production）

原本 Phase 1 commit (push output 顯示 `e16e18e`) 在 git history 中被另一 session 的 force-push 覆蓋（同 hash 內容變成 `ui(reminders): move overview...`）。Phase 2 push 後發現 working tree 仍含 Phase 1 的 3 個檔案 → 補 commit `375ecba` recovery。functionally identical to lost commit；production build 依賴的 walkPhotoPath / photoURLs schema 都在最終 HEAD 內。下次並行 session 高峰期建議在 push 之間多跑 git fetch.

### Chrome MCP 驗證結果

待 build 上線後 Chrome MCP 在 iPhone + desktop, light/dark mode 跑一遍。

## PM 對「開始按鈕移到下方」需求的 push-back

User 5 個需求中第 3 個是「把開始遛狗的按鈕移到下方」。這個需求**違反 walk-core-redesign spec 的核心 principle**「使用者打開遛狗頁後 3 秒內知道今天要不要遛、按哪裡開始」。

詳見 PM session 訊息中的 push-back surface，本 spec **暫時不動按鈕位置** — 等 user 重新評估。
