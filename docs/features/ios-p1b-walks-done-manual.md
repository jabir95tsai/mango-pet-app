# iOS P1b — Done Screen + Manual Log + Recent Expand (ship note)

狀態：**CODE DONE + tsc pass / 待實機驗收**
建立日期：2026-06-01
角色：**iOS Feature Builder**
上承：[`ios-p1-walks.md`](./ios-p1-walks.md) P1b；P1a screens `a02289c`；P1d service（背景 GPS，已簽收）
parity：[`ios-parity-checklist.md`](./ios-parity-checklist.md) §A P1

## 做了什麼（全部在 `apps/ios/**`，無新 dep）

對齊 web `walk-tracking-view` done 階段 + `manual-walk-dialog` + recent 展開。

### 1. Done screen（停止不再直接存）
- `WalkTrackingView` 加 **done phase**：`stop()` → 顯示摘要，不自動 createWalk。
- 摘要三 tile：**距離 km / 時長 分 / 平均速度 km/h**。
- **達標變體**：`todayMinBefore + 本次分鐘 ≥ goalMin`（goal 來自 `@mango/shared-business` getPetWalkGoalMinutes，由 WalksHome 算好傳入）→ emerald 慶祝（`successTint` 背景 + 🏆 + 達標標題 + streak badge）+ **hand-rolled confetti**。
  - `components/walks/walk-confetti.tsx`：**無 animation library / 無新 dep**（RN `Animated` 自寫，20 片下落+旋轉+淡出）；`AccessibilityInfo.isReduceMotionEnabled` → reduce-motion 時靜態；decorative（a11y hidden）。
  - 未達標變體：完成 % + 「再走 N 分鐘」。
- recap：vs 近 7 天平均（`getWeeklyAvgMinutes`）+ 寵物消耗大卡（`estimatePetCalories`），缺資料自動收起（對齊 web v2 recap）。
- 無路徑時 warning（仍可存）。
- notes `TextInput`（≤300）→ `CreateWalkInput.notes`。
- **儲存** → `createWalk(...)`（用 stop() final state，score 走 shared-business）→ 首頁刷新；**捨棄** → 不存直接關。

### 2. 手動補登 dialog
- `components/walks/manual-walk-dialog.tsx`：選 pet（chip）+ 時長（必填）+ 距離（選填，空=0）+ notes → `createWalk({ isManual:true, path:undefined })`，score 走 `computeWalkScore`（含 live 預估分數）。
- `startedAt = now − 時長`、`endedAt = now`。入口：WalksHome「✍️ 手動補登」。

### 3. Recent「全部」當頁展開
- 預設顯示近 5 筆；`walks.length > 5` 時顯示「全部 / 顯示較少」toggle，**當頁**展開完整列表（對齊 web `d633d3d`，不另開頁）。

## 驗證了什麼
- ✅ `npm run typecheck -w @mango/ios`（tsc --noEmit）pass。
- ✅ change surface 僅 `apps/ios/**`；**未動** apps/web / packages/* / functions / rules / indexes / **package.json / lockfile**（git status 確認）→ **無新 dep**（confetti hand-rolled），不需 App Hosting / native gate；既有 dev build 可直接測。
- ⏳ **實機跑 done screen + 達標 confetti + 手動補登 + recent 展開：未跑**（Windows 無 simulator；屬 EAS/iPhone 步驟）。code path 完整：stop→done→save→createWalk→leaderboard；manual→isManual:true 落地。

## ⚠️ 刻意 P1b 取捨 / 已知限制
- **手動補登無 start/end 日期選擇**：web 有 datetime picker；iOS 需 `@react-native-community/datetimepicker`（新 native dep → branch+gate），P1b 改用「現在往回推時長」。明確日期補登 = follow-up（見下）。
- i18n 仍 **inline zh-TW**（shared-i18n 未建，沿用 P1a）。
- confetti 為自寫 Animated（功能/慶祝感優先）；更精緻的慶祝動效 = UI/UX。

## 🤝 Handoff
### → iOS PM
- P1b code 完成、tsc 過、無新 dep；**待 iPhone 驗收**（done 達標慶祝 + 捨棄/儲存 + 手動補登 isManual:true 落地 + recent 全部展開）。
- parity §A P1 可標進度：「**Done screen + confetti + 達標變體**」「**手動 walk dialog**」「**Walks history（recent 全部展開）**」三列 → code 到位，實機驗一趟後可標 ✅。
- 產品取捨待你定：手動補登要不要補 datetime picker（=新 dep）？目前用「往回推時長」。
  - **✅ iOS PM 決策（2026-06-01）：暫不做（defer）。** P1b 維持「往回推時長」，不加 `@react-native-community/datetimepicker`（省一個 native dep + gate）。理由：手動補登最常見 =「剛遛完忘了記」→ 往回推已 cover；「補登到指定某天」低頻 → 列 follow-up，有真實需求再 re-open（屆時走 branch+linux gate）。刻意 parity gap，已記錄。

### → iOS UI/UX
- done screen 慶祝 / confetti 視覺 polish（目前自寫 Animated，可換更細緻的慶祝、emerald wash 對齊 web、Trophy 圖示）。
- 達標 streak badge pop 動畫、reduced-motion 細節。

### → iOS Backend
- （沿用 P1a handoff）pure stat helpers（`getWeeklyAvgMinutes`/`estimatePetCalories`/`computeStreak`/今日週統計）web+iOS 各一份 → 建議收進 `@mango/shared-business`。
- 手動補登 datetime picker 若要做 = `@react-native-community/datetimepicker` 新 dep，走你的 branch+linux gate。

### 下一棒
- **P1c**：遛狗中拍照（≤5 + Storage 上傳，路徑用 `storage-paths.ts` walkPhotoPath）+ PhotoPromptSheet（start/end）+ 自動發動態（post 帶 walkId cross-link）。
- **shared-i18n**：P1a/P1b 都還 inline zh-TW；建議在 P1c（feed/post 文案變多）一起起 `@mango/shared-i18n`，把 Walks namespace（core/page/celebration/streak/photoPrompt）一次收斂，避免 zh-TW/en 雙份 drift。
