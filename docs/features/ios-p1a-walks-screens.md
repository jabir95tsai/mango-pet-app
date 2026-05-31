# iOS P1a — Walks Core-Loop Screens (ship note)

狀態：**SCREENS DONE (code + tsc) / SIMULATOR WALK PENDING (macOS step)**
建立日期：2026-06-01
角色：**iOS Feature Builder**
上承：[`ios-p1-walks.md`](./ios-p1-walks.md) P1a；P1a backend `7fe2438`（service / createWalk / shared-business）
parity：[`ios-parity-checklist.md`](./ios-parity-checklist.md) §A P1

## 做了什麼（全部在 `apps/ios/**`，未碰 packages/web/functions/dep/lockfile）

把 `app/(tabs)/walks.tsx` 從 PlaceholderScreen 換成真的 WalksHome + 接 P1a backend 的前景 GPS loop：

- **資料層（read-only，mirror web 查詢）**
  - `src/lib/walk-data.ts`：`resolveCurrentFamilyId`（讀 `users/{uid}` → familyIds/currentFamilyId，邏輯同 web family-provider）、`listPetsForScope` / `listWalksForScope`（@react-native-firebase/firestore，query 形狀逐一對齊 web `listPets/listPersonalPets`、`listWalks/listPersonalWalks`，含 `familyId==null` personal 分支）。
  - `src/lib/walk-stats.ts`：`getTodayProgress` / `getWeekDayDoneFlags` / `getWeekKm` / `getWeekWalkCount` / `computeStreak` / `todayIdxLocal` —— **verbatim port** 自 web（walk-tracking.ts + walks page + scoring.ts）。
  - `src/lib/use-walks-data.ts`：hook 組裝 pets/walks/familyId + primaryPet/activePet + goalMin + 今日/本週/streak 衍生值（mirror web WalksPage）。
- **畫面**
  - `WalksDial`（`components/walks/walks-dial.tsx`）：**無 SVG** 的 60-段環形 dial（不加新 dep），中央走路狗 + `{done}/{goal} 分` pill；達標變 leaf 綠。
  - `WalksWeekStrip`：7 圈 Mon-first，完成日 = 當日分鐘 ≥ goal，today 標記。
  - `PetPill` + 多寵物 picker bottom sheet（goal chip；單寵物靜態 pill）。
  - `WalkRow`：recent 列表 row（date · km · 分）。
  - sticky「開始遛狗」CTA（浮在 bottom tab 上方）+ 0-pet EmptyState。
  - `WalkTrackingView`（full-screen Modal，safe-area）：接 `WalkTrackingService` → 即時 timer + 距離 + 路徑點數 + 紅色停止；停止 → 組 `CreateWalkInput` → `createWalk(...)` → refresh 首頁。背景時顯示「暫停中」（前景-only 語意）。
- **score / goal / GPS 全部用 `@mango/shared-business`**（computeWalkScore / getPetWalkGoalMinutes / addGpsSample，service 已內建）→ 不自算，leaderboard 一致。
- **i18n**：P1a 先 inline zh-TW（shared-i18n 未建）。

## 驗證了什麼

- ✅ `npm run typecheck -w @mango/ios`（tsc --noEmit）pass。
- ✅ change surface 僅 `apps/ios/**`；未動 apps/web / packages/* / functions / rules / indexes / **package.json / lockfile**（git status 確認）→ 不需 App Hosting gate、web 不受影響。
- ⏳ **實機走一趟 walk → doc 落地 + leaderboard 反應：未跑**。本機是 Windows，無 iOS simulator / Xcode；EAS build 需 macOS/Expo 互動。屬 macOS/EAS 步驟（同 P0 ship note）。code path 已接好：stop → createWalk 寫 `walks/{walkId}`（mirror web 欄位）→ `familyId != null` 時既有 leaderboard trigger 自動跑。

## ⚠️ 已知限制 / 刻意 P1a 取捨

- **active pet 選擇 in-memory**（web 用 localStorage 持久化）。iOS 持久化要 AsyncStorage = 新 dep → 不在 P1a 加；預設用 primaryPet。
- **dial 是分段環，非平滑 arc + 走路狗是靜態**：功能優先；精緻 arc / Reanimated 走路狗動畫 / reduced-motion → iOS UI/UX。
- **無 done screen confetti / notes / 手動補登 / recent「全部」展開 / 拍照 / 自動發動態 / 背景 GPS** → P1b/P1c/P1d，刻意不做。

## 🤝 Handoff

### → iOS PM
- P1a milestone（走一趟 → doc + leaderboard）**code 完成、待實機簽收**（需 macOS/EAS 跑 dev build 走一趟）。
- parity-checklist §A P1 可標**進行中**的列：「Walks 全頁（dial+week strip+走路狗+主寵物 pill）」「GPS tracking + timer + stop（前景）」「Per-pet goal + picker」「Walks history(recent)」——這四列 screens 已到位；標 ✅ 前需實機驗一趟。背景 GPS（§F）仍 P1d 未做。

### → iOS Backend
- **建議把 pure helpers 收進 `@mango/shared-business`**：`computeStreak` + 今日/本週統計（`getTodayProgress`/`getWeekDayDoneFlags`/週 km/count）目前 web 與 iOS 各一份 verbatim copy（drift 風險）。如同 walk-goals/scoring/gps，移進 shared 單一真相源。我先 inline 是依 spec「先用最小正確實作 + 標 handoff」。
- **active-pet 持久化**：若要對齊 web 的 last-pet 記憶，需 AsyncStorage（新 dep → 你的 branch+linux gate 流程）。

### → iOS UI/UX
- dial 平滑 arc（spec 提 react-native-svg，屬新 dep → 需 Backend gate）+ 走路狗動畫（Reanimated）+ reduced-motion（`AccessibilityInfo.isReduceMotionEnabled`）。
- tracking full-screen 視覺 + done screen 慶祝（P1b）對齊 web emerald 慶祝。
- streak chip / pet pill / week strip 視覺細修對齊 web v2。

### 下一棒
- **P1b**：done screen（confetti + 達標變體 + notes）+ 手動補登 dialog（isManual=true）+ recent「全部」展開。
- **P1c**：拍照（≤5 + Storage 上傳，路徑用 `storage-paths.ts`）+ PhotoPromptSheet + 自動發動態（post walkId cross-link）。
- **P1d**：背景 GPS（Always 權限 + UIBackgroundModes，iOS Backend 主導）。
