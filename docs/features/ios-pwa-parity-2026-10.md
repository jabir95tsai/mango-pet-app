# iOS ↔ PWA 介面對齊 + 功能優化（2026-10）

狀態：**CODE DONE（215 / 222 項；3 項待 PM、1 項待 PM、3 項接受差異）— 待第二輪 review + 實機驗收**（iOS UI/UX + iOS Feature Builder，2026-10-08 ~ 10-10）
user 需求：「讓 iOS app 的介面按照 PWA 的介面實作，並優化功能」
branch：`ios-pwa-fidelity-2026-10`（**未 merge、未 push**）；`ios-pwa-fidelity-2026-10-wip` 已被吸收（TRACK / PETSB 半成品已完成並 commit），可刪除
worktree：`C:\Users\jabir\Hacker_J\mango_pet_app-ios-pwa`（node_modules 為 junction，拆除前先 `cmd /c rmdir`，見 memory reference_worktree_isolation_technique）
盤點資料 / 工具：[`docs/research/ios-pwa-gap-audit-2026-10/`](../research/ios-pwa-gap-audit-2026-10/)（逐項狀態：`status.json`）

> 取代 [`ios-uiux-fidelity-gaps.md`](./ios-uiux-fidelity-gaps.md)（2026-06）的逐頁 diff。Apple Glass 仍 DEFERRED，本輪不做。

## 1. 怎麼盤點的

- 10 個面向（SHELL / HOME / FEED / WALKS / TRACK / PETS / LEAD / SETTINGS / SOCIAL / XCUT）各一個稽核 agent，逐檔比對 `apps/web` 與 `apps/ios`，共 **222 項差異**（含 verifier 補抓）。
- 逆向核實只完成 HOME、SOCIAL；其餘面向由實作時逐項對照 code 確認，不存在就略過。
- 每項的 web/iOS 檔案行號、現況、目標、修法：`lane-*.json`；逐項狀態：`status.json`。

## 2. ✅ 已完成（每個 commit 都過 `npm run typecheck -w apps/ios` + `tools/check-keys.js .`；未實機驗、未做第二輪 review）

| Commit | Lane | 重點 |
|---|---|---|
| `64c4863` | 共用基礎（38） | UI primitives、Tab bar i18n、登入/訪客、語言切換、R08 家庭範圍、`Common.retry` |
| `41c1f94` | FEED + 寵物開銷/健康（34） | 動態訪客鎖定/反應/留言/composer、開銷圖表/編輯/刪除、收據掃描、相機元件 |
| `f31cb64` | TRACK（29） | 暫停/繼續、停止前確認、3 小時自動停止、GPS 提示、R16 啟動失敗狀態、session 持久化 + app 被殺後「繼續/結束並儲存」、停止即存 + 本地草稿 + 冪等 createWalk、recap 照片格/備註、**iOS 專屬「稍後再儲存」**（離線不再被全螢幕卡住） |
| `b4a16cc` | PETSB part 1 | 提醒編輯只在時間變動時重置 notified（防重複推播）、刪除寵物、表單欄位/預設對齊 web |
| `1dd2c01` | WALKS（14） | 最近紀錄列（刪除/遛狗人/縮圖）、寵物下拉（記住選擇）、手動補登起訖時間、下拉刷新、空狀態、達標紙花、iPad 寬度 |
| `b467cd2` | PETSB（16） | pets.tsx 接上開銷編輯/刪除與健康刪除、讀取失敗顯示重試、浮動寵物切換、sticky tabs、提醒摘要列、總覽提醒卡可操作、逾期顯示「N 天前」、0 寵物 hero；**遛狗 CTA / 寵物 FAB 位置修正（tab bar 是 in-flow，原本浮在 tab bar 上方 ~110pt）** |
| `dc30719` | SETTINGS + FAMACH（25） | **成就頁 + 設定入口**、設定卡片樣式/順序/訪客 gating、語言列、單次 users/{uid} 讀取 + 聚焦/下拉刷新、推播測試、刪帳號警示/影響摘要、家庭卡單一來源（`/family` 改為包裝）、建立/加入後的**匯入精靈** |
| `f30dd23` | HOME（17） | 讀取失敗重試、0 寵物 hero（加入家庭）、訪客 nudge + 發文改開升級、無貼文提示、「查看更多動態」、邀請卡/限動頭像/頂欄細節 |
| `a4637dc` | LEAD（14） | 家庭內列出全部成員、無家庭不閃 CTA、EmptyState 卡、**listener 只在 tab 聚焦且前景時啟用**、FlatList + 下拉刷新、glow 修正 |
| `d21db6c` | SOCIAL（24） | 好友訪客 gating/RouteHeader/錯誤顯示/icon 按鈕/QR 加 logo；照片「一鍵存全部未存」、卡片 footer、部分失敗 banner、FlatList、lightbox 只解碼前後一張、存圖原檔下載 + 權限一次 |
| `66eb9ec` | SHELL-8 | onboarding 建立/加入後開匯入精靈（共用 dialog，去重） |

