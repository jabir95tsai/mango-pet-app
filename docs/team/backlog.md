# Backlog

> 跨角色的「之後再處理」清單。每個角色 session 看到不在自己範圍的事，**寫進這裡再繼續做手上的事**，不要當下分心去修。

## 怎麼用

- 寫入：Bug Hunter、UI/UX、Feature Builder、Backend 在 session 中遇到不該動的事，丟一條進這裡。
- 讀出 / 排序：每個 PM session 開頭看一次，分類、合併、決定下次哪些升到 `docs/roadmap.md`。
- 不要把這裡當 GitHub Issues 用 — 一旦超過 30 條就停下來做一輪 PM session 清理。

## 條目格式

每條一個 H3，照模板填：

```
### [簡短一句話標題]
- **發現於**：YYYY-MM-DD、哪個角色 session
- **類型**：bug / 體驗 / 技術債 / 新功能想法 / 設計
- **重現 / 觀察**：(怎麼觸發到 / 在哪裡看到)
- **建議交付給**：Bug Hunter / UI/UX / Feature / Backend / PM
- **優先級提示**：P0(立即) / P1(下個 sprint) / P2(可等) / P3(也許永遠)
```

P0 = 使用者資料/安全/錢有風險。
P1 = 影響核心功能體驗。
P2 = 小痛點。
P3 = 也許永遠不做的「想法」。

---

## Inbox（未分類）

> 新進來的條目都放這。PM session 會搬到下方分類區。

_2026-05-22 PM session 已清空。2026-05-23 Feature Builder #2 ship 後新增 2 條 deviation。2026-05-23 Bug Hunter session 加 1 條 push UX。_

### PushToggle probe 把跨 context 的 token 當「已啟用」 — ✅ SHIPPED
- **發現於**：2026-05-23、Bug Hunter session
- **狀態**：✅ SHIPPED `9f1dc67`（Feature Builder 2026-05-23）— 新 `reconcileCurrentToken(uid)` helper in `src/lib/firebase/messaging.ts` 主動 `getToken({ vapidKey, swReg })` 拿當前 context 的 token，arrayUnion 進 `user.fcmTokens`（idempotent）。`push-toggle.tsx` probe 改在 `perm === "granted"` 時呼叫 reconcile，不再僅看 `tokens.length > 0`。Cost: 多一次 ~1s getToken 網路 call per Settings 開啟（acceptable，使用者不常開）。原本「PWA 內停用→啟用」 workaround 不需要了 — 新 context 第一次進 settings 自動 reconcile

### Personal walks 不應進全 App leaderboard — ✅ 已升級到 #3 spec
- **發現於**：2026-05-23、Feature Builder unsupervised run #2 收尾
- **狀態**：✅ 已升級到 [`docs/features/family-leaderboard.md`](../features/family-leaderboard.md) 的 **Phase 0: Prerequisite** 段（PM 2026-05-23 update）。FB session 接 #3 時會一併處理。本 backlog 條目保留為 audit trail，可在 #3 ship 後刪除

### B4 merge callable + 共用 code（永久 dormant，不要順手刪）
- **發現於**：2026-05-23、PM session 接 user「拿掉 merge」決定後
- **類型**：技術債 / dormant code（不是真的「待清理」）
- **重現 / 觀察**：B4 ship + rollback 後 production 還留：
  - `functions/src/index.ts` 的 `mergeAndImportToFamily` callable（無 client caller）
  - 內部搬子集合 + reassign petId + 刪 personal pet doc 的共用 helper
- **建議交付給**：無（不要動）
- **優先級提示**：P3（無 client caller = 零 production 風險）
- **PM 排序（2026-05-23 update）**：**永久 dormant**。原本規劃「併入 #4 dedupe 動工 session 處理」— 但 #4 已被 user 取消（見 `docs/features/mango-dedupe-migration.md`）。Backend session 之後若動 functions/src/index.ts 看到那段 dormant code，**不要順手刪**（保留供未來如真需要 dedupe 時 reactivate）

