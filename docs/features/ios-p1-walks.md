# iOS P1 — Walks（核心遛狗）Parity Spec

狀態：**IN PROGRESS** — ✅ P1a 實機簽收（2026-06-01）｜🟡 P1d 背景 GPS code/native COMPLETE 待實機簽收（merge `871b154`；session-only + Always fallback；審查 note + Open Q3 收 parity §F）｜🔀 **sub-phase 順序 P1d → P1b → P1c**（user 2026-06-01：背景續跑核心缺口 + 審查提早暴露）
建立日期：2026-05-31
規格作者：iOS PM session
角色執行：**iOS Backend**（native location/camera/storage 設定 + shared packages + schema 相容驗證）+ **iOS Feature Builder**（screens + flow 端到端）+ **iOS UI/UX**（dial / 走路狗 / safe-area / 動效）
工作量：**L** — **2.5–3 週**（含背景 GPS +0.5–1 週 buffer，見 §背景 GPS）
前置：✅ P0 Foundation 簽收（2026-05-31）

> 這是 iOS app 的**第一個 feature parity phase**，也是整個 app 的核心（roadmap：「Mango Pet 的核心仍是遛狗」）。對齊 web 已 shipped 的 walks v2 全套 flow，**外加 iOS-only 背景 GPS**（Q4 committed，刻意的 native 擴張）。

## 🎯 P1 完成定義（Milestone）

iOS 使用者能在實機完成**完整遛狗 flow**：
1. 進 Walks 首頁看到 dial（今日進度）+ week strip + 走路狗 + 主寵物 / pet picker。
2. 開始遛狗 → 前景 + **背景** GPS 追蹤（鎖屏/切背景仍記錄）+ timer + 距離。
3. 結束 → done screen（confetti + 達標慶祝）→ 存檔。
4. walk doc 寫進**同一個** Firestore `walks/{walkId}`，leaderboard trigger 自動跑（不動 backend）。
5. 拍照（遛狗中）+ 自動發動態（start/end prompt → post 帶 walkId cross-link）。
6. Recent walks 列表 + 手動補登 dialog。

> P1 **對齊 web behavior 為準**；背景 GPS 是唯一**超出** web 的能力（web PWA 做不到），屬刻意 native upgrade，非 drift。

---

## 📊 Scope — parity 項目（對齊 parity-checklist §A P1）

| # | Web feature | Web spec / 來源 | iOS policy |
|---|---|---|---|
| 1 | Walks 全頁（radial dial + week strip + 圈內走路狗 + 主寵物 pill）| `walks-v2-rebuild.md` `984be5b` | parity |
| 2 | GPS tracking + timer + stop | `walk-tracking.ts`（WalkSession）| **parity + 背景 GPS（committed）** |
| 3 | Done screen + confetti + 達標變體 | walk-tracking-view | parity |
| 4 | 手動 walk dialog | manual-walk-dialog | parity |
| 5 | Per-pet 自訂散步目標 + pet picker dropdown | `per-pet-walk-goal.md` | parity |
| 6 | Walk 拍照 + Storage 上傳 | walk-tracking-view（5 張上限）| parity |
| 7 | 遛狗自動拍照 + 自動發動態（start/end prompt）| `walks-auto-photo-share.md` | parity |
| 8 | Walks history（recent + 「全部」展開）| walk-row | parity |

### 不在 P1 範圍（明確排除）
- **Live map 路徑顯示**：web tracking 畫面**沒有**即時地圖（只有 timer + 距離 + stop），path 有記錄但不畫在地圖上 → iOS P1 **同樣不畫 live map**（`react-native-maps` 留作未來 native upgrade，非 P1 parity）。
- **追蹤中 reload 恢復 state**：web backlog 也沒做 → iOS 不做（native app 背景續跑反而更少這問題）。
- **路徑回放 / 影片 / 即時定位分享 / 天氣**：roadmap not-do，沿用。
- **Dark mode**：跟 web 一致跳過第一輪。

---

## 🔌 Data contract — 接同一個 backend（iOS Backend 必讀）

**P1 不動任何 backend**（functions / rules / indexes / storage rules 全不碰）。iOS 寫入路徑必須跟 web **逐欄位一致**，否則 leaderboard trigger / feed 會壞。

