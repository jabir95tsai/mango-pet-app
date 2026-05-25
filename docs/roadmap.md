# Mango Pet Roadmap

> PM 角色維護。其他角色想動這個檔案先停手，把想說的事寫到 `docs/team/backlog.md`。

最後更新：2026-05-24 深夜（🎉 Epic 5 主動推播 5 phase 全 SHIPPED；Epic 4 walks v2 prototype 拿到 → 原 Phase 1 superseded by Phase 1 v2 全頁重建，**workflow 改 UI/UX 直接寫 src/**（跳過 Claude Design 中介），待 UI/UX session 動工；Q11 寵物動效 retracted — 圈內限定 OK）

## 進行中

> 這個 sprint 已經在做。每條連到 `docs/features/{slug}.md` 或具體 commit。

- **Epic 4: 視覺重設計（芒果主題）** — Phase 0/0.5/(原 Phase 1) ✅ SHIPPED；**Phase 1 v2 全頁重建** prototype 已 review，**workflow 改 UI/UX 直接寫 src/**（跳過 Claude Design 中介），待 UI/UX session 動工
  - 原 Phase 1 palette swap **superseded by Phase 1 v2**（walks 頁結構重建 — radial dial + week strip + 圈內走路狗 + 主寵物 only pill + Confetti @ 達標 + 「再遛一次」CTA）
  - User 推翻 Q11：圈內限定走路狗動效 OK（roadmap not-do 第 118 行 retract，見「不做」段）
  - 多 pet picker DEFERRED — 主寵物 only，多 pet 設計之後再 spec
  - Spec: [`docs/features/walks-v2-rebuild.md`](../features/walks-v2-rebuild.md)
  - Prototype: [`docs/design/walks-v2-prototype/Walks redesign.html`](../design/walks-v2-prototype/Walks%20redesign.html)（視覺/實作參考，不再產 patches/ 中間層）
  - 👉 **下個動作（user）**：開 UI/UX session 用 PM 寫好的 launch prompt（walks-v2-rebuild.md 末段）→ UI/UX 直接寫 src/ + commit + push + ship（5-8 min App Hosting 部署後 production 驗收）
- **Epic 5: 主動推播 — 提升用戶活躍** — [`docs/features/engagement-push-notifications.md`](../features/engagement-push-notifications.md) ✅ **5 phase 全 SHIPPED + deploy verified**（FB session 5/24 深夜批 ship + 收尾 report）
  - 4 push types 上線：A1 evening reminder 20:00 cron (`1a6fc7f`) / A2 streak warning 22:00 cron (`64f5de7`) / B1 rank-overtake aggregateLeaderboards 改 (`9c6442e`) / B2 family-milestone walks onCreate (`40a7e02`)；schema + UI (`f1e6952`)；PM ship recap (`380786d`)
  - Deploy 全到位：rules（engagementPushes + userDailyStats）+ 3 個新 functions create + aggregateLeaderboards update + frontend push 完 App Hosting auto-build
  - 1 deviation：`engagementPushes` 路徑改 3-level（`/{type}/waves/{ISO}`，functionally 等價）
  - 安全網：每 push 4 個守門（tokens > 0 / 未 opt-out / 寵物存在 / family > 1 人 for B2）+ token cleanup arrayRemove + audit doc per wave 留 trace
  - 👉 **下個動作（user）**：
    - 即時：手動 test 觀察清單跑一輪（spec 內 4 個 test 步驟）
    - **觀察至 2026-05-27（3 天）**：每 push opt-out 率 < 20% / A1 開啟率 ≥ 20% / A2 補遛率 ≥ 15% / B1 追上率 ≥ 10% / B2 family 開啟率 ≥ 30% / 同晚 A1+A2 雙推不擾人
    - 觀察過關 → 收尾移到已收尾速覽；不過關 → 寫 follow-up（throttle / 文案調整 / 時段微調）

## Epic 4: 視覺重設計 — 芒果主題（user 2026-05-24 vision + 20 個答案）

| Phase | 內容 | 工作量 | 狀態 |
|---|---|---|---|
| **0** | Design tokens（globals.css @theme inline mango palette + :root radius/motion vars — Tailwind v4 collapsed from spec's tailwind.config.ts plan）| S | ✅ **SHIPPED** `7baff73` |
| **0.5** | Raised center walks tab + bg-mango-card-soft nav surface | S | ✅ **SHIPPED** `e1a7b60` |
| ~~1~~ | ~~`/app/walks` 套 mockup tone（warm cream bg + brand CTA + leaf success）~~ | S | ⚠️ **SUPERSEDED by Phase 1 v2** — 原 ship `37d1ec4` + `8aebe14` 不 rollback，視覺由 v2 覆蓋 |
| **1 v2** | `/app/walks` **全頁結構重建** — radial dial hero + week strip + 圈內走路狗 + 主寵物 only pill + Confetti @ 達標 + 「再遛一次」CTA | M | 🔄 **prototype reviewed + spec ready**，待 UI/UX session 動工（直接寫 src/，no patches/ 中介）|
| 2 | `/app` + `/app/pets` + `/app/pets/[petId]` | M | 等 Phase 1 v2 |
| 3 | `/onboarding` + Landing + sign-in | M | 等 Phase 1 v2 |
| 4 | `/app/settings` + `/app/leaderboard` | M | 等 Phase 1 v2 |
| 5 | Drawer pages: `/app/feed` + `/app/restaurants` (+detail) + `/app/knowledge` (+detail) + `/app/friends` (+/add) + `/app/expenses` | L | 等 Phase 1 v2 |
| 6 | Polish — 一致性 audit + loading/error tone + reduced-motion verify | S | 等 Phase 1-5 |

**Spec**: [`docs/features/visual-redesign-mango.md`](../features/visual-redesign-mango.md) + Phase 1 v2 addendum [`walks-v2-rebuild.md`](../features/walks-v2-rebuild.md)

**User 20 個 decisions 重點**：
- 主黃 **#FFCA28**（Material Amber 400，user 自訂；比 PM 預設亮）
- 副綠 **沿用既有 emerald**（user 自訂；不另定 #7DBE5B）
- Accent **桃粉 #FFB3BA**
- 圓角 rounded-2xl + 按鈕 rounded-full
- 動效 medium（CSS keyframes，no library）
- ~~**不做**寵物 wiggling 動效（Q11 user push back）~~ → **retract 2026-05-24 深夜**：1 個圈內限定走路狗 OK（v2 prototype dial 中心 232px 範圍內）
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

**累計**：4 epic / ~19 work items / ~50 commits / 3 天（Epic 5 + Phase 1 v2 收尾後再加總）

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
- 歷史紀錄分頁查看更多
- Family mode 加總 walk 進度
- ~~遛狗推播提醒「今天還沒遛」~~（Epic 5 A1 已 ship）

### Option D: 新方向

- 餐廳 Google Places 整合
- 知識庫持續產出
- Analytics / 北極星指標接線

## 想做但還沒規格

- Quiet hours / per-pet opt-out push 設定（Epic 5 follow-up，pushPrefs namespace 已預埋）
- 多 pet picker UX（walks 頁 Phase 1 v2 ship 後 follow-up）
- Push throttle（A1 + A2 同晚雙推觀察後決定）
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
- ~~**Visual redesign 內加寵物 wiggling / wagging 動效**（2026-05-24 Q11 user 拿掉）~~ → **retract 2026-05-24 深夜**：v2 prototype 採用圈內限定走路動畫（dial 中心 232px 範圍內 6 個 keyframes），user OK；整頁 wiggle 仍 not-do，但限定區域 walking dog 解禁
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
