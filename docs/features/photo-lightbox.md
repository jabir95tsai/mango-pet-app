# Photo Lightbox — feed + walks 點圖放大預覽

狀態：**GO**（user 2026-05-25 早上 3 個 decisions confirmed）
建立日期：2026-05-25
最後更新：2026-05-25
規格作者：PM session @ `991432f`
角色：**UI/UX**（整 stack — 新元件 + 接入 feed + walks + i18n + 自驗 + commit + ship）
工作量：**S-M**

## User Vision（原話保留）

> 「增加動態的照片的預覽功能，類似點一下可以放大預覽」

## 3 個 product decisions（confirmed）

| # | Decision | Final | 註 |
|---|---|---|---|
| **D1** ✅ | Scope | **feed + walks**（餐廳 backlog 後續迭代） | 1 個 reusable 元件接 2 處 |
| **D2** ✅ | 多照片 UX | **Carousel swipe + dots indicator** | 同 post / 同 walk 多照片可左右滑 |
| **D3** ✅ | 關閉方式 | **點背景 + X 按鈕 + swipe-down 三招都有** | mobile gallery 標準 UX |

## 完成標準

### 新元件

- [ ] `src/components/ui/photo-lightbox.tsx`（新檔，shared reusable）：
  - Props: `photos: string[]`, `initialIdx: number`, `open: boolean`, `onClose: () => void`
  - Full-screen overlay (Portal to `document.body`，z-index 高於 nav + tracking-view)
  - 背景 `bg-black/90`（深色聚焦圖片本身）
  - 當前圖：next/image fit-screen（保持比例，不裁切）
  - 多照片時 (length > 1)：
    - 左右 swipe（touch event）→ prev/next，含 transition (300ms ease)
    - 底部 dots indicator（current = `mango.brand` 圓點 / others = `mango.ink-3` 小圓點）
    - 桌面也支援滑鼠 drag（mousedown/mousemove/mouseup）
  - 關閉三招：
    - 點背景（image 外的暗區）→ close
    - 右上 X 按鈕（44×44 hit area，`mango.ink` icon on `bg-black/40` round bg）
    - swipe-down 距離 > 100px → close（圖跟手指 translate + opacity fade-down）
  - Keyboard：Escape → close / ArrowLeft → prev / ArrowRight → next
  - Accessibility：`role="dialog"` + `aria-modal="true"` + `aria-label` + focus trap + restore focus on close
  - `prefers-reduced-motion`：swipe transition 縮短到 100ms 或停用 fade

### 接入

- [ ] `src/components/feed/post-card.tsx`：photo grid 每張 photo 包 button 加 onClick → 開 lightbox（傳 `post.photoURLs` + 該 index）
- [ ] `src/components/walks/walk-row.tsx`：若已渲染 photo thumbnail，加同樣 onClick handler；如還沒有（目前 walk-row 主要顯示 icon/距離/時間），UI/UX 看 walks-v2 spec 是否需要在 row 加 photo thumbnail icon
- [ ] `src/components/walks/walk-tracking-view.tsx`：done screen 顯示 photo 時（既有 walks-v2 photo capture flow）也接，UI/UX 只加 onClick handler，**不重排 done screen 結構**

### i18n

- [ ] `messages/zh-TW.json` + `messages/en.json` 新 keys：
  - `PhotoLightbox.close`（「關閉」/「Close」）
  - `PhotoLightbox.prev`（「上一張」/「Previous」）
  - `PhotoLightbox.next`（「下一張」/「Next」）
  - `PhotoLightbox.counter`（「{current} / {total}」）

### 護欄

- [ ] 不動既有 photo upload / Firebase Storage / Firestore 邏輯
- [ ] 不動 walks-v2 done screen 結構（只加 onClick handler，不動 layout / 元件樹）
- [ ] 不動 walks-v2 confetti / emerald celebration（保留）
- [ ] 不動 mango tokens（`globals.css`）
- [ ] 不引入新 image / gallery library（只用 next/image + 原生 touch event）
- [ ] swipe detection 自寫（touchstart/move/end 算 dx/dy），不用 swiper.js / framer-motion