### Walk doc（`walks/{walkId}` top-level collection）
從 `apps/web/src/lib/types.ts` 的 `Walk` type 抽到 `@mango/shared-types`。關鍵欄位（iOS 寫入必須一致）：
```
walkId, familyId?(null=personal,不上 leaderboard), walkerUid, walkerName, walkerPhotoURL?,
ownerUid(= walkerUid mirror), petId, petName?, startedAt, endedAt,
distanceKm, durationMin, path?(WalkPathPoint[] {lat,lng,t}, ≤500), isManual,
score, notes?, photoURLs?(≤5 Storage URLs), createdAt(server)
```
- ⚠️ **`score` 計分公式**：web 端寫入時算好（weighted formula）。iOS 必須用**同一公式** → 抽到 `@mango/shared-business`（見 §code sharing），不可各算各的，否則 leaderboard 不一致。
- ⚠️ **`familyId == null` = personal walk**：Cloud Function `recomputeWalkerLeaderboards`（onCreate）會 short-circuit personal walk。iOS 寫入時 family/personal 判斷邏輯要跟 web 一致。
- **Cloud triggers 不動**：`onDocumentCreated("walks/{walkId}")` → leaderboard recompute；`onDocumentDeleted` → 配對 recompute。iOS 只負責正確寫 doc，trigger 自動跑。

### Storage 路徑（必須一致）
- Walk 照片：`users/{walkerUid}/walks/{sessionId}/photos/{idx}-{ts}.{ext}`（≤5）
- Post 照片：`users/{authorUid}/posts/{postId}/{idx}.{ext}`
- 用 `@react-native-firebase/storage`，路徑字串跟 web 一字不差。

### Post doc（auto-photo-share，`posts/{postId}` top-level）
從 `Post` type 抽到 shared-types。關鍵：`walkId?` optional cross-link（START post 可能先於 walk doc 建立；END post 後於 walk doc）。`createPost` 等價邏輯接同 collection。

### GPS path 取樣規則（對齊 web `walk-tracking.ts`，抽 shared-business）
- watchPosition 等價：高精度、`maximumAge:0`
- 過濾：accuracy < 50m 才收；samples 間距 ≥ 5m 才記
- Haversine 距離（地球半徑 6371km）
- path cap 500 點（rolling）
- 背景暫停時長要從 durationMin 扣掉（web 用 hiddenMs；iOS 背景續跑語意不同，見 §背景 GPS）

---

## 📦 Code sharing（P1 要新建/擴充的 packages）

| Package | P1 動作 | 內容 |
|---|---|---|
| `@mango/shared-types` | **擴充** | 加 `Walk` / `WalkPathPoint` / `Post` / `Visibility` 等 types（從 web types.ts 抽，web 改 import 同 package） |
| `@mango/shared-business` | **新建** | `walk-goals.ts`（✅ 已驗證 pure：`getPetWalkGoalMinutes` / `DEFAULT_WALK_GOAL_MINUTES=30` / clamp[5,180] / `formatWalkGoal`）+ **walk score 計分公式** + **Haversine 距離** + GPS 取樣 filter（純函式，web + ios + functions 三邊對齊）|
| `@mango/shared-i18n` | **（P1 可延後）** | Walks namespace（`Walks.core` / `Walks.page` / `Walks.photo` / `Walks.celebration` / `Walks.streak` / `WalksPhotoPrompt`）；P1 若先 inline ios 字串也可，但建議此 phase 起建 shared-i18n 避免雙份 drift |

> ⚠️ `walk-goals` 的 DEFAULT 值 functions 端有重複一份（手動 sync）。抽 shared-business 後，**functions 是否也改 import** = open question（見下），P1 預設**不動 functions**，只確保 ios 值跟 web/functions 現值一致。

---

## 📍 背景 GPS（Q4 committed）— native 擴張 + App Store 審查（§F 重申）

這是 P1 唯一超出 web 的能力，也是 buffer 來源。iOS Backend / Feature Builder 已知約束：

