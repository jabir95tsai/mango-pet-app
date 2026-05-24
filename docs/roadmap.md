# Mango Pet Roadmap

> PM 角色維護。其他角色想動這個檔案先停手，把想說的事寫到 `docs/team/backlog.md`。

最後更新：2026-05-24（🎉 Epic 1-3 全收尾；user 2026-05-24 提全 app visual redesign → Epic 4 開工，spec 6 phases ready）

## 進行中

> 這個 sprint 已經在做。每條連到 `docs/features/{slug}.md` 或具體 commit。

- **Epic 4: 視覺重設計（芒果主題）** — Phase 0 + 0.5 + 1 ✅ SHIPPED；等 user review production + Phase 2 起改用 prototype-first workflow
  - 👉 **下個動作（user）**：Chrome / iPhone 看 production walks 視覺 → 視覺 OK → PM 給 Claude Design Phase 2 pets prototype-first ping prompt

## Epic 4: 視覺重設計 — 芒果主題（user 2026-05-24 vision + 20 個答案）

| Phase | 內容 | 工作量 | 狀態 |
|---|---|---|---|
| **0** | Design tokens（globals.css @theme inline mango palette + :root radius/motion vars — Tailwind v4 collapsed from spec's tailwind.config.ts plan）| S | ✅ **SHIPPED** `7baff73` |
| **0.5** | Raised center walks tab + bg-mango-card-soft nav surface | S | ✅ **SHIPPED** `e1a7b60` |
| 1 | `/app/walks` 套 mockup tone（warm cream bg + brand CTA + leaf success）| S | ✅ **SHIPPED** `37d1ec4` + polish `8aebe14`（drop raised-disc label + sticky CTA lift）|
| 2 | `/app` + `/app/pets` + `/app/pets/[petId]` | M | 等 Phase 0 |
| 3 | `/onboarding` + Landing + sign-in | M | 等 Phase 0 |
| 4 | `/app/settings` + `/app/leaderboard` | M | 等 Phase 0 |
| 5 | Drawer pages: `/app/feed` + `/app/restaurants` (+detail) + `/app/knowledge` (+detail) + `/app/friends` (+/add) + `/app/expenses` | L | 等 Phase 0 |
| 6 | Polish — 一致性 audit + loading/error tone + reduced-motion verify | S | 等 Phase 1-5 |

**Spec**: [`docs/features/visual-redesign-mango.md`](../features/visual-redesign-mango.md)

**User 20 個 decisions 重點**：
- 主黃 **#FFCA28**（Material Amber 400，user 自訂；比 PM 預設亮）
- 副綠 **沿用既有 emerald**（user 自訂；不另定 #7DBE5B）
- Accent **桃粉 #FFB3BA**
- 圓角 rounded-2xl + 按鈕 rounded-full
- 動效 medium（CSS keyframes，no library）
- **不做**寵物 wiggling 動效（Q11 user push back）
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

**累計**：4 epic / ~19 work items / ~50 commits / 3 天

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

- 遛狗推播提醒「今天還沒遛」
- 追蹤中 reload 恢復 tracking state
- 歷史紀錄分頁查看更多
- Family mode 加總 walk 進度

### Option D: 新方向

- 餐廳 Google Places 整合
- 知識庫持續產出
- Analytics / 北極星指標接線

## 想做但還沒規格

- Dark mode follow-up（Epic 4 後評估）
- 餐廳 Google Places 整合
- 知識庫持續產出
- Analytics / 北極星指標接線
- 自訂網域 + DNS（要花錢）
- App Check 防 API key 盜用
- Lighthouse Perf audit
- 隱私 / 服務條款內容審查
- 遛狗推播提醒「今天還沒遛」
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
- **Visual redesign 內加寵物 wiggling / wagging 動效**（2026-05-24 Q11 user 拿掉）
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
