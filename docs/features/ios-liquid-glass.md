# iOS Liquid Glass（iOS 26 原生玻璃）+ Expo SDK 57 升級

狀態：**已整合 main、建置驗證通過 — 待 dev-client 真機驗**（2026-11-14；程式碼基準 `9287947`）
取代：[`ios-apple-glass-design-system.md`](./ios-apple-glass-design-system.md)（2026-06 的 expo-blur 毛玻璃方案；當時「不追 iOS 26 Liquid Glass API」，現在 Expo 已原生支援，改用原生）

> user 2026-10-10：「我要升級並套用」— 決定：Expo 直接升到 SDK 57、先把 fidelity 分支併進 main、這次只做 iOS（Web 之後）、玻璃只用在導覽層。

## 範圍與原則

- **只用在浮在內容上方的導覽層**（Apple HIG Materials / WWDC25「Meet Liquid Glass」）。包含 **底部 tab bar**；頁內切換鏡片是 2026-10-11 明訂的額外例外（見下）。卡片、列表、頁首（RouteHeader / HomeTopBar 都在捲動內容裡，不是浮層）維持實心 mango。
- 用原生 `expo-glass-effect`（`GlassView` / `GlassContainer`，底層 UIKit `UIGlassEffect`），**不是** blur 模擬。
- 底部為五個等寬分頁，遛狗使用 Footprints 圖示；中央凸起圓鈕只保留在 iOS < 26 的經典凹口導覽。頁面主鈕仍遵守 design-system §4。

## 2026-10-11 更新：玻璃鏡片 tab bar（取代中央圓鈕）

user 要 LINE（iOS 26）那種底部列：5 格平均（圖示＋文字，遛狗改 Footprints 圖示），選中格是品牌淡橘膠囊；**按住 → 鼓成透明玻璃泡泡凸出膠囊、拖曳時跟手＋依速度果凍拉伸＋經過的圖示放大、放開 spring 回彈並切頁**。設計稿：claude.ai Design 畫布「Floating Tab Bar」。
- 檔案：`apps/ios/src/components/liquid-glass-tab-bar.tsx`（RNGH Pan `minDistance(0)` + Reanimated 4）；`raised-tab-bar.tsx` 在 `LIQUID_GLASS` 時改交給它，iOS < 26 凹口 bar 不變。
- `GLASS_DISC_RISE`(18) → `GLASS_LENS_BULGE`(10)：玻璃模式不再有圓鈕，只保留鏡片鼓起的空間。
- Reduce Motion：不鼓起、不拉伸、不放大，直接跳格。VoiceOver 仍走各 tab 的 onPress。
- 2026-11-14：typed-routes 兩處錯誤已修復；Web／iOS typecheck 與兩平台 Metro export 通過。快速點擊改以放開座標選取，取消拖曳回到目前選項；8 項手勢回歸測試通過。**尚未完成本版真機驗收**。

- **擴大到頁內切換**（同日）：新增 `apps/ios/src/components/ui/LensTrack.tsx`（可變寬 segment，依 onLayout 量測；Pan `activeOffsetX ±8` + `failOffsetY ±12`，所以外層 ScrollView 照常上下捲；點一下仍走 Pressable）。`ui/Tabs`、`leaderboard/segmented.tsx`（改成包 `ui/Tabs`，a11y role 由 button → tab）、`pets/pet-tabs.tsx` 都改用它。底維持實心，按住才變玻璃；鼓起 1.12 倍、文字放大 0.12（比底部列收斂）。

## 實作

| 檔案 | 內容 |
|---|---|
| `apps/ios/src/lib/liquid-glass.ts` | `LIQUID_GLASS`（`isGlassEffectAPIAvailable() && isLiquidGlassAvailable()`，try/catch；原生 iOS 與獨立 web 預覽）、浮動 bar 幾何、`useTabBarOverlap()`、`useTabBarScrollInsets()` |
| `apps/ios/src/components/raised-tab-bar.tsx`、`liquid-glass-tab-bar.tsx` | `LIQUID_GLASS` 時呈現五格浮動玻璃膠囊與可拖曳鏡片；否則保留經典凹口實心 bar。`GLASS_LENS_BULGE` 預留按壓鼓起空間。 |
| `app/(tabs)/{index,pets,walks,settings}.tsx`、`leaderboard/board-list.tsx` | 玻璃模式下 bar 疊在畫面上（玻璃要有內容在後面才有折射），所以每個 tab 的 ScrollView/FlatList 加 `contentInset`/`scrollIndicatorInsets` = overlap；寵物頁 FAB、遛狗頁開始 CTA 的 `bottom` + overlap。經典模式 overlap = 0，畫面零變化。 |