- **能力**：遛狗中鎖屏 / 切背景仍持續記錄路徑 + 時長；walk 結束**立即停**背景定位。
- **權限**：`When In Use` → `Always`（`expo-location` 背景權限）。Info.plist usage strings：`NSLocationWhenInUseUsageDescription` + `NSLocationAlwaysAndWhenInUseUsageDescription`，文案講清「記錄遛狗路線」。
- **背景模式**：`UIBackgroundModes` 含 `location`（Expo config plugin 設定）。
- **⚠️ App Store 審查重點**：背景定位最常見拒絕 = 用途不充分。必須：(a) usage string 明確；(b) **只在遛狗 session 進行中**啟用背景定位，結束即關；(c) 不可常駐背景定位。TestFlight 前 pre-read review guideline。
- **耗電 / UX**：背景高頻定位耗電 → 結束自動關 + 提供前景 fallback（即使背景權限被拒，前景追蹤仍可用）。
- **降級路徑**：若 Always 權限被拒 → 退回前景追蹤（同 web 能力），不 block 主 flow。

---

## 🧭 P1 sub-phase 建議（solo founder 節奏，2.5–3 週）

> 每個 sub-phase 可獨立 commit + 實機驗；不必一次到位。

| Sub | 內容 | 角色 | 驗收 |
|---|---|---|---|
| **P1a 核心 loop**（~1 週）| shared-types 加 Walk/Post + shared-business（walk-goals + score + haversine）；WalksHome（dial + week strip + 走路狗 + pet picker + 主寵物）；**前景** expo-location 追蹤 + timer + 距離 + stop；walk doc 寫 `walks/{walkId}` | Backend + FB + UI/UX | 實機走一趟 → doc 正確落地 + leaderboard 有動 |
| **P1b 結束 + 補登**（~0.5 週）| Done screen（confetti + 達標變體 + 存檔 + notes）；手動 walk dialog；Recent walks 列表 + 「全部」展開 | FB + UI/UX | done screen 慶祝對齊 web；手動補登寫 isManual=true |
| **P1c 拍照 + 自動分享**（~0.5 週）| expo-camera 拍照（≤5）+ Storage 上傳；PhotoPromptSheet（start/end）+ PostComposer + walkId cross-link | FB + Backend | post 帶 walkId；feed 看得到 |
| **P1d 背景 GPS**（~0.5–1 週 buffer）| Always 權限 + Info.plist + UIBackgroundModes + session-only 背景定位 + 結束即停 + 前景 fallback；App Store 審查 pre-check | Backend 主導 | 鎖屏走一段 → 路徑/時長不中斷；權限拒絕降級正常 |

---

## 🖼 Screen 對應（給 iOS Feature Builder / UI/UX）

| Web 元件 | iOS screen/元件 | 備註 |
|---|---|---|
| `walks/page.tsx` | `app/(tabs)/walks.tsx`（已有 placeholder）| 整頁：top bar + dial + week strip + recent + sticky CTA |
| `walks-dial.tsx`（232px SVG 環）| RN：`react-native-svg` 環 + 中央走路狗 slot | 進度環 transition 保留（reduced-motion 仍跑） |
| `walks-pet-walking.tsx`（6 keyframes 走路狗）| RN：Reanimated / SVG 動畫 | `prefers-reduced-motion` → RN `AccessibilityInfo.isReduceMotionEnabled` 對應 |
| `walks-week-strip.tsx` | RN 7 圓圈 | 完成日 = dayTotalMin ≥ goalMin（per active pet）|
| `pet-picker-dropdown.tsx` | RN dropdown/sheet | 多 pet → goal chip + 切 pet 換 dial；單 pet → 主寵物 pill |
| `streak-chip.tsx` | RN chip | ≥7 天 leaf 變體 |
| `walk-tracking-view.tsx`（full-screen）| RN modal/screen | timer + 距離 + 拍照 + 紅停止；**無 live map** |
| done screen（walk-tracking-view phase）| RN done screen | confetti + emerald 慶祝 + 存檔 + notes |
| `manual-walk-dialog.tsx` | RN dialog | 手動補登 |
| `photo-prompt-sheet.tsx` + `post-composer.tsx` | RN bottom sheet + composer | start/end + walkId |
| `walk-row.tsx` | RN row | recent 列表 |

UI/UX 注意：safe-area（tracking full-screen 要避瀏海/home indicator）、Dynamic Type、走路狗動畫效能（背景時停）。

