# iOS Liquid Glass（iOS 26 原生玻璃）+ Expo SDK 57 升級

狀態：**CODE DONE — 待 dev-client 真機驗**（UI/UX session 2026-10-10，branch `ios-expo-57-liquid-glass`）
取代：[`ios-apple-glass-design-system.md`](./ios-apple-glass-design-system.md)（2026-06 的 expo-blur 毛玻璃方案；當時「不追 iOS 26 Liquid Glass API」，現在 Expo 已原生支援，改用原生）

> user 2026-10-10：「我要升級並套用」— 決定：Expo 直接升到 SDK 57、先把 fidelity 分支併進 main、這次只做 iOS（Web 之後）、玻璃只用在導覽層。

## 範圍與原則

- **只用在浮在內容上方的導覽層**（Apple HIG Materials / WWDC25「Meet Liquid Glass」）。目前 = **底部 tab bar**。卡片、列表、頁首（RouteHeader / HomeTopBar 都在捲動內容裡，不是浮層）維持實心 mango。
- 用原生 `expo-glass-effect`（`GlassView` / `GlassContainer`，底層 UIKit `UIGlassEffect`），**不是** blur 模擬。
- 品牌不變：中央遛狗圓鈕仍是 brand→brandDeep 漸層 + 白色腳印（design-system §4 主鈕）。

## 實作

| 檔案 | 內容 |
|---|---|
| `apps/ios/src/lib/liquid-glass.ts` | `LIQUID_GLASS`（`isGlassEffectAPIAvailable() && isLiquidGlassAvailable()`，iOS only，try/catch）、浮動 bar 幾何、`useTabBarOverlap()`、`useTabBarScrollInsets()` |
| `apps/ios/src/components/raised-tab-bar.tsx` | `LIQUID_GLASS` → 浮動玻璃膠囊（左右各內縮 16、高 64、底部落在 home indicator 區）＋ 圓鈕外圈 66pt 玻璃環；兩塊玻璃包在同一個 `GlassContainer spacing=14`，**環與膠囊會融成一個液態形狀**。否則 → 原本跟 PWA 1:1 的凹口實心 bar（完全不變）。 |
| `app/(tabs)/{index,pets,walks,settings}.tsx`、`leaderboard/board-list.tsx` | 玻璃模式下 bar 疊在畫面上（玻璃要有內容在後面才有折射），所以每個 tab 的 ScrollView/FlatList 加 `contentInset`/`scrollIndicatorInsets` = overlap；寵物頁 FAB、遛狗頁開始 CTA 的 `bottom` + overlap。經典模式 overlap = 0，畫面零變化。 |

## a11y / motion（design-system §5–§6）

- **減少透明度 / 增加對比 / 減少動態效果**：原生 `UIGlassEffect` 自己處理（減少透明度 → 變霧面不透明；減少動態 → 不做互動光澤）。所以不需要 JS 端 fallback，也沒有自訂動畫。
- tablist / tab role、selected state、label 都沿用原本實作（VoiceOver 不變）。

## Expo 52 → 57 升級重點（同一分支，第一個 commit）

- RN 0.76 → 0.86.3、React 18 → 19.2.3、Reanimated 4.5 + worklets、expo-router 57（已不依賴 React Navigation；本專案沒有直接 import，不受影響）。
- **RN Firebase 21 → 25.1**（刻意停在 25：v26 移除 namespaced API，iOS 約 25 檔都在用）。⚠️ v25 的 `DocumentSnapshot.exists` 在 runtime 是**方法**：14 處 `snap.exists` 全改 `snap.exists()`（TS 只抓到 4 處；`!snap.exists` 會靜默永遠為 false）。測試 mock 同步。namespaced deprecation 警告由 `src/lib/rnfb-setup.ts` 靜音。
- config：拿掉 `newArchEnabled`、splash 改 `expo-splash-screen` plugin、babel 不再手列 reanimated plugin、metro 用預設 monorepo config、`@expo/config-plugins` 直接列 devDep（RNFB config plugin 在 npm workspaces 下才找得到）。
- lockfile：清掉舊的 RN 0.76 / React 18 root 項目讓 RN/expo/React 一起 hoist；**firebase 維持 12.13.0、apps/web 的 lock 項目零變動**。

## 驗證（2026-10-10，Windows）

- ✅ iOS `tsc --noEmit`、`expo-doctor`（只剩預期中的 `@expo/config-plugins` 提示）、`node --test apps/ios/scripts/auth-push.test.cjs` 28/28、`expo export --platform ios` 打包成功。
- ✅ Web `tsc` + `next build` 通過（web lint 在 main 上就壞：缺 `next/dist/compiled/babel/eslint-parser`，與本次無關）。
- ❌ **尚未 native build、尚未上真機**（Windows 無 Xcode；需 EAS）。

## 待 user（dev-client 真機）

1. 新 native 套件很多（RN 0.86、RNFB 25、expo-glass-effect）→ **一定要重出 dev-client**：`eas build --profile dev-device --platform ios`（EAS 用 SDK 57 預設 Xcode）。
2. iOS 26 手機：看底部玻璃膠囊 + 圓鈕融合效果；捲到最底，最後一張卡要能完整露出在 bar 上方；寵物頁 FAB、遛狗 CTA 不被擋。
3. 設定 → 輔助使用 → 減少透明度：玻璃應變霧面、文字可讀。
4. 回歸冒煙：登入（Google / Apple / 訪客）、推播註冊、加好友（`exists()` 改動處）、家庭切換、按讚、遛狗開始→結束→存檔、相片存相簿、資料匯出（expo-file-system/legacy）。
5. 若手邊只有 iOS < 26：會看到原本的凹口 bar（預期行為）。

## 後續（已記 backlog）

- RN Firebase v26：改 modular API（`getFirestore()` 等）後才能再升。
- Web 版 Liquid Glass（毛玻璃 + Chromium SVG 折射漸進增強）。
- 其他浮層候選：寵物頁 sticky tabs、表單 sheet（expo-router form sheet 在 iOS 26 會自動玻璃化，但本專案的 `Sheet` 是自製 Modal）。