新 i18n key 都同時加進 zh-TW / en（`packages/shared-i18n`），web 可直接沿用（見 §4）。

## 3. ⬜ 未完成

| 項目 | 狀態 | 說明 |
|---|---|---|
| WALKS-18 / TRACK-26 / XCUT-19（R11） | 待 PM | 每隻狗的進度/週旗/連續天數混算全家庭 walk；web 同樣行為，iOS 維持一致，等語意拍板後兩端一起改 |
| SOCIAL-M2 | 待 PM | App 內 QR 掃描（web 也沒有） |
| SETTINGS-6 / SHELL-16 | 接受差異 | web「更多」抽屜在 iOS 唯一目的地（照片）已可從設定照片卡進入；有第二個目的地時再做 |
| SHELL-23 | 不適用 | 重點 tab 回頂（相關畫面非 tab） |

另外：
- **第二輪 review 尚未做**（建議：對 `a640d33..HEAD` 跑一次 code review，重點看 TRACK 的 session/草稿/重試狀態機、leaderboard listener gating、photos 批次儲存）。
- **未實機 / simulator 驗證**：Windows 環境無 iOS simulator；本輪只有 TypeScript 靜態檢查 + i18n key 存在性檢查。

## 4. 需要決策 / 交接（不在本輪範圍）

| 項目 | 接手 | 說明 |
|---|---|---|
| R11 每隻狗進度混算全家庭 walk | Cross-platform PM | 見 §3 |
| FEED-23 iOS 貼文寵物標籤 chip 已移除 | PM | 若想保留，應成為雙平台功能 |
| 提醒摘要「本月已完成」語意 | PM | web 只算最近 24h 且僅家庭模式；iOS 算整個日曆月 |
| web 總覽「即將到期」卡的完成/刪除按鈕是 no-op | Web UI/UX | iOS 已接上（`use-reminder-actions`） |
| web `updateExpense` 忽略 items | Web Bug Hunter | `apps/web/src/lib/firebase/expenses.ts` |
| web 寫死字串可改用新 key | Web UI/UX | `Walks.page.dialGoal`（dial「分」）、`Walks.manual.errRequired/errEndAfterStart`、`PetsPage.stat.hoursAhead/daysAhead/hoursAgo/daysAgo/walkDaysUnit`、`Photos.titles.*`（web 目前英文）、`Home.notifications`、`Friends.add.sent/self/signIn`、`Feed.deleteConfirm` |
| iOS 推播點擊沒有路由（成就解鎖推播 deep link `/app/achievements`） | iOS Backend | 加 notification-open handler 時把它導到 `/achievements` |
| `app.json` `CFBundleLocalizations: ['zh-Hant','en']` | iOS Backend | 選配：讓原生 Apple 按鈕 / 權限提示跟隨 App 內語言 |
| 刪除 `ios-pwa-fidelity-2026-10-wip` branch | 任一 | 內容已全數吸收 |

## 5. 如何接續

1. 在 worktree `C:\Users\jabir\Hacker_J\mango_pet_app-ios-pwa`（branch `ios-pwa-fidelity-2026-10`）繼續。
2. 第二輪 review → 修正 → `npm run typecheck -w apps/ios` + `node docs/research/ios-pwa-gap-audit-2026-10/tools/check-keys.js .`。
3. merge 進 main（user 確認後）→ iOS PM 發一顆 EAS build 實機批次驗收（README 規則 5），重點：遛狗追蹤全流程（含 app 被殺後復原、離線儲存）、tab bar 上方 CTA/FAB 位置、成就頁、匯入精靈、照片批次儲存。