---

## 🤝 Handoffs

### → iOS Backend
- [ ] `@mango/shared-types` 加 Walk / WalkPathPoint / Post / Visibility（web 改 import 同 package，tsc 雙端 pass）
- [ ] 新建 `@mango/shared-business`：walk-goals（搬 web pure helper）+ **score 公式** + Haversine + GPS 取樣 filter（純函式）
- [ ] `expo-location`：前景（P1a）+ 背景（P1d）；Info.plist usage strings + `UIBackgroundModes:location`（Expo plugin）+ Always 權限流程 + 降級
- [ ] `@react-native-firebase/storage`：walk/post 照片路徑**字串一致**
- [ ] walk doc 寫入：`walks/{walkId}` 欄位逐一對齊；familyId/personal 判斷一致；score 用 shared-business
- [ ] **驗證 schema 相容**：iOS 寫的 walk → web feed/leaderboard 讀得出來（不動 functions/rules）
- [ ] Apple 背景定位審查 pre-check（usage string + session-only）
- [ ] **不動** functions / rules / indexes / storage rules / apps/web 行為

### → iOS Feature Builder
- [ ] P1a–P1c 的 screens + flow 端到端（接 shared-business + native modules）
- [ ] expo-camera 拍照（≤5）+ 上傳；PhotoPromptSheet + PostComposer + walkId cross-link
- [ ] 手動補登 + recent 列表
- [ ] i18n：接 shared-i18n（或 P1 先 inline，但標 follow-up）

### → iOS UI/UX
- [ ] dial（react-native-svg）+ 走路狗動畫（Reanimated）+ week strip + streak chip，視覺對齊 web v2
- [ ] tracking full-screen safe-area + done screen 慶祝 + reduced-motion
- [ ] mango tokens 一律走 `@mango/shared-tokens`（theme.ts）

---

## ⚠️ Edge cases（對齊 web，§walks-v2 表）

| Case | 處理 |
|---|---|
| 0 pets | EmptyState「先建寵物」，不顯示 dial/week strip |
| 多 pets | pet picker dropdown（per-pet goal）；切 pet 換 dial goal |
| GPS 權限拒絕 | 前景：停追蹤 + 提示；背景 Always 拒：降級前景，不 block |
| 鎖屏 / 切背景 | **iOS native 續跑**（P1d）；前景 fallback 時比照 web 暫停語意 |
| Personal mode | walks 不分模式；familyId=null → 不上 leaderboard（trigger 自己 skip）|
| 今日已達標再遛 | 「再遛一次」CTA = 同開始遛狗 flow |
| 達標 confetti | 純裝飾，accessibility hidden |
| 拍照拒權 | fallback 不拍照仍可完成 walk（同 web）|

---

## ❓ Open questions（交 iOS Backend / iOS PM）
1. **walk score 公式**：抽 shared-business 後，`functions/src/index.ts` 內重複的計分/DEFAULT 是否也改 import？P1 預設**不動 functions**（風險最低），只確保 ios 值對齊現值；若日後要單一真相源，另開 backend task。
2. **shared-i18n 起建時點**：P1 就建（避免雙份 drift）vs P1 先 inline ios 字串、P3 feed 時一起建？iOS PM 傾向 P1 起建。
3. **背景定位審查**：是否在 P1d 就做一次 TestFlight internal 把背景定位流程跑給自己看（不等 P7）？建議是，提早暴露審查風險。
4. **走路狗動畫技術**：Reanimated vs 純 SVG animate — 交 iOS UI/UX 評估效能，PM 不指定。

## 跟其他 spec 的關聯
- 上承 [`ios-app-strategy.md`](./ios-app-strategy.md) P1 + [`ios-parity-checklist.md`](./ios-parity-checklist.md) §A P1 + §F（背景 GPS）。
- Web 行為基準：`walks-v2-rebuild.md`（SHIPPED）+ `per-pet-walk-goal.md` + `walks-auto-photo-share.md` + walk-core。
- 背景 GPS 與 roadmap「不做 Web 內背景 GPS」**無矛盾**（該禁令僅限 web PWA；iOS native 是刻意擴張）。
- 下接 P2 Pets（pet picker / walkGoal stepper 在 P2 pet edit form 再深化）。