## a11y / motion（design-system §5–§6）

- **減少透明度 / 增加對比**：原生材質交由 `UIGlassEffect` 處理，實際呈現仍列入真機驗收。舊 `expo-blur` 的 JS 透明度 hook 未採用。
- **減少動態效果**：底部與頁內鏡片已有 Reanimated 自訂動效，使用 `useReducedMotion` 停用鼓起、拉伸、放大與 spring，直接跳格。不可把「原生材質處理」誤當成自訂動畫不需降級。
- tablist / tab role、selected state、label 都沿用原本實作（VoiceOver 不變）。

## Expo 52 → 57 升級紀錄（`1843975`，已整合）

- RN 0.76 → 0.86.3、React 18 → 19.2.3、Reanimated 4.5 + worklets、expo-router 57（已不依賴 React Navigation；本專案沒有直接 import，不受影響）。
- **RN Firebase 21 → 25.1**（刻意停在 25：v26 移除 namespaced API，iOS 約 25 檔都在用）。⚠️ v25 的 `DocumentSnapshot.exists` 在 runtime 是**方法**：14 處 `snap.exists` 全改 `snap.exists()`（TS 只抓到 4 處；`!snap.exists` 會靜默永遠為 false）。測試 mock 同步。namespaced deprecation 警告由 `src/lib/rnfb-setup.ts` 靜音。
- config：拿掉 `newArchEnabled`、splash 改 `expo-splash-screen` plugin、babel 不再手列 reanimated plugin、metro 用預設 monorepo config、`@expo/config-plugins` 直接列 devDep（RNFB config plugin 在 npm workspaces 下才找得到）。
- lockfile：清掉舊的 RN 0.76 / React 18 root 項目讓 RN/expo/React 一起 hoist；**firebase 維持 12.13.0、apps/web 的 lock 項目零變動**。

## 最新驗證（2026-11-14）

- Web／iOS typecheck、36 項單元測試（含 8 項手勢測試）、iOS／web Metro export 皆通過。
- Linux App Hosting gate `review-20261114-ced740c` 為 `READY`；main 的 `rollout-2026-11-14-002` 為 `SUCCEEDED`，首頁 HTTP 200。
- 本節證明程式碼與建置狀態，不代表 EAS 原生 binary 或 iPhone 互動已驗收。

## SDK 升級時的歷史驗證（2026-10-10，Windows）

- ✅ iOS `tsc --noEmit`、`expo-doctor`（只剩預期中的 `@expo/config-plugins` 提示）、`node --test apps/ios/scripts/auth-push.test.cjs` 28/28、`expo export --platform ios` 打包成功。
- ✅ Web `tsc` + `next build` 通過（web lint 在 main 上就壞：缺 `next/dist/compiled/babel/eslint-parser`，與本次無關）。
- ❌ **尚未 native build、尚未上真機**（Windows 無 Xcode；需 EAS）。

## 待 user（dev-client 真機）

1. 新 native 套件很多（RN 0.86、RNFB 25、expo-glass-effect）→ **一定要重出 dev-client**：`eas build --profile dev-device --platform ios`（EAS 用 SDK 57 預設 Xcode）。
2. iOS 26 手機：確認底部五格玻璃膠囊、快速點擊、拖曳與取消回復；捲到最底，最後一張卡要能完整露出在 bar 上方；寵物頁 FAB、遛狗 CTA 不被擋。
3. 設定 → 輔助使用 → 減少透明度／增加對比：確認文字可讀；減少動態效果：底部與頁內鏡片無鼓起、拉伸、放大或 spring。
4. 回歸冒煙：登入（Google / Apple / 訪客）、推播註冊、加好友（`exists()` 改動處）、家庭切換、按讚、遛狗開始→結束→存檔、相片存相簿、資料匯出（expo-file-system/legacy）。
5. 若手邊只有 iOS < 26：會看到原本的凹口 bar（預期行為）。

## 後續（已記 backlog）

- RN Firebase v26：改 modular API（`getFirestore()` 等）後才能再升。
- Web 版 Liquid Glass（毛玻璃 + Chromium SVG 折射漸進增強）。
- 其他浮層候選：寵物頁 sticky tabs、表單 sheet（expo-router form sheet 在 iOS 26 會自動玻璃化，但本專案的 `Sheet` 是自製 Modal）。
