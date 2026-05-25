# Mango Pet Roadmap

> PM 角色維護。其他角色想動這個檔案先停手，把想說的事寫到 `docs/team/backlog.md`。

最後更新：2026-05-25 下午（🎉 Phase 1 v2 walks + Family Leaderboard 即時 + **Per-pet walk goal 6 commits 都 SHIPPED**（Phase 1 v2 DEFERRED chevron 解鎖 → 多 pet picker ACTIVE）；Phase 2 pets prototype spec GO；Epic 5 主動推播觀察至 2026-05-27；**新 spec save-photo-to-album DRAFT**（PM 預設 3 decisions 等 user confirm）；4 個 active spec 等動工）

## 進行中

> 這個 sprint 已經在做。每條連到 `docs/features/{slug}.md` 或具體 commit。

- **Epic 4: 視覺重設計（芒果主題）** — Phase 0/0.5/(原 Phase 1)/(**Phase 1 v2 全頁重建**) ✅ SHIPPED；Phase 2-5 unblocked
  - Phase 1 v2 ship 2026-05-25 ~09:15：6 個新元件 `c98c939` + walks page 全頁重寫 `984be5b` + 9 個 i18n keys `110601e` + SHIPPED 紀錄 `33fef7b`
  - Desktop Chrome MCP 12 項驗收全 ✅；spec **0 deviation**；tracking phase + done screen palette 不破
  - ⚠️ **complete 變體待 user 觸發**：今日走滿 30 min 才能驗 dial 環變綠 + check badge + Confetti decor + 「再遛一次」CTA
  - ⚠️ 其他待驗：mobile 真實 viewport（Chrome MCP 限制）/ streak ≥7 天 leaf gradient variant
  - 👉 **下個動作（user）**：
    - 即時：今日 walk 滿 30 min 觸發 complete 變體驗收（順便 Epic 5 A1/A2 也對齊測）
    - 然後：決定 Phase 2 (pets page) 要不要走 prototype-first 還是 UI/UX 直接動工
- **Epic 5: 主動推播 — 提升用戶活躍** — [`docs/features/engagement-push-notifications.md`](../features/engagement-push-notifications.md) ✅ **5 phase 全 SHIPPED + deploy verified**（FB session 5/24 深夜批 ship + 收尾 report）
  - 4 push types 上線：A1 evening reminder 20:00 cron (`1a6fc7f`) / A2 streak warning 22:00 cron (`64f5de7`) / B1 rank-overtake aggregateLeaderboards 改 (`9c6442e`) / B2 family-milestone walks onCreate (`40a7e02`)；schema + UI (`f1e6952`)；PM ship recap (`380786d`)
  - Deploy 全到位：rules（engagementPushes + userDailyStats）+ 3 個新 functions create + aggregateLeaderboards update + frontend push 完 App Hosting auto-build
  - 1 deviation：`engagementPushes` 路徑改 3-level（`/{type}/waves/{ISO}`，functionally 等價）
  - 安全網：每 push 4 個守門（tokens > 0 / 未 opt-out / 寵物存在 / family > 1 人 for B2）+ token cleanup arrayRemove + audit doc per wave 留 trace
  - 👉 **下個動作（user）**：
    - 即時：手動 test 觀察清單跑一輪（spec 內 4 個 test 步驟）
    - **觀察至 2026-05-27（3 天）**：每 push opt-out 率 < 20% / A1 開啟率 ≥ 20% / A2 補遛率 ≥ 15% / B1 追上率 ≥ 10% / B2 family 開啟率 ≥ 30% / 同晚 A1+A2 雙推不擾人
    - 觀察過關 → 收尾移到已收尾速覽；不過關 → 寫 follow-up（throttle / 文案調整 / 時段微調）
- **Family Leaderboard 即時更新** — [`docs/features/family-leaderboard-realtime.md`](../features/family-leaderboard-realtime.md) ✅ **SHIPPED 2026-05-25**（FB session 3 commits + deploy 完成）
  - `bf8ed08` refactor: extract computeWalkerPeriodScore helper
  - `1245286` feat: recomputeWalkerLeaderboards onCreate trigger + audit + lastUpdatedAt
  - `4edb873` feat: client onSnapshot listener + glow animation + reduced-motion skip
  - Deploy 全到位：rules（realtimeLeaderboardUpdates audit）+ functions:recomputeWalkerLeaderboards,aggregateLeaderboards + App Hosting frontend rebuild
  - ⚠️ Mid-session hygiene：commit `d07511c` 訊息誤掛 `feat(leaderboard)` 但內容是 `/join` redirect 修復（前一 session 遺留 working tree）；歷史 cosmetic 髒，無功能影響
  - 👉 **下個動作（user）**：雙瀏覽器實機 test（家人 A 在 leaderboard / 家人 B 完成 walk → 對方 1-2s glow）+ 明天 00:30 cron reconciliation 觀察
