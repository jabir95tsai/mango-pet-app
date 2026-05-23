# Mango Pet Roadmap

> PM 角色維護。其他角色想動這個檔案先停手，把想說的事寫到 `docs/team/backlog.md`。

最後更新：2026-05-23（🎉 三個 epic 全收尾 — 家庭 8/8 + 核心體驗 1/1 + 上架收尾 5/5；working tree 有 user 自己在弄的 branding polish 未提交）

## 進行中

> 這個 sprint 已經在做。每條連到 `docs/features/{slug}.md` 或具體 commit。

- **無 in-flight 實作工作** — 三個 epic 已收完
- 👉 **下個方向**：等使用者選（見「下個 sprint 候選」段）

## 🎉 已收尾 epic 速覽

| Epic | 期間 | 結算 |
|---|---|---|
| 家庭功能 | 2026-05-22 → 2026-05-23 | 6 ship + 2 cancel + 2 insert = 8/8 |
| 核心體驗重設計（walk-core） | 2026-05-23 同日 | 1/1 ship + 1 順手 fix（Screen Wake Lock） |
| 上架收尾 + backlog P2 | 2026-05-23 同日 | 5/5 ship |

**整體**：3 epic / 13 個 work item / ~30+ commits / 2 天 clock time

## ✅ Epic: 核心體驗重設計（walk-core-redesign）