### 預驗收 checklist

- [ ] `npx tsc --noEmit` pass
- [ ] Chrome MCP iPhone (`/app/feed`)：
  - [ ] post 1 photo 點 → lightbox 開 + X 按鈕關
  - [ ] post 多 photo 點任一張 → lightbox 開且 initialIdx 對的 + 左右 swipe + dots 正確
  - [ ] swipe-down 距離大 → 關 + fade-down 動畫
  - [ ] 點背景暗區 → 關
- [ ] Chrome MCP iPhone (`/app/walks`)：
  - [ ] recent walks 內有 photo 的 row 點 → lightbox 開
  - [ ] 結束遛狗 → done screen photo 點 → lightbox 開（不破 confetti / emerald celebration）
- [ ] Chrome MCP desktop：左右滑鼠 drag = swipe，X / 背景 click 都關
- [ ] `prefers-reduced-motion` 用戶：swipe transition stop（圖直接切，不漸變）
- [ ] Keyboard a11y：Escape / 左右箭頭 都對
- [ ] Lighthouse a11y on `/app/feed` ≥ 90（不掉）
- [ ] commit message: `feat(ui): photo lightbox — feed + walks 點圖放大預覽`
- [ ] Push to main → App Hosting auto-deploy → 5-8 min 後 user 在 production 驗收

## 不在範圍

- **餐廳照片預覽**（restaurants page — backlog，等本 spec ship 後加 follow-up）
- **Pinch zoom**（瀏覽器 native zoom 即可，不自寫）
- Photo download / share button
- Edit / delete photo from lightbox（仍走原本 post / walk edit flow）
- Multi-photo at same time（grid 模式）— 只做 carousel
- 全螢幕 immersive mode（hide browser status bar）— 不複雜化
- AI image enhance / filter

## Edge cases

| Case | 處理 |
|---|---|
| 0 photos | Skip — 不接 onClick（photoURLs.length === 0 不渲染）|
| 1 photo | Lightbox 開，但隱藏左右 swipe gesture + dots indicator + counter |
| Photo URL load fail | Show fallback「照片載入失敗」icon + 「重試」button；X 按鈕仍可關 |
| User 開 lightbox 後 navigate 到其他頁 | `useEffect` cleanup 自動 close（unmount onClose）|
| Swipe-down 但水平偏移大 (|dx| > |dy|) | 判斷為 horizontal swipe（carousel），不觸發 close |
| Swipe-down 但水平偏移小且 dy 不夠 | 算「未達 threshold」→ 圖回彈原位 |
| 第一張 swipe right / 最後一張 swipe left | 不動（不 wrap-around；或 wrap-around — UI/UX 自選）|
| Reduced motion user 多照片 swipe | 圖直接切，不 transition |
| Done screen photo lightbox 開時 confetti 仍跑 | OK，confetti zIndex 低於 lightbox |

## 跟其他 spec 的關聯

- **walks-v2-rebuild.md (Phase 1 v2)**：本 spec 接 walk-row 與 walk-tracking-view done screen，但 **不動既有結構** — 只加 onClick handler
- **既有 feed system**：本 spec 不動 post-card photo grid layout / next/image 使用方式 — 只加 onClick wrapper
- **未來 restaurants page photo**：本 spec PhotoLightbox 元件設計時要 reusable，未來接 restaurant-card 只需加 onClick handler 即可
- **engagement-push-notifications.md (Epic 5)**：無關聯
- **Epic 4 Phase 2 pets prototype**：無關聯（pets page avatar 太小，不需 lightbox；後續若 pets detail 健康 tab 有照片紀錄再考慮）

## PM 觀察