- **Phase 2 pets 全頁重建** — [`docs/features/pets-v2-rebuild.md`](../features/pets-v2-rebuild.md) **GO**（prototype reviewed + spec ready，UI/UX 直接寫）
  - Prototype 100% spec coverage + 3 個加值：tab-aware FAB / Expense donut + 月比較 / 體重 trend line chart + 完整 EmptyState
  - 1 critical issue user 已決：**Pet avatar 採真實照片**（不是 prototype 卡通插畫；fallback initial + paw icon）
  - Workflow = UI/UX 直接寫 src/（同 Phase 1 v2 模式，不走 Claude Design patch 中介）
  - Scope = 一次 ship 全 6 個 artboard（list 單/多 + detail 3 tabs + empty）
  - 工作量 L，預估 1-2 session ship，8 commits 拆解
  - 👉 **下個動作（user）**：開 UI/UX session 用 spec 末段 launch prompt 動工
- **Per-pet 自訂散步目標** — [`docs/features/per-pet-walk-goal.md`](../features/per-pet-walk-goal.md) ✅ **SHIPPED 2026-05-25**（FB session 6 commits + A1+B2 deployed asia-east1）
  - `1d0f51b` types + walk-goals helper / `ee9bb1a` updatePet walkGoal passthrough / `8ac764f` pet-walk-goal-input stepper + form 整合 / `9606f80` pet-picker-dropdown + i18n / `313af47` walks page activate chevron + activePet state / `985a547` A1+B2 push cascade (deployed)
  - **Phase 1 v2 DEFERRED chevron 已 ACTIVATED** — multi-pet user 看到 dropdown picker 含 goal chip + 「管理寵物」link
  - A2 streak / leaderboard scoring 全照 spec 不動
  - 已知 follow-ups（PM 排序候選）：per-pet push 不只主寵物 / inline goal-stepper 在 picker / breed-based computed goal / goal 改動 history
  - 👉 **下個動作（user）**：實機驗證（多 pet user 切 pet 看 dial 換 goal；A1 20:00 cron 看 push 用新 threshold）+ live test pending
- **拍照後選擇性存到手機相簿** — [`docs/features/save-photo-to-album.md`](../features/save-photo-to-album.md) **GO**（Bug Hunter spec + user 2026-05-25 下午 confirm 3 開放問題）
  - User 主動回報 friction：「拍照後檔案是否有儲存到手機相簿」— Bug Hunter 確認非 bug（PWA 沙箱限制）→ 轉 feature spec
  - Scope = 4 個拍照 entry：pet form / walks tracking-view / expenses receipt-scanner / feed post-composer
  - 3 base decisions：純 Web Share API（不 fallback download 避免 iOS Files App 誤導）/ 不記偏好 / 不支援瀏覽器 button 隱藏
  - 3 開放問題 resolved：(Q1) **改 4 入口一次做**（user push back PM default 'pet-form first'）/ (Q2) inline icon swap 2 秒 / (Q3) 不 confirm dialog
  - 工作量 S（1 helper + 1 shared button 元件 + 4 入口接入 + i18n），純 client + browser API 無 schema 改動
  - 👉 **下個動作（user）**：開 Feature Builder session 動工（spec 末段已含 7 commit 拆解建議）
- **遛狗自動拍照 + 自動發動態** — [`docs/features/walks-auto-photo-share.md`](../features/walks-auto-photo-share.md) **GO**（spec ready，Feature Builder 動工）
  - User vision：「加入剛開始跟剛結束遛狗的時候拍一張照自動分享到動態的功能」
  - 3 decisions confirmed：D1 觸發 = prompt 可 skip / D2 發布 = 進 composer preview user 編 caption / D3 包裝 = 各自 1 個 post（user 改 PM default）
  - 新元件：photo-prompt-sheet bottom sheet + walk-auto-photo-section settings toggle
  - reuse：post-composer（加 3 個 optional props）+ camera capture（既有 walks pattern）+ Firebase Storage
  - Schema：AppUser.walkPrefs.autoPhotoShare 預設 ON + Post.walkId optional reference
  - 工作量 M，預估 1-2 session ship，6 commits 拆解
  - 👉 **下個動作（user）**：開 Feature Builder session 用 spec 末段 launch prompt 動工
- **Photo Lightbox** — [`docs/features/photo-lightbox.md`](../features/photo-lightbox.md) **GO**（spec ready，UI/UX 直接寫）
  - User vision：「動態的照片點一下可以放大預覽」
  - 3 decisions confirmed：scope = feed + walks（餐廳 backlog）/ multi-photo = carousel swipe + dots / 關閉 = 點背景 + X + swipe-down 三招
  - 新 reusable 元件 `src/components/ui/photo-lightbox.tsx` + 接入 post-card / walk-row / walk-tracking-view done screen + i18n
  - 工作量 S-M（1 session 內可收），預估 3-4 個 commit 拆解
  - 👉 **下個動作（user）**：開 UI/UX session 用 spec 末段 launch prompt 動工