### Settings 沒加直接到 /onboarding 的 link
- **發現於**：2026-05-23、Feature Builder unsupervised run #2 收尾（spec deviations 段）
- **類型**：體驗 / 小事
- **重現 / 觀察**：#2 spec B2 line 93 寫「Settings 頁顯示『邀請家人 / 加入家庭』入口」—
  Feature Builder 認為既有 family-section 的「加入」「新建」buttons 已滿足，沒額外
  加 `/onboarding` 的明確 link。實際上 `/onboarding` 目前只有「第一次登入」會自動
  進去，使用者後續想看 onboarding 介紹頁要直接輸入 URL
- **建議交付給**：UI/UX 或 Feature Builder（補 1 行 Link 的事）
- **優先級提示**：P3（onboarding 後就不會看了；除非使用者明確想要 settings 入口）
- **PM 排序（2026-05-23）**：等下次 PM session 看是否歸入 Deferred（onboarding 頁
  本來就是首次體驗）

### [範例] 重複的 Mango pet
- **發現於**：2026-05-21、Bug Hunter session
- **類型**：bug / 資料殘留
- **重現 / 觀察**：`/app/pets` 顯示兩隻 Mango，因為 legacy 路徑曾建立兩次，
  migration 忠實搬了過來
- **建議交付給**：Bug Hunter（手動刪一隻即可）或 Backend（寫去重 migration）
- **優先級提示**：P2
- **狀態**：✅ 已升級 → `docs/features/mango-dedupe-migration.md`（PM 2026-05-22）。保留條目當教學範例。

---

## 已分類 — Bug Hunter 接

（PM session 從 Inbox 搬過來）

_目前沒有條目。下一個 PM session 過 Inbox 時新增。_

---

## 已分類 — UI/UX 接

### walks 頁加 sticky bottom CTA（解 A — user 2026-05-24 確認）
- **發現於**：2026-05-24、PM session push-back of user「按鈕移到下方」原始需求 → user 選解 A
- **類型**：體驗 / UI
- **重現 / 觀察**：User 原本想「把開始遛狗按鈕移到下方」，PM push-back 因為違反 walk-core spec 的「3 秒看到開始」核心 principle。User 選**解 A**：
  - **上方仍是 Hero 大按鈕「開始遛狗」**（保留 walk-core v1 設計，不動）
  - **新增 sticky bottom CTA「開始遛狗」**固定在 mobile viewport 底部，符合 iPhone thumb reach
  - Desktop 不顯示 sticky bottom（sidebar 已含 walks link，沒必要）
- **建議交付給**：UI/UX
  - 改 `src/app/app/walks/page.tsx`：加 sticky bottom button container（`fixed bottom-0 left-0 right-0 md:hidden` + safe-area-inset-bottom）
  - 按鈕跟既有 Hero 按鈕點擊行為相同（都觸發 walk-tracking-view 開啟）
  - 追蹤中 (tracking-view 開啟) 時 sticky bottom **隱藏**（已是 full-screen tracking）
  - 完成畫面 / 0-pet empty state / 0-寵物 disabled 狀態都對齊既有 Hero 按鈕邏輯
  - 沿用既有 i18n key `Walks.core.startWalk`（不新增）
- **優先級提示**：P2（user 主動要求；不擋其他工作；純 UI 加 layer）
- **PM 排序（2026-05-24）**：walks-v2 已 ship 完，這條接著做收尾 user 的「按鈕位置」需求；UI/UX session 可立即接，工作量 S

### Mobile bottom nav 重組：開銷→排行榜、更多按鈕→設定 link + 更多 drawer 移到設定右上角
- **發現於**：2026-05-23、PM session（user 主動要求 UI 小修）
- **類型**：體驗 / UI 重組
- **重現 / 觀察**：使用者要 mobile bottom nav 5 個 slot 改為：
  - 原 `[home, pets, walks, expenses, more (drawer button)]`
  - 新 `[home, pets, walks, leaderboard, settings]`
  - 原本 bottom 的「更多」drawer 觸發按鈕**移到 settings page 右上角**
  - Desktop sidebar 不變（仍 10 items 一字排開）
