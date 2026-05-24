# Mango Pet Roadmap

> PM 角色維護。其他角色想動這個檔案先停手，把想說的事寫到 `docs/team/backlog.md`。

最後更新：2026-05-24（Epic 3 核心體驗 v2 — walks-photo-and-celebration ✅ + Home+Pets IA reorg ✅；剩 sticky bottom CTA 一條 backlog 級工作）

## 進行中

> 這個 sprint 已經在做。每條連到 `docs/features/{slug}.md` 或具體 commit。

- **無 in-flight production 實作** — Epic 3 兩個主 spec + sticky CTA 都 SHIPPED
- 👉 **下個動工**：backlog「Default landing → /app/walks」（UI/UX, S；最後一條 v2 backlog）

## ✅ Epic 3: 核心體驗 v2（user 2026-05-24 vision — 5 個需求結算）

| User 需求 | 結局 | Ship commit |
|---|---|---|
| 1. 拍照功能 | ✅ SHIPPED | `375ecba` Phase 1（schema/storage/lib）|
| 4. 吸引人元素（hero motivation） | ✅ SHIPPED | `7fde453` Phase 2（celebration + streak + encouragement）|
| 5. 結算成就感 | ✅ SHIPPED | `7fde453`（同上 Phase 2）|
| 2. 提醒搬家（+ 開銷搬家 + 動態整合首頁 + drawer 刪 feed） | ✅ SHIPPED | `e16e18e`(reminders 早期) + `9ff561d`(完整 IA reorg：feed 10 / expenses / drawer)|
| 3. 開始按鈕移下方 → PM push-back → user 選解 A → sticky bottom CTA | ✅ SHIPPED | `5c1429e` ui(walks): mobile sticky bottom Start CTA |
| **6. Default landing 改為 /app/walks**（user 2026-05-24 加 — 對齊 walk-core vision）| 📝 backlog 條目（待 UI/UX 接）| — |

**結算**：5/6 SHIPPED + 1 backlog 條目（default landing）

**User 確認的 product decisions（PM 開放問題收尾）**：
- D4 `/app/feed` 整頁：**保留**（drawer 沒入口，首頁「查看更多」連進去）✓
- D5 `/app/expenses` 整頁：**保留**（drawer 仍有入口，當跨寵物總覽）✓
- 開始按鈕位置：**解 A**（sticky bottom CTA + 上方 Hero 大按鈕都在）✓

## 🎉 已收尾 epic 速覽

| Epic | 期間 | 結算 |
|---|---|---|
| 家庭功能 | 2026-05-22 → 2026-05-23 | 6 ship + 2 cancel + 2 insert = 8/8 |
| 核心體驗 v1（walk-core）| 2026-05-23 → 2026-05-24 | 1/1 ship + Screen Wake Lock fix |
| 上架收尾 + backlog P2 | 2026-05-23 | 5/5 ship |
| **核心體驗 v2（user 2026-05-24 vision）** | **2026-05-24** | **5/6 ship + 1 backlog（default landing）** |

**累計**：4 epic / ~17 work items / ~40+ commits / 3 天 clock time

## 下個方向候選（sticky CTA 收完後）

### Option A: PRD §6 上架條件剩下（PM 主推）

- 隱私 / 服務條款內容審查（PM 寫內容）
- 自訂網域 + DNS（要花錢買網域）
- App Check 防 API key 盜用
- Lighthouse audit > 90

### Option B: walks 延伸 follow-ups

- 遛狗推播提醒「今天還沒遛」
- 追蹤中 reload 恢復 tracking state
- 歷史紀錄分頁查看更多
- Family mode 加總 walk 進度
- Orphan walk photos GC（walks-v2 ship 後 user 中斷 walk 留下 Storage 殘留）

### Option C: 新方向

- 餐廳 Google Places 整合
- 知識庫持續產出
- Analytics / 北極星指標接線

### Option D: 休息觀察 1-2 天（PM 上次推薦的）

3 個 epic 加 v2 = 大量 production 變動。實測一下看是否有 bug。

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
- Orphan walk photos GC

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
- **walks-v2 內加影片錄製 / 即時定位分享 / 路徑回放 / 天氣 API 整合 / 季節主題 / 競爭性元素**（2026-05-24 排除）
- **walks-v2 內加自訂鼓勵文案**（2026-05-24 — over-engineering）
- **開始遛狗按鈕真的移到下方（沒上方 hero CTA）**（2026-05-24 PM push-back，user 選解 A 改 sticky bottom + 保留 hero）— 違反 walk-core spec「3 秒看到開始」原則
- **首頁 feed 只顯示家庭內 posts**（2026-05-24 IA reorg 採 D2 預設：家庭 + friends + public 混合）— 弱化 social
- **/app/feed 或 /app/expenses 整頁刪除**（2026-05-24 user 確認 D4/D5 都保留）

## 北極星指標

- 一週活躍家庭數
- 平均每家庭遛狗次數
- AI 收據掃描成功率
- 推播 opt-in 率
- 每日遛狗完成率（達標 30 分鐘 user / 活躍 user）
- walks doc 內 `photoURLs.length > 0` 的比例（walks-v2 ship 後）

> 還沒接 analytics — 目前只能定性觀察。