## Epic 4: 視覺重設計 — 芒果主題（user 2026-05-24 vision + 20 個答案）

| Phase | 內容 | 工作量 | 狀態 |
|---|---|---|---|
| **0** | Design tokens（globals.css @theme inline mango palette + :root radius/motion vars — Tailwind v4 collapsed from spec's tailwind.config.ts plan）| S | ✅ **SHIPPED** `7baff73` |
| **0.5** | Raised center walks tab + bg-mango-card-soft nav surface | S | ✅ **SHIPPED** `e1a7b60` |
| ~~1~~ | ~~`/app/walks` 套 mockup tone（warm cream bg + brand CTA + leaf success）~~ | S | ⚠️ **SUPERSEDED by Phase 1 v2** — 原 ship `37d1ec4` + `8aebe14` 不 rollback，視覺由 v2 覆蓋 |
| **1 v2** | `/app/walks` **全頁結構重建** — radial dial hero + week strip + 圈內走路狗 + 主寵物 only pill + Confetti @ 達標 + 「再遛一次」CTA | M | ✅ **SHIPPED** 2026-05-25 — 元件 `c98c939` + page `984be5b` + i18n `110601e` + 紀錄 `33fef7b`；desktop 12 項驗收全過；complete 變體待 user 觸發 |
| **2 v2** | `/app/pets` + `/app/pets/[petId]` **全頁重建** — TopBar + PetHeader (真照片) + sticky 4-tab pill + 概覽 2×2 stat grid + Reminder/Expense/Health tab bodies + Expense donut + 體重 trend chart + tab-aware FAB + 完整 EmptyState + multi-pet switcher | L | 🔄 **prototype reviewed + spec ready** — 待 UI/UX session 動工（[`pets-v2-rebuild.md`](../features/pets-v2-rebuild.md)）|
| ~~2~~ home page | ~~`/app`~~ 移到 Phase 3 | — | merged into Phase 3 |
| 3 | `/onboarding` + Landing + sign-in | M | 🔓 ready，等 PM spec |
| 4 | `/app/settings` + `/app/leaderboard` | M | 🔓 ready，等 PM spec |
| 5 | Drawer pages: `/app/feed` + `/app/restaurants` (+detail) + `/app/knowledge` (+detail) + `/app/friends` (+/add) + `/app/expenses` | L | 🔓 ready，等 PM spec |
| 6 | Polish — 一致性 audit + loading/error tone + reduced-motion verify | S | 等 Phase 2-5 |

**Spec**: [`docs/features/visual-redesign-mango.md`](../features/visual-redesign-mango.md) + Phase 1 v2 addendum [`walks-v2-rebuild.md`](../features/walks-v2-rebuild.md)

**User 20 個 decisions 重點**：
- 主黃 **#FFCA28**（Material Amber 400，user 自訂；比 PM 預設亮）
- 副綠 **沿用既有 emerald**（user 自訂；不另定 #7DBE5B）
- Accent **桃粉 #FFB3BA**
- 圓角 rounded-2xl + 按鈕 rounded-full
- 動效 medium（CSS keyframes，no library）
- ~~**不做**寵物 wiggling 動效（Q11 user push back）~~ → **retract 2026-05-24 深夜**：1 個圈內限定走路狗 OK（v2 prototype dial 中心 232px 範圍內 — 已 ship 在 `walks-pet-walking.tsx`）
- **跳過 dark mode 第一輪**（Q18 — light first；dark 之後迭代）
- 100% 保留既有功能
- WCAG AA accessibility
- Phase by phase 獨立 ship

## 🎉 已收尾 epic 速覽

| Epic | 期間 | 結算 |
|---|---|---|
| 家庭功能 | 2026-05-22 → 2026-05-23 | 6 ship + 2 cancel + 2 insert = 8/8 |
| 核心體驗 v1（walk-core）| 2026-05-23 → 2026-05-24 | 1/1 ship + Screen Wake Lock fix |
| 上架收尾 + backlog P2 | 2026-05-23 | 5/5 ship |
| 核心體驗 v2（user 2026-05-24 vision） | 2026-05-24 | 🎉 6/6 全 SHIPPED |

**累計**：4 epic / ~19 work items / ~50 commits / 3 天（Epic 5 + Phase 1 v2 收尾後再加總；目前 +6 commits Epic 5 + +4 commits Phase 1 v2 + ~5 commits PM bookkeeping = ~15 commits 待累計）

## 下個方向候選（Epic 4 視覺重設計 收完後）