| 項目 | 結局 | Ship commits |
|---|---|---|
| [遛狗主頁 + 追蹤畫面核心重設計](../features/walk-core-redesign.md) | ✅ SHIPPED — 5 phase commits | `2355c09`(helpers) / `229361b`(hero) / `1cf48cc`(full-screen tracking) / `54ee219`(in-page complete + auto-save) / `63c397c`(list secondary + manual log demoted) |
| 順手 fix：Screen Wake Lock | ✅ SHIPPED | `e54a94d`(hold Wake Lock so the phone doesn't sleep mid-walk) |

**PM 觀察**：FB session ship 過程發現「手機鎖屏中斷追蹤」這個 PWA limitation，順手寫 Screen Wake Lock 補完 — 對齊 walk-core 的「追蹤畫面核心體驗」principle。Spec 內列為 out-of-scope 的「追蹤中 reload」仍是 deferred，這次只是把鎖屏 cover 掉，是正確的 scope discipline。

## ✅ Epic: 上架收尾 + backlog P2

| # | 項目 | 結局 | Ship commit |
|---|---|---|---|
| 1 | PWA icons | ✅ SHIPPED | `fd4fb5b chore(pwa): generate PNG icons from SVG` |
| 2 | Footer i18n 硬編碼 | ✅ SHIPPED | `634e8c6 feat(i18n): unhardcode landing footer` |
| 3 | PushToggle cross-context token bug | ✅ SHIPPED | `9f1dc67 fix(push): reconcile current-context FCM token on probe` |
| 4 | [資料 Export — Download my data](../features/data-export.md) | ✅ SHIPPED | `3a65e59 feat(data-export): user-initiated JSON download` |
| 5 | [好友搜尋 lowercase / prefix match](../features/friends-search-lowercase.md) | ✅ SHIPPED | `07c874d`(Phase 1 schema) + `b52c144`(Phase 2 callable) + `670c99b`(Phase 3 searchUsers) + `49875c3`(docs) |

## ✅ Epic: 家庭功能（完整收尾紀錄保留供未來參考）

| # | 項目 | 結局 | Ship commit |
|---|---|---|---|
| 1 | [Reminder 完成歸屬顯示](../features/reminder-done-attribution.md) | ✅ SHIPPED | `ec8c6fd` |
| insert | [刪除帳號功能](../features/delete-account.md) | ✅ SHIPPED + user-verified | `d5ade48` (+4 follow-ups) |
| 1b | [Repeat reminder 歸屬顯示](../features/repeat-reminder-attribution.md) | ✅ SHIPPED | `3282091` |
| 2 | [家庭 onboarding 重設計（解 B）](../features/family-onboarding-redesign.md) | ✅ B1-B3 + B4 rollback | `60d820c` / `8ebcf72` / `347d71a` / `1a49653` |
| 3 | [家庭 leaderboard 切換](../features/family-leaderboard.md) | ✅ SHIPPED | `32c4feb` + `37ac063` |
| ~~4~~ | Mango dedupe migration | ❌ NOT DOING（user 取消） | — |
| ~~5~~ | 開銷 payer 分析卡 | ❌ NOT DOING（user 取消） | — |
| 6 | [Legacy 路徑清理](../features/legacy-path-cleanup.md) | ✅ SHIPPED | `1e380b7` |
| insert | Mobile bottom nav 重組 | ✅ SHIPPED | `e34640a` |

**Epic 期間 PM 觀察（5 點）**：
1. 不要把 edge case 當核心 user story 推導（B4 merge / #4 dedupe）
2. 「家庭是 optional feature」product principle（解 B personal mode）
3. PM 義務 push back 當 user choice 跟 description 對不上
4. Spec deviation 記錄文化
5. Insert / 插隊管理 — surface trade-off 再做

## 下個 sprint 候選（等使用者選方向）

### Option A: PRD §6 上架條件剩下未做

剩餘上架 prerequisite：

| 條目 | 工作量 | 角色 | 描述 |
|---|---|---|---|
| **隱私 / 服務條款內容審查** | S | PM | 目前是 sprint 6 placeholder，需要實際法律內容（GDPR / 個資法對齊）|
| **自訂網域 + DNS** | S | User / ops | 買 `mango-pet.app` 之類 + DNS + App Hosting 設定（要花錢）|
| **App Check 防 API key 盜用** | M | Backend | 防爬 + 防 abuse；user 數 > 100 才急 |
| **Lighthouse audit > 90** | M | Feature Builder | PWA / Perf / SEO 三軸都 > 90，可能要 polish |

### Option B: 之前 user 提到但 epic 沒做的 follow-ups

| 條目 | 工作量 | 角色 | 描述 |
|---|---|---|---|
| **遛狗推播提醒「今天還沒遛」** | M | Backend + FB | walk-core 的留存延伸 — scanReminders 每日掃使用者今日 walks，未達標推播 |
| **追蹤中 reload 恢復 tracking state** | M | Feature Builder | walk-core 的 PWA limitation；要不要解 PM 決策 |
| **歷史紀錄分頁查看更多** | M | Feature Builder | walk-core spec 標 out-of-scope，user 想看更多就要做 |
| **Family mode 加總 walk 進度（vs 個人 only）** | S | Feature Builder | walk-core 預設個人 only；如果家庭內想看「全家本週共多少次」可加 toggle |

### Option C: 新功能 / 新方向

| 條目 | 描述 |
|---|---|
| 餐廳 Google Places 整合 | 大幅擴大餐廳資料庫，但成本 + 審核機制要先想 |
| 知識庫持續產出 | 目前只 seed 5 篇，是否要每月產出 |
| Analytics / 北極星指標接線 | GA4 / Firebase Analytics — 把所有 epic ship 後的 retention 量化 |

### Option D: 休息一下，跑 production 觀察

3 個 epic 同日 ship 了非常多東西。**PM 建議先觀察 1-2 天**：
- 自己 + 家人實測 walk-core 新流程是否真有「打開就想按開始」的體感
- 確認 friends search 真的 case-insensitive ok
- 確認 PWA icons 在 iOS Safari 加主畫面顯示對
- 確認 PushToggle cross-context fix 對「Safari → PWA 切換」場景真的 work

PM 主推 **Option D 先觀察 → 若沒 bug 跳 Option A 跑 PRD §6 上架收尾**。

## 想做但還沒規格

> 想法階段。下個 PM session 決定。

- **遛狗推播提醒「今天還沒遛」**（walk-core 延伸）
- **追蹤中 reload 恢復 tracking state**
- **歷史紀錄分頁查看更多**
- **Family mode 加總 walk 進度**
- **餐廳 Google Places 整合**
- **知識庫持續產出**
- **Analytics / 北極星指標接線**
- **自訂網域 + DNS**（要花錢）
- **App Check 防 API key 盜用**
- **Lighthouse audit > 90**
- **隱私 / 服務條款內容審查**

## 不做（拒絕清單）

> 比「做」更重要。寫下來防止反覆討論同一件事。

- **Web 內背景 GPS 解決方案**
- **AI 寵物顧問聊天**
- **私訊系統**
- **訂閱付費 / 廣告**（DAU 上百之前不討論）
- **強迫所有使用者必須建立家庭才能使用主功能**（PM 解 C 提議 2026-05-23 已被否決）
- **加入家庭時自動 pet merge wizard**（B4 ship 後 2026-05-23 拿掉）— 「不直觀，因為一般不太有這種狀況」
- **刪帳號時 anonymize 共用資料**（2026-05-23 改 full hard delete cascade）
- **同 family 內同名 pet 合併 / dedupe migration**（#4 2026-05-23 取消）— 罕見情境
- **開銷 payer 分析卡**（#5 2026-05-23 取消）— 家庭 ≤ 5 人總額足用
- **walk-core 內把分數作為核心目標**（2026-05-23 拿掉）— 分數仍在 leaderboard
- **walk-core 內把公里數當主要進度條目標**（2026-05-23 拿掉）— 分鐘更穩

## 北極星指標（每月看一次）

- 一週活躍家庭數
- 平均每家庭遛狗次數
- AI 收據掃描成功率
- 推播 opt-in 率
- **每日遛狗完成率**（達標 30 分鐘的 user / 活躍 user）— walk-core ship 後可定性看，未來接 analytics 可量化

> 還沒接 analytics — 目前只能定性觀察。**接 analytics 這件事本身已進入「想做但還沒規格」**，等下個 PM session 決定要不要這個 sprint 規格化。