**Workflow 建議走 UI/UX 直接寫 src/**（同 Phase 1 v2 模式）：
- 標準 mobile gallery UX，設計探索空間小 → 不需 prototype-first
- 元件邊界清楚 + 接入點只 3 個檔 → 1 個 session 內可完成
- 工作量 S-M（PhotoLightbox 元件 + 3 處接入 + i18n + 自驗）

預估 commit 拆解：
1. `feat(ui): photo-lightbox 元件（含 carousel + swipe + 三招關閉 + a11y）`
2. `feat(feed): post-card 接 photo-lightbox onClick`
3. `feat(walks): walk-row / walk-tracking-view done screen 接 photo-lightbox`
4. `chore(i18n): PhotoLightbox.* keys (zh-TW + en)`

（或一個 commit 全收，UI/UX 自選）

## UI/UX launch prompt（user 開 UI/UX session copy 用）

```
本 session 固定角色：UI/UX — 寫 PhotoLightbox 元件 + 接 feed + walks 點圖放大。
Repo: C:\Users\jabir\Hacker_J\mango_pet_app

⚠️ 必讀
- Spec: docs/features/photo-lightbox.md（PM 寫好，含完成標準 + 護欄 + edge cases + i18n keys）
- 既有 photo 渲染位置：
  - src/components/feed/post-card.tsx（line 66+：photoURLs grid）
  - src/components/walks/walk-row.tsx（看是否已渲染 photo thumbnail）
  - src/components/walks/walk-tracking-view.tsx（done screen photo）
- mango palette: src/app/globals.css 的 @theme inline
- 必讀 AGENTS.md：Next.js 16 + Tailwind v4

護欄
- 動 src/components/ui/photo-lightbox.tsx（新檔）OK
- 動 src/components/feed/post-card.tsx + src/components/walks/walk-row.tsx OK
- 動 src/components/walks/walk-tracking-view.tsx 加 onClick handler OK，但不重排 done screen
- 動 messages/zh-TW.json + messages/en.json 加 PhotoLightbox.* keys OK
- 不動 photo upload / Firebase Storage / Firestore 邏輯
- 不動 walks v2 confetti / emerald celebration（保留 zIndex 低於 lightbox）
- 不動 mango tokens
- 不引入新 image library（只用 next/image + 原生 touch event + 自寫 swipe detection）

實作建議
1. PhotoLightbox 元件 — Portal to document.body，z-index 99（高於 nav 50 + tracking-view 60）
2. State：currentIdx + isOpen + touchStart {x,y} + touchDelta {x,y}
3. Touch handler：
   - touchstart 記座標
   - touchmove 算 dx, dy；若 |dy| > |dx| → vertical swipe (preview close fade)；若 |dx| > |dy| → horizontal (preview carousel translate)
   - touchend：水平 |dx| > 50 → next/prev；垂直 dy > 100 → close
4. Mouse 模擬：mousedown/move/up 同邏輯（desktop drag）
5. Keyboard：useEffect 加 keydown listener Escape/ArrowLeft/ArrowRight
6. Accessibility：focus trap 用 useEffect + first/last focusable element listener
7. 接入點：3 個檔加 useState + 包 photo 用 button + onClick={() => setLightbox({open: true, photos, initialIdx})}

預驗收（spec 內 checklist 跑完）
- npx tsc --noEmit pass
- dev server 跑 Chrome MCP 驗 feed 1 photo / 多 photo + walks recent / walks done screen
- reduced-motion 用 dev tools 模擬 → 確認 swipe transition stop
- keyboard a11y：Escape / ←→ 都對
- Lighthouse a11y 不掉

commit 拆解（建議，自選）
1. feat(ui): photo-lightbox 元件（含 carousel + swipe + 三招關閉 + a11y）
2. feat(feed): post-card 接 photo-lightbox onClick
3. feat(walks): walk-row / walk-tracking-view done screen 接 photo-lightbox
4. chore(i18n): PhotoLightbox.* keys (zh-TW + en)

回報格式
- 每 commit hash + 1 行 review note
- 全部 ship 後最終 summary 給 PM 收尾 roadmap（標 SHIPPED + commit hash 們 + 驗收結果）

開工。
```