- **建議交付給**：UI/UX
  - 改 `src/components/nav/app-nav.tsx`：
    - `MOBILE_PRIMARY_KEYS` 從 `["home", "pets", "walks", "expenses"]` 改成
      `["home", "pets", "walks", "leaderboard", "settings"]`
    - 拿掉 mobile bottom bar 第 5 個 more button — 5 slots 全是 nav link 一字排
    - Drawer state + render 邏輯保留，但觸發點挪走（建議拆到共用 component 或 context）
  - `src/app/app/settings/page.tsx` 或 `src/components/nav/route-header.tsx` 在 settings
    頁加右上角 MoreHorizontal icon button → 點開既有 drawer
  - Drawer 內 overflow items（10 - 5 = 5 個）：feed / expenses / restaurants / knowledge / friends
  - 沒新 i18n key（沿用 Nav.more / Nav.settings / Nav.leaderboard / Nav.expenses 等）
- **優先級提示**：P1（user 主動要求；非阻擋家庭 epic 但 quick win）
- **PM 排序（2026-05-23）**：插隊 — UI/UX session 可立即接，不擋 #3/#6 family epic 收尾
- **⚠️ PM surface UX 觀察**（user 可重新評估）：「更多」drawer 觸發從 bottom nav 移到
  **settings 頁右上角** = 「進入 feed / expenses / restaurants / knowledge / friends」
  變**兩步操作**（先 tap settings → 再 tap more icon → 再 tap 目的地）。原本是一步
  （tap More）。
  - **Alternative**：把 more icon 放在每頁全局 header 右上角（`route-header.tsx`），
    每頁都是一步 tap，更接近標準 mobile app 慣例（漢堡/overflow menu 通常在頂部）
  - 本條目仍按 user 明確要求「設定的右上角」實作；UX 觀察留給 user 實測後決定要不要 redirect
- **✅ SHIPPED** `e34640a`（UI/UX session 2026-05-23 ~21:16 push、~21:22 App Hosting build 完成）
  - 5 files：新增 `src/components/nav/nav-drawer-context.tsx`、改 `app/app/layout.tsx`、
    `app-nav.tsx`、`route-header.tsx`（加 optional `action` slot）、`app/app/settings/page.tsx`
  - Drawer state 提升到 `NavDrawerProvider` (context)，AppNav 仍渲染 drawer，trigger 從
    bottom nav 挪到 settings page header 右上角
  - 驗證（Chrome MCP DOM probe，window maximized 無法縮 mobile viewport）：mobile 5 links
    `[/app, /app/pets, /app/walks, /app/leaderboard, /app/settings]`、`mobileButtonCount: 0`、
    drawer overflow 5 items `[feed, expenses, restaurants, knowledge, friends]` in
    `grid grid-cols-3`、desktop sidebar 10 links 不變、settings header trigger `aria-label="更多"`
    `md:hidden`、`dark:` classes 完整保留
  - Force-show mobile bottom nav 截圖確認 active state（home page → 首頁 amber 高亮）

---

## 已分類 — Feature Builder 接

### 未登入首頁 footer 連結文字硬編碼中文，沒走 i18n — ✅ SHIPPED
- **發現於**：2026-05-22、UI/UX session
- **狀態**：✅ SHIPPED `634e8c6`（Feature Builder 2026-05-23）— 加 `Common.privacy` / `Common.terms` (zh-TW + en)；`src/app/page.tsx` 改用 `getTranslations("Common")` 取代寫死字串。EN locale 從原本顯示「隱私權政策」改為「Privacy Policy」

---

## 已分類 — Backend 接

### 好友搜尋無法 case-insensitive / 中段 match — ✅ 已升級到 spec
- **發現於**：2026-05-22、Bug Hunter session
- **狀態**：✅ 已升級到 [`docs/features/friends-search-lowercase.md`](../features/friends-search-lowercase.md)（PM 2026-05-23）。
  動工順序見 roadmap「上架收尾 + backlog P2 epic」表 #5。中段 match 仍不在 spec 範圍（需 Algolia/Typesense）— 留 backlog 級觀察

_其他 Backend 項目見 `docs/roadmap.md` 的「下一個」與 `docs/features/mango-dedupe-migration.md`。_

---

## Deferred / 不做

> PM 決定不做的條目搬來這裡 + 寫理由。比刪掉好，下次有人想重提時直接擋下。

### [範例] 內建 QR scanner
- **理由**：iPhone / Android 原生相機都能掃 QR 並開 URL，App 內建 scanner
  增加 camera permission 摩擦 + bundle size，CP 值低。