### Option A: PRD §6 上架條件剩下（PM 主推 — 上架前最後一哩）

- 隱私 / 服務條款內容審查（PM 寫內容）
- 自訂網域 + DNS（要花錢買網域）
- App Check 防 API key 盜用
- Lighthouse audit > 90（Epic 4 Phase 6 已 cover Lighthouse Visual / A11y > 90，Perf 可能要另 audit）

### Option B: Dark mode follow-up

Epic 4 跳過了 dark mode 第一輪。Visual redesign 完 + user 用 1-2 週後評估：
- 需要 dark mode → 寫 follow-up spec
- 不需要 → 標 do-not-do（簡化維護）

### Option C: walks 延伸 follow-ups

- 追蹤中 reload 恢復 tracking state
- 歷史紀錄分頁查看更多（**Phase 1 v2「全部 →」link 目前無 href，配對這個 spec 才有意義**）
- Family mode 加總 walk 進度
- ~~遛狗推播提醒「今天還沒遛」~~（Epic 5 A1 已 ship）

### Option D: 新方向

- 餐廳 Google Places 整合
- 知識庫持續產出
- Analytics / 北極星指標接線

## 想做但還沒規格

- Quiet hours / per-pet opt-out push 設定（Epic 5 follow-up，pushPrefs namespace 已預埋）
- ~~多 pet picker UX~~（per-pet-walk-goal spec 即將解鎖）
- **breed/age/weight 自動計算 walk goal**（per-pet-walk-goal spec ship 後 follow-up，schema source: 'computed' 已預埋）
- **餐廳照片 lightbox**（Photo Lightbox ship 後接 restaurants page，sharing same 元件）
- Push throttle（A1 + A2 同晚雙推觀察後決定）
- walks 頁「全部 →」link 對應的 walks history 頁（Phase 1 v2 留下的 UX gap — 純標籤無 href）
- Dark mode follow-up（Epic 4 後評估）
- 餐廳 Google Places 整合
- 知識庫持續產出
- Analytics / 北極星指標接線
- 自訂網域 + DNS（要花錢）
- App Check 防 API key 盜用
- Lighthouse Perf audit
- 隱私 / 服務條款內容審查
- 追蹤中 reload 恢復 tracking state
- 歷史紀錄分頁查看更多
- Family mode 加總 walk 進度
- Orphan walk photos GC

## 不做（拒絕清單）

- Web 內背景 GPS 解決方案
- AI 寵物顧問聊天
- 私訊系統
- 訂閱付費 / 廣告（DAU 上百之前不討論）
- 強迫所有使用者必須建立家庭才能使用主功能（2026-05-23 否決）
- 加入家庭時自動 pet merge wizard（2026-05-23 拿掉）— 「不直觀」
- 刪帳號時 anonymize 共用資料（2026-05-23 改 full hard delete cascade）
- 同 family 內同名 pet 合併 / dedupe migration（2026-05-23 取消）
- 開銷 payer 分析卡（2026-05-23 取消）
- walk-core 內把分數作為核心目標（2026-05-23 拿掉）
- walk-core 內把公里數當主要進度條目標（2026-05-23 拿掉）
- walks-v2 內加影片錄製 / 即時定位分享 / 路徑回放 / 天氣 API 整合 / 季節主題 / 競爭性元素（2026-05-24 排除）
- walks-v2 內加自訂鼓勵文案（2026-05-24 — over-engineering）
- 開始遛狗按鈕真的移到下方（沒上方 hero CTA）（2026-05-24 PM push-back，user 選解 A）
- 首頁 feed 只顯示家庭內 posts（2026-05-24 IA reorg D2 預設）
- /app/feed 或 /app/expenses 整頁刪除（2026-05-24 user 確認 D4/D5 都保留）
- ~~**Visual redesign 內加寵物 wiggling / wagging 動效**（2026-05-24 Q11 user 拿掉）~~ → **retract 2026-05-24 深夜**：v2 prototype 採用圈內限定走路動畫（dial 中心 232px 範圍內 6 個 keyframes），user OK；整頁 wiggle 仍 not-do，但限定區域 walking dog 解禁（已 ship 在 `walks-pet-walking.tsx`）
- **Visual redesign 內做 dark mode 第一輪**（2026-05-24 Q18 user 延後）
- **Visual redesign 內加 mascot 芒果角色 / page transition / Material ripple / Google Font / animation library**（2026-05-24 Q9/12/13/15 排除）

## 北極星指標

- 一週活躍家庭數
- 平均每家庭遛狗次數
- AI 收據掃描成功率
- 推播 opt-in 率
- 每日遛狗完成率（達標 30 分鐘 user / 活躍 user）
- walks doc 內 `photoURLs.length > 0` 的比例（walks-v2 ship 後）

> 還沒接 analytics — 目前只能定性觀察。
