# Mango Pet Roadmap

> PM 角色維護。其他角色想動這個檔案先停手，把想說的事寫到 `docs/team/backlog.md`。

最後更新：2026-05-23（user 提出遛狗頁 vision-level redesign → 升級為獨立 epic；launch-prep epic 後延但仍 ready）

## 進行中

> 這個 sprint 已經在做。每條連到 `docs/features/{slug}.md` 或具體 commit。

- **無 in-flight 實作工作** — 兩個 epic 都 ready-for-dev 等使用者選順序
  - 👉 **PM 建議下個動工**：「核心體驗重設計」epic 的 walk-core-redesign（user 主動提的 vision，留存槓桿 > polish）

## Epic 1: 核心體驗重設計（user 2026-05-23 vision）

> User 主動提 product vision：「Mango Pet 的核心是『遛狗』...留住使用者的不是功能數量，而是每天都有一個很小的『完成感』」。

| # | 項目 | 工作量 | 角色 | 狀態 |
|---|---|---|---|---|
| 1 | **[遛狗主頁 + 追蹤畫面核心重設計](../features/walk-core-redesign.md)** | M | UI/UX | ✅ **READY-FOR-DEV**（user vision + 5 decisions + PM edge cases 全寫好）|

**PM 建議優先做這個的理由**：
- User 主動提的 product vision-level 改動 — 是這個 session 唯一 user-initiated 的 strategic direction
- 對齊「Mango Pet 的核心是遛狗」product framing
- 留存假設明確（daily habit hook + 完成感）
- 工作量 M、不動 schema、UI/UX 一條龍可做
- 跟 launch-prep epic 無檔案衝突，可獨立完工

## Epic 2: 上架收尾 + backlog P2

> User 2026-05-23 上一輪選定。5 項全 ready-for-dev。

| # | 項目 | 工作量 | 角色 | 狀態 |
|---|---|---|---|---|
| 1 | **PWA icons** | S | User / UI/UX | 📝 ready-to-do（用 realfavicongenerator.net 從 SVG 生成 PNG 套組）|
| 2 | **Footer i18n 硬編碼** | XS | Feature Builder | 📝 ready-to-do（既有 backlog 條目）|
| 3 | **PushToggle cross-context token bug** | S | UI/UX or FB | 📝 ready-to-do（既有 backlog 條目）|
| 4 | **[資料 Export — Download my data](../features/data-export.md)** | M | Feature Builder | ✅ READY-FOR-DEV |
| 5 | **[好友搜尋 lowercase / prefix match](../features/friends-search-lowercase.md)** | M | Backend | ✅ READY-FOR-DEV |

## Handoff 順序 — PM surface 給 user 看的 trade-off

### Option A: **先 Epic 1（walk-core）→ 後 Epic 2（launch-prep）** — PM 主推

理由：
- Walk-core 是 user-facing 核心體驗改動，留存槓桿 > polish
- User 主動提 vision，動能熱
- Epic 2 polish 不擋目前使用者使用

順序：UI/UX session 接 walk-core → ship 完回 PM session 驗收 → 開 Epic 2（4 sessions 並行 or sequential）

### Option B: **Epic 1 + Epic 2 並行**（兩個 session 同時開）

可行 — 檔案無衝突：
- UI/UX walk-core：動 `src/app/app/walks/*`、`src/components/walks/*`、`src/lib/walk-tracking.ts`
- FB launch-prep 工作：動 `src/app/page.tsx`（footer i18n）、`src/components/settings/*`（PushToggle / data-export）
- Backend friends-search：動 `functions/src/index.ts`、`src/lib/firebase/users.ts`、`src/lib/types.ts`

只要兩個 session 都先 `git fetch && git pull` 再開工，並 commit/push 之前再 fetch，可以平行。

### Option C: **先 Epic 2 → 後 Epic 1**

理由：Epic 2 多個 quick wins（PWA icons / footer / PushToggle 共 3 個 S/XS），先收乾淨；Walk-core 是 M，留最後集中做。

**PM 不推薦** — 因為 walk-core 是 user 主動提，先做能維持 product 動能。Polish 永遠做不完，產品方向才是難得的清晰時刻。

## 🎉 家庭功能 epic — 完整收尾紀錄（2026-05-22 → 2026-05-23）

