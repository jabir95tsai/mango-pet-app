# Mango Pet Roadmap

> PM 角色維護。其他角色想動這個檔案先停手，把想說的事寫到 `docs/team/backlog.md`。

最後更新：2026-05-24（user 2026-05-24 提 5 個新需求 → 開新 epic「核心體驗 v2」；含 PM push-back on 開始按鈕位置）

## 進行中

> 這個 sprint 已經在做。每條連到 `docs/features/{slug}.md` 或具體 commit。

- **核心體驗 v2 epic**（新）— 2 個 spec ready，1 個 PM push-back 等 user 重評
- 👉 **下個動工選擇**：見「Handoff 順序」（下方）

## Epic 3: 核心體驗 v2（user 2026-05-24 vision）

> User 主動提 5 個需求：拍照功能 / 提醒搬家 / 開始按鈕位置 / 吸引人元素 / 結算成就感

| 項目 | 工作量 | 角色 | 狀態 |
|---|---|---|---|
| **[遛狗體驗 v2 — 拍照 + 結算 celebration + Motivation](../features/walks-photo-and-celebration.md)** | M-L（拆 Phase 1 拍照 + Phase 2 celebration+motivation） | Feature Builder | ✅ READY-FOR-DEV（PM 5 decisions 預設）|
| **[Home + Pets 頁 IA 重組](../features/reminders-to-pets-page.md)** — reminders + expenses 搬到 pets / feed 整合首頁 / 更多 drawer 刪 feed | M（從 S 升 — user 2026-05-24 加 2 需求）| UI/UX | ✅ READY-FOR-DEV（含 2 個開放問題：/app/feed + /app/expenses 整頁保留 vs 刪）|
| **⚠️ 開始按鈕移到下方** | — | — | 🔴 **PM PUSH-BACK** — 違反 walk-core spec「3 秒看到開始」核心 principle，等 user 重評 |

### 三個項目可並行（無檔案衝突）

- walks-photo-and-celebration: `src/lib/types.ts`, `walks.ts`, `walk-tracking-view.tsx`, `walks/page.tsx`, `globals.css`
- reminders-to-pets-page: `src/app/app/page.tsx`, `pets/page.tsx`, `pets/[petId]/page.tsx`
- 兩者皆碰 `messages/*.json` 但 namespace 不同（`Walks.*` vs `Reminders.*`），不衝突

## 🎉 已收尾 epic 速覽

| Epic | 期間 | 結算 |
|---|---|---|
| 家庭功能 | 2026-05-22 → 2026-05-23 | 6 ship + 2 cancel + 2 insert = 8/8 |
| 核心體驗 v1（walk-core）| 2026-05-23 → 2026-05-24 | 1/1 ship + 1 順手 fix（Wake Lock）|
| 上架收尾 + backlog P2 | 2026-05-23 | 5/5 ship |

**累計**：3 epic / 13 work items / ~30+ commits / 2-3 天 clock time

（詳細 commit 對應表見 git log 跟既有 spec 末尾 SHIPPED 段）

## 下個方向候選（核心體驗 v2 收完後）

### Option A: PRD §6 上架條件剩下

- 隱私 / 服務條款內容審查（PM 寫內容）
- 自訂網域 + DNS（要花錢買網域）
- App Check 防 API key 盜用
- Lighthouse audit > 90

### Option B: walk-core follow-ups（之前 user 提過）

- 遛狗推播提醒「今天還沒遛」（跨 reminders / push）
- 追蹤中 reload 恢復 tracking state
- 歷史紀錄分頁查看更多
- Family mode 加總 walk 進度

### Option C: 新方向

- 餐廳 Google Places 整合
- 知識庫持續產出
- Analytics / 北極星指標接線

## 想做但還沒規格

- 餐廳 Google Places 整合
- 知識庫持續產出
- Analytics / 北極星指標接線
- 自訂網域 + DNS（要花錢）
- App Check 防 API key 盜用
- Lighthouse audit > 90
- 隱私 / 服務條款內容審查
- 遛狗推播提醒「今天還沒遛」
- 追蹤中 reload 恢復 tracking state
- 歷史紀錄分頁查看更多
- Family mode 加總 walk 進度
- Orphan walk photos GC（walk-experience-v2 ship 後若 user 中斷 walk 留下 Storage 殘留）

## 不做（拒絕清單）

- **Web 內背景 GPS 解決方案**
- **AI 寵物顧問聊天**
- **私訊系統**
- **訂閱付費 / 廣告**（DAU 上百之前不討論）
- **強迫所有使用者必須建立家庭才能使用主功能**（2026-05-23 否決）
- **加入家庭時自動 pet merge wizard**（2026-05-23 拿掉）— 「不直觀」
- **刪帳號時 anonymize 共用資料**（2026-05-23 改 full hard delete cascade）
- **同 family 內同名 pet 合併 / dedupe migration**（2026-05-23 取消）
- **開銷 payer 分析卡**（2026-05-23 取消）
- **walk-core 內把分數作為核心目標**（2026-05-23 拿掉）
- **walk-core 內把公里數當主要進度條目標**（2026-05-23 拿掉）
- **walks-photo-and-celebration 內加影片錄製 / 即時定位分享 / 路徑回放 / 天氣 API 整合 / 季節主題 / 競爭性元素**（2026-05-24 spec 排除）
- **walks-photo-and-celebration 內加自訂鼓勵文案**（2026-05-24 — over-engineering，預設 i18n 集合就好）

## 北極星指標

- 一週活躍家庭數
- 平均每家庭遛狗次數
- AI 收據掃描成功率
- 推播 opt-in 率
- 每日遛狗完成率（達標 30 分鐘 user / 活躍 user）
- **新**：walks doc 內 `photoURLs.length > 0` 的比例（walk-experience-v2 ship 後）

> 還沒接 analytics — 目前只能定性觀察。
