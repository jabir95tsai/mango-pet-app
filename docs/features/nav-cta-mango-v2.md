# 底部導覽列 + 「開始遛狗」CTA 新設計（Mango v2）

> **狀態**：READY-FOR-DEV — UI/UX spec（PM 2026-05-30 從 user 設計稿正式化）。
> **角色**：UI/UX 工程師（user 2026-05-30 指定）。**PM 不實作**，本檔為交付用 spec。
> **歸屬**：Epic 4 視覺重設計（芒果主題）follow-up — 取代 Phase 0.5 的「raised center walks tab」(`e1a7b60`) 升為 V2 凹槽凸起鈕。
> **設計稿來源（user 提供）**：`patches/app-nav.tsx`、`patches/walks-page.tsx`（mockup，UI/UX port 進真實檔）。

## 改動範圍（只動這兩處，不碰其他）

1. **底部導覽列**：`apps/web/src/components/nav/app-nav.tsx`（mobile bottom tab bar 部分；desktop sidebar 不動）。
2. **「開始遛狗」主按鈕**：`apps/web/src/app/app/walks/page.tsx` 的 Hero CTA（`/app/walks` = PWA `start_url` / 預設落地頁，即 user 口中「首頁」）。

> ⚠️ 沿用既有 5 tab 結構（`e34640a` 已 ship：首頁/我的寵物/遛狗/排行榜/設定），本次只換**視覺**，不改導航 IA / route / i18n key。

## 設計約束（全域）

- 沿用既有 mango token（定義於 `apps/web/src/app/globals.css`）：
  `brand #f39800`、`brandDeep #d77b00`、`amber #ffc25c`、`brandTint #ffe7bf`、`bg #fbf1dd`、`cardSoft #fff8e8`、`hairline #eadfc4`、`ink3 #9a8a74`。**用 CSS 變數，不要硬寫 hex**（除非既有寫法已硬寫）。
- 字體 SF Pro / PingFang TC；線條（outline）icon；**所有 tab 保留 icon + 文字標籤**。
- **尊重 `prefers-reduced-motion: reduce`**：關閉所有動畫（掃光、tab 切換動效、scale）。

---

## 1. 底部導覽列（V1 · 凹槽凸起鈕）

- 5 個 tab：**首頁 / 我的寵物 / 遛狗（中間）/ 排行榜 / 設定**。
- bar 底色 `cardSoft`、上緣 `1px hairline`、陰影 `0 -8px 22px rgba(80,50,10,.10)`。
- bar 頂緣中央切出平滑**凹槽（notch）**，讓中間「遛狗」圓鈕**嵌進凹槽、上緣凸出 bar 之上**（不是平貼外掛）。凹槽用 SVG path：
  ```
  M0,0 H{cx-52} C{cx-26},0 {cx-34},40 {cx},40 C{cx+34},40 {cx+26},0 {cx+52},0 H{W} V{barH} H0 Z
  ```
  - `cx` = bar 寬一半、`barH ≈ 78`、`W` = bar 寬；填色 `cardSoft`。
- **中間圓鈕**：直徑 62、圓形、漸層 `linear-gradient(160deg, brand, brandDeep)`、白色實心 paw icon、陰影 `0 10px 22px -5px rgba(243,152,0,.55)` 外加 `0 0 0 5px var(--bg)`（用 bg 色做出「切穿」bar 的描邊環）。
  - 下方標籤「遛狗」`brandDeep`、10.5px、700。
  - active 時 `scale(1.06)`。
- **其餘 4 tab**：icon 24px。
  - active = `brandDeep` + 標籤 700 + icon 上移 2px + 下方 5px 圓點（`brand`）。
  - inactive = `ink3` + 500。
  - 切換動畫 `.28s cubic-bezier(.34,1.56,.64,1)`。

---

## 2. 「開始遛狗」主按鈕（B · 光澤掃過，尾段減速）

- 全寬膠囊，高 62、圓角 31、漸層 `linear-gradient(160deg, amber, brand 50%, brandDeep)`、陰影 `0 12px 26px -8px rgba(243,152,0,.6)`。
- 左側白底半透明圓形 badge（40px、`rgba(255,255,255,.22)`）內含白色 ▶ play icon；右接白字「開始遛狗」（SFD 19px / 800 / letter-spacing .5）。
- 按壓回饋：`transform: scale(.97)`、`transition .18s cubic-bezier(.34,1.4,.64,1)`。
- **光澤掃過動畫**：按鈕 `overflow:hidden`，內放斜向亮帶 `width:82px; top:-12; bottom:-12; transform:skewX(-18deg); background:linear-gradient(90deg, transparent, rgba(255,255,255,.62), transparent)`。亮帶從按鈕左緣外側完整掃到右緣外側，接近尾端明顯減速，掃完停頓再循環：
  ```css
  @keyframes ctaSweepFull {
    0%   { left: -28%; animation-timing-function: cubic-bezier(.12,.72,.1,1); }
    52%  { left: 122%; }
    100% { left: 122%; }
  }
  /* 套用 */
  animation: ctaSweepFull 5.2s linear infinite;
  @media (prefers-reduced-motion: reduce){ animation: none; }
  ```