| # | 項目 | 工作量 | 角色 | 結局 | Ship commit |
|---|---|---|---|---|---|
| 1 | [Reminder 完成歸屬顯示](../features/reminder-done-attribution.md) | S | Feature Builder | ✅ SHIPPED | `ec8c6fd` |
| insert | [刪除帳號功能](../features/delete-account.md) | M | Feature Builder | ✅ SHIPPED + user-verified | `d5ade48` (+4 follow-ups) |
| 1b | [Repeat reminder 歸屬顯示](../features/repeat-reminder-attribution.md) | S | Feature Builder | ✅ SHIPPED | `3282091` |
| 2 | [家庭 onboarding 重設計（解 B）](../features/family-onboarding-redesign.md) | L | Feature Builder | ✅ 全部 SHIPPED（B1-B3 + B4 rollback） | `60d820c` / `8ebcf72` / `347d71a` / `1a49653` |
| 3 | [家庭 leaderboard 切換](../features/family-leaderboard.md) | M | Feature Builder | ✅ SHIPPED（Phase 0 + 主體） | `32c4feb` + `37ac063` |
| ~~4~~ | Mango dedupe migration | M | Backend | ❌ NOT DOING（user 取消） | — |
| ~~5~~ | 開銷 payer 分析卡 | S | UI/UX | ❌ NOT DOING（user 取消） | — |
| 6 | [Legacy 路徑清理](../features/legacy-path-cleanup.md) | M | Backend | ✅ SHIPPED | `1e380b7` |
| insert | Mobile bottom nav 重組 | S | UI/UX | ✅ SHIPPED | `e34640a` |

**結算**：6 ship + 2 cancel + 2 insert = **8/8 有明確結局**

Epic 期間 PM 觀察 / 學到的事（5 點）：
1. 不要把 edge case 當核心 user story 推導
2. 「家庭是 optional feature」product principle
3. PM 義務 push back 當 user choice 跟 description 對不上
4. Spec deviation 記錄文化
5. Insert / 插隊管理 — surface trade-off 再做

## 下一個（已規格化，可直接交付）

> Epic 1 + Epic 2 都 ready-for-dev，等使用者選順序。

## 想做但還沒規格

> 想法階段。當前兩個 epic 完工後決定。

- **餐廳 Google Places 整合**
- **知識庫持續產出**
- **Analytics / 北極星指標接線**
- **自訂網域 + DNS**（PRD §6，要花錢買網域）
- **App Check 防 API key 盜用**（PRD §6）
- **Lighthouse audit > 90**（PRD §6）
- **隱私 / 服務條款內容審查**（PRD §6，PM 寫內容）
- **遛狗推播提醒「今天還沒遛」**（walk-core ship 後可考慮 — 跨 reminders / push 系統）
- **追蹤中 reload 恢復 tracking state**（PWA 限制延伸問題）
- **歷史紀錄分頁查看更多**

## 不做（拒絕清單）

> 比「做」更重要。寫下來防止反覆討論同一件事。

- **Web 內背景 GPS 解決方案**
- **AI 寵物顧問聊天**
- **私訊系統**
- **訂閱付費 / 廣告**（DAU 上百之前不討論）
- **強迫所有使用者必須建立家庭才能使用主功能**（PM 解 C 提議 2026-05-23 已被否決）
- **加入家庭時自動 pet merge wizard**（B4 ship 後 2026-05-23 拿掉）— 「不直觀，因為一般不太有這種狀況」
- **刪帳號時 anonymize 共用資料**（2026-05-23 改 full hard delete cascade）
- **同 family 內同名 pet 合併 / dedupe migration**（#4 2026-05-23 取消）
- **開銷 payer 分析卡**（#5 2026-05-23 取消）
- **walk-core 內把分數作為核心目標**（2026-05-23 user 明確說「分數適合排行榜，但留存更需要『我今天完成了』的感覺」）— 分數仍在 leaderboard 顯示
- **walk-core 內把公里數當主要進度條目標**（2026-05-23 user 明確說「GPS 在 Web/PWA 容易受影響，用『分鐘』當主目標更穩」）

## 北極星指標（每月看一次）

- 一週活躍家庭數
- 平均每家庭遛狗次數
- AI 收據掃描成功率
- 推播 opt-in 率
- **新**：每日遛狗完成率（達標 30 分鐘的 user / 活躍 user）— walk-core ship 後可定性看，未來接 analytics 可量化

> 還沒接 analytics — 目前只能定性觀察。**接 analytics 這件事本身已進入「想做但還沒規格」**，等下個 PM session 決定要不要這個 sprint 規格化。
