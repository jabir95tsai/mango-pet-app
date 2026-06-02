# 達標彩帶特效升級（Confetti Engine）

> **狀態**：READY-FOR-DEV — UI/UX spec（PM 2026-06-02，從 user Claude Design 稿正式化）。
> **角色**：UI/UX（前端視覺替換，無後端 / 無 schema）。PM 不實作。
> **設計來源**：user Claude Design 稿 —
> - 打包版：`C:\Users\jabir\Downloads\Mango 達標彩帶特效 (打包).html`（bundler 打包、JS minified，視覺最終版）。
> - 可讀源碼（同一 design bundle，向 user 取 design URL → fetch → gunzip→tar 展開）：`mango-pet/project/confetti-engine.jsx`（canvas 引擎，**這是主要參考**）+ `confetti-engine` 的 `Mango 達標彩帶特效.html` harness + **`chats/`（看 user 最後選了哪個效果）**。

## 目標

把**現有達標彩帶**換成新設計的 canvas 彩帶引擎。

- **現有（要換掉）**：`apps/web/src/components/walks/walks-confetti-decor.tsx`（`WalksConfettiDecor`）—— CSS-based、20 片直落 sliver + 720° 旋轉，遛狗達標時由 `walks/page.tsx` 的 `showConfetti` 觸發、4 秒自動隱藏。對應新引擎的 `legacy` 效果（effect 0），即「舊版」。
- **新（要採用）**：`confetti-engine.jsx` 的 `window.ConfettiCanvas` —— 單一 `<canvas>` overlay、rAF 粒子系統，含 5 種具名效果（`legacy` / `paper` / …）。比舊版精緻：頂部簾幕、紙片飄動 + 3D 翻卡、緞帶 streamer、品牌 glyph（🐾🦴🥭🐶）、芒果色票（`PARTY` / `LEAVES` / `GLOW`）。
  - ⚠️ **最終採用哪個效果由 user 拍板**：實作前讀 `chats/` 確認 user 在 5 個效果裡選了哪個（截圖檔名有 cannons / midair / coin 等線索）；若不明確 → 問 user。PM 預設傾向 `paper`（最通用的精緻紙花），但**不替 user 定**。

## 範圍 / 要求

- 重寫 `walks-confetti-decor.tsx`（或新增 canvas 元件取代它）：像素級對齊選定效果；React 重寫，不照抄 prototype 的 `window.*` 掛載方式。
- **保留現有觸發契約不變**：`walks/page.tsx` 的 `showConfetti`（goal-hit 觸發、4 秒 auto-hide、useEffect 位置在 0-pet early-return 之上 — 別動，那是 React #300 修復點 `ad90acf`）。元件 API 維持 `<WalksConfettiDecor />` 即插即用，或同等。
- **reduced-motion**：`prefers-reduced-motion: reduce` → 渲染**單張靜態 settled scatter**（引擎已內建此降級），不跑動畫迴圈。
- 色票用既有 mango token（globals.css / shared-tokens），不硬寫 legacy 的 `#f59e0b` 等舊色。
- 效能：canvas overlay `pointer-events:none`、達標後短暫播放即停（沿用 4 秒）、卸載時清 rAF。

## ⭐ 整併建議（跨 feature）

徽章解鎖慶祝 [`achievements-badges.md` §H] 也要 confetti。**建議兩處共用同一個 canvas 引擎元件**（walk 達標 + 徽章解鎖），避免兩套 confetti 各寫一份。UI/UX 做這個引擎時就抽成可重用元件（吃 props：效果名 / 色票 / 播放 token），§H 直接複用。

## 不在範圍

- 後端 / schema / functions（純前端視覺）。
- 改達標的觸發邏輯 / 計時 / walks 頁其他行為。
- home-empty-state 的裝飾性 confetti（不同用途，不動）。

## Handoff

- **→ UI/UX**：讀設計稿（打包版 + confetti-engine.jsx + chats 確認選定效果）→ React 重寫取代 `WalksConfettiDecor`，保留 `showConfetti` 觸發契約 + reduced-motion 靜態降級 + mango token；抽成可重用 canvas 元件供徽章 §H 複用。Chrome MCP 驗：遛狗達標 → 新彩帶播放 4 秒 → 自動消失；reduced-motion 為靜態。
- **→ PM**：若 user 未在 chats 明示選定效果 → 回 user 確認後再升 spec。