---

## 3. 我的寵物頁 4 個「＋」按鈕（FAB）統一橘色（user 2026-06-01）

**改動檔**：`apps/web/src/components/pets/pet-floating-add.tsx`（單一 tab-aware FAB 元件，4 tab 各一 TONE）。

**現況**：overview / reminders = 橘色漸層；**expenses = 桃橘**（#ee9a5a→#d77b3f）；**health = 綠色**（#79c074→#3f8a3a）。

**要求**：4 個 tab（概覽 / 提醒 / 開銷 / 健康）的＋按鈕**全部統一成「開始遛狗」CTA 的橘色**，**不要閃光/掃過動畫**。

- **漸層**：4 個 TONE 全改成與 §2 CTA 同一橘色漸層 `linear-gradient(160deg, var(--amber), var(--brand) 50%, var(--brandDeep))`（移除 health 綠、expenses 桃橘）。shadow 統一回 brand 橘色調 `0 16px 32px -8px rgba(243,152,0,.55) …`（把現有綠/桃橘的 rgba 換成橘）。
- **形狀不變**：維持圓形 FAB（size-14、rounded-full、右下角 fixed）— **不要變成全寬 pill**；「開始遛狗風格」此處指**橘色漸層 + 質感**，不是改形狀。
- **動畫**：**不加** §2 的 `ctaSweepFull` 閃光掃過。保留既有按壓 `active:scale-95` / hover scale + `motion-reduce` 既有處理即可。
- **＋ icon 顏色**：橘底上用**白色** Plus（確保 AA 對比；若現為 `text-mango-ink` 深色，改白）。
- **不變**：4 tab 各自的 `aria-label`（新增提醒 / 開銷 / 健康記錄…）、位置、點擊行為、tab 偵測邏輯都不動，只換顏色/陰影。

> ⚠️ 語意提醒：原本 health 用綠、expenses 用桃橘是「**用顏色區分 tab**」的設計（pets-v2）。統一成橘色後失去這個 tone-coding —— user 明確要求統一橘色，照做；若日後想回復 tab 色辨識，再開 follow-up。

---

## 驗收標準

- [ ] 光帶跑完整顆按鈕寬度、前快後慢、尾段滑出後停約 2 秒再來。
- [ ] 我的寵物頁 4 tab（概覽/提醒/開銷/健康）的＋按鈕**都是同一橘色漸層**，無綠 / 桃橘。
- [ ] 寵物頁＋按鈕**無閃光/掃過動畫**；按壓 scale 保留，reduce 模式無動態；＋ icon 在橘底達 AA 對比。
- [ ] 導覽列中間鈕嵌在凹槽內並凸出 bar 之上（非平貼外掛）。
- [ ] `prefers-reduced-motion: reduce` 下**完全無動態**（掃光 / tab 動效 / scale 全停）。
- [ ] 5 tab 全保留 icon + 文字標籤；active/inactive 態如上。
- [ ] 既有導航行為 / route / i18n 不變（純視覺換皮）。
- [ ] WCAG AA：文字/icon 對比達標；圓鈕 + CTA 有 aria-label / 可鍵盤聚焦。
- [ ] 響應式：各 mobile 寬度（含 notch 安全區 `env(safe-area-inset-bottom)`）凹槽與圓鈕對齊不破。
- [ ] desktop sidebar 不受影響。

## 不在範圍

- 改 5 tab 的順序 / route / 新增移除 tab。
- desktop sidebar 視覺。
- 改 walk tracking flow / 計時邏輯。
- 任何 functions / rules / schema。

## Handoff / 備註

- iOS 已有對應 `apps/ios/src/components/raised-tab-bar.tsx`（RN 版）— web 此次做的是 web/PWA 的凹槽版；兩邊視覺對齊但各自實作（不共用元件，token 共用）。
- UI/UX workflow：先 Chrome MCP 截 production baseline → 改 → 截 after（**bottom nav / walks 開始遛狗 CTA / 我的寵物頁 4 tab 的＋按鈕** 三處），驗 reduced-motion。
- §3（寵物頁＋按鈕統一橘色）可與 §1/§2 同一 UI/UX session 一次做完（同 mango-v2 視覺語言）。
