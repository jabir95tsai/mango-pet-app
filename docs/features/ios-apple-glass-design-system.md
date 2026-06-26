# iOS Apple Glass 設計系統（mango liquid glass）

狀態：**READY-FOR-DEV**（iOS PM 2026-06-03）
規格作者：iOS PM session
角色執行：**iOS Backend**（expo-blur dep + gate）+ **iOS UI/UX**（glass 系統 + 套各 surface）
配合：[`ios-uiux-polish-pass.md`](./ios-uiux-polish-pass.md)、[`ios-uiux-fidelity-gaps.md`](./ios-uiux-fidelity-gaps.md)、[`visual-redesign-mango.md`](./visual-redesign-mango.md)

> user 2026-06-03：「以 PWA 畫面為參考，設計一個 Apple Glass 風格的 UI/UX。」

## 🎯 方向 + 與 PWA 的關係
- **PWA = 骨架參考**：沿用 PWA 的版面 / 資訊架構 / 內容順序（哪些卡、哪些 tab、放哪）。
- **Apple Glass = 表面材質**：把卡片/導覽/sheet 換成 iOS 半透明玻璃（毛玻璃 + 景深 + 微光邊 + 連續圓角）。
- ⚠️ **取代先前「iOS 99% 像素對齊 PWA」**：iOS 現在**刻意**跟 PWA 視覺不同（玻璃感）；fidelity-gaps 的 layout/IA 對齊仍有效，但「像素級樣式一致」作廢。
- 務實範圍：做**可 ship 的 glassmorphism**（`expo-blur` BlurView + mango-tinted 半透明面 + 微光邊 + 柔和景深），**不追** iOS 26 私有 Liquid Glass API（RN/Expo 尚未完整支援）。

## 🧱 材質系統（tokens → `theme.ts` glass 區）
- **底層 canvas**：暖 mango 漸層背景（cream `#FFF7EC` → soft amber tint）——玻璃要有東西可透才有質感（純白底玻璃看不出來）。`expo-linear-gradient`（已裝）。
- **Glass 面（3 級）**：
  - `glass.thin`（nav / chip）：BlurView intensity ~20–30 + 白 8–12% tint
  - `glass.regular`（卡片）：intensity ~40–50 + 白/mango 14–18% tint
  - `glass.thick`（sheet / modal）：intensity ~60–80 + 18–24% tint
- **微光邊**：1px hairline 上緣淺色高光（rgba 白 ~35%）+ 整圈 0.5px 細邊（白 ~15%）→ 玻璃「立體感」的關鍵。
- **景深**：頁面漸層（底）→ 浮起 glass 卡（中）→ glass nav/sheet（上）。**最多 2–3 層**，別層層疊玻璃。
- **陰影**：柔、低、**mango-tinted**（暖棕 + 低透明）做漂浮感，非黑硬陰影。
- **圓角**：連續大圓角（卡 ~20–28、pill = full）。
- **vibrancy**：玻璃上的文字/icon 用足夠對比色（深棕 ink），不是半透明灰（在照片上會看不清）。

## 🧩 元件（apps/ios/src/components/ui/ glass 版）
glass 化既有 primitives（沿用 fidelity 的 `@/components/ui`）：
- `GlassCard`（取代/擴充 Card）、`GlassNavBar`（底部 raised-disc nav 玻璃化）、`GlassTopBar`、`GlassPill`/`Chip`、`GlassSheet`（表單 modal）、`GlassFab`。
- raised center disc（遛狗）→ 玻璃 + mango 漸層核心，浮在 glass nav 之上。

## ♿ a11y（必做，否則被拒/難用）
- **Reduce Transparency**（iOS 設定）→ `AccessibilityInfo.isReduceTransparencyEnabled` 為真 → **全部退成實心 mango 面**（no blur），維持對比。**這是硬需求**。
- **Reduce Motion** → 不做玻璃視差/動態折射（沿用既有 `useReducedMotion`）。
- **對比 WCAG AA**：玻璃上文字在「最糟背景」（feed 大圖）下仍要可讀 → tint 夠厚 + 深 ink 文字 + 必要時文字底加 scrim。

## ⚡ 效能
- BlurView 多了會卡：**長列表 row 不要每列真 blur** → 列表用半透明實色面（fallback），真 blur 留給 **nav / sheet / hero / 少量卡**。
- 同畫面同時 BlurView 數量克制；scroll 時若 jank → 降級該區為半透明實色。

## 🔌 dep
- **`expo-blur`**（BlurView）——RN 沒有原生 backdrop blur，必須這個。**新 native dep → branch + linux web gate（規則 4）**。
- `expo-linear-gradient` 已裝（背景漸層）。

## 🗺 落地順序（先驗一個 hero 再鋪）
1. **Backend**：加 `expo-blur` + gate + 發新 dev-client（含 blur native）。
2. **UI/UX P-glass-0**：glass tokens（theme.ts）+ glass primitives（GlassCard/Nav/Sheet/Pill/Fab）+ reduce-transparency fallback + mango 漸層背景。
3. **UI/UX P-glass-1（hero 驗證）**：先只做**遛狗頁**改 glass（dial 玻璃環 + glass week strip + glass nav）→ **user 用 dev-client 在 iPhone 看真玻璃** → 對方向 / 效能 / a11y。
4. **過了 → 鋪全 surface**（home/feed、pets、leaderboard、settings）。feed 因有大圖,特別測玻璃 + scrim 可讀性。

## ✅ 驗收（規則 5 批次，但 hero 先給 user 看一次）
- glass 材質一致（3 級 + 微光邊 + 景深）;mango 漸層底;連續圓角。
- Reduce Transparency → 實心 fallback 正常;Reduce Motion 尊重;AA 對比過（含 feed 大圖）。
- 效能順（長列表不卡）。
- 先 hero（遛狗）dev-client 驗 → 全 surface 收齊 → 末端 EAS build 總驗。

## 🚫 不做
- 不追 iOS 26 私有 Liquid Glass API。
- 不為玻璃犧牲可讀性 / 效能 / a11y（三者優先於酷炫）。
- 不改 feature flow / 資料層。
