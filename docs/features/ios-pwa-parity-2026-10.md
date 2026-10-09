# iOS ↔ PWA 介面對齊 + 功能優化（2026-10）

狀態：**IN PROGRESS — 約 35% code done（77 / 220 項）**（iOS UI/UX + iOS Feature Builder，2026-10-08 ~ 10-10）
user 需求：「讓 iOS app 的介面按照 PWA 的介面實作，並優化功能」
branch：`ios-pwa-fidelity-2026-10`（**未 merge、未 push**）；中斷的半成品在 `ios-pwa-fidelity-2026-10-wip`
worktree：`C:\Users\jabir\Hacker_J\mango_pet_app-ios-pwa`（node_modules 為 junction，拆除前先 `cmd /c rmdir`，見 memory reference_worktree_isolation_technique）
盤點資料 / 工具：[`docs/research/ios-pwa-gap-audit-2026-10/`](../research/ios-pwa-gap-audit-2026-10/)

> 取代 [`ios-uiux-fidelity-gaps.md`](./ios-uiux-fidelity-gaps.md)（2026-06）的逐頁 diff：那份宣稱已關閉的項目，本輪重新對照 code 盤點，連同 web 6 月後新增的功能（訪客模式、成就、走路草稿、UGC 檢舉等）一併納入。Apple Glass 仍 DEFERRED，本輪不做。

## 1. 怎麼盤點的

- 10 個面向（SHELL / HOME / FEED / WALKS / TRACK / PETS / LEAD / SETTINGS / SOCIAL / XCUT）各一個稽核 agent，逐檔比對 `apps/web` 與 `apps/ios`，共 **220 項差異**（含 verifier 補抓 4 項）。
- 逆向核實只完成 HOME、SOCIAL（0 項被推翻，4 項修正修法）；其餘 8 面向的核實因使用量上限中止 → 改由實作 agent 動手前自行對照 code 確認，不存在就略過。
- 每項的 web/iOS 檔案行號、現況、目標、修法：`docs/research/ios-pwa-gap-audit-2026-10/lane-*.json`；逐項狀態：`status.json`。

## 2. ✅ 已完成（code done + `npm run typecheck -w apps/ios` 通過；未實機驗、未做第二輪 review）

### Commit `64c4863` — Phase A 共用基礎（38 項）
- **UI primitives**（`apps/ios/src/components/ui`）：RouteHeader、Dialog（鍵盤安全的 bottom sheet、reduced-motion）、Input / Textarea / Field、Tabs（簡單 toggle、無滑動 indicator）、IconButton、EmptyState card 變體；Button / Avatar 對齊 web button.tsx / avatar.tsx；`lib/confirm.ts`（confirm / alertError）。
- **Tab bar**：標籤改 `Nav.*` i18n key（英文裝置不再顯示中文）、tab/tablist a11y role。
- **登入 / 訪客**：登入頁對齊 web landing，新增「以訪客身分繼續」（App Store 審查備註依賴此按鈕）；取消 Google/Apple 登入不再跳錯誤；GuestUpgradeProvider + 升級提示 banner + GuestLockedNotice；未登入點 `/join/{code}` 登入後會接續加入；profile 錯誤畫面樣式 + i18n；Join / Onboarding 視覺。
- **語言切換**：執行期切換繁中 / EN（AsyncStorage 保存）+ LanguageSwitcher 元件（設定頁尚未掛上，見 §3）；切換後回到原畫面。
- **R08 家庭範圍**：FamilyContext 成為唯一 scope 來源；walks / pets / feed / health hooks 改吃 context、丟棄過期回應、錯誤不再偽裝成「沒有資料」、切回 tab 自動重抓、提供 `refresh()`。
- **i18n**：新增 `Common.retry`（**順帶修好 web `walks/page.tsx:504`、`walk-tracking-view.tsx:1086` 同樣的 missing-key 顯示**）等 5 個 key。

### Commit `41c1f94` — Phase B 第 1 批：FEED + 寵物開銷/健康（34 項 + 相機元件）
- **動態（FEED-1~23 + HOME-12 + XCUT-9/10）**：訪客鎖定互動、RouteHeader + 發文 CTA、空/錯誤/載入狀態 + 下拉刷新、FlatList 虛擬化 + memo PostCard、反應切換/同步修正、SmilePlus 反應盤、留言泡泡 + 刪除確認/失敗回滾、composer 改 Dialog（lucide 可見度 chip、部分照片上傳失敗不重複發文）、檢舉補備註欄、lightbox 防連點存圖 / 點背景關閉 / reduced-motion、`relativeTime` 依語系且與 web date-fns 輸出一致（2,640 組比對 0 差異）。
- **寵物開銷 / 健康（PETS-4~8, 14~18）**：月合計 + 月增減 chip、donut + 圖例、開銷編輯/刪除、健康紀錄刪除、開銷表單（AI 預填、明細、編輯模式）、收據掃描（相簿選圖、預覽重拍、權限導設定）、健康表單日期欄、lucide icon、web 分類色。
- **相機元件**：可選全螢幕呈現、i18n、權限被拒時導向設定（向下相容）。

## 3. ⬜ 未完成（143 項：P0 12 / P1 88 / P2 43）

| Lane | 未完成 | 內容 | 備註 |
|---|---|---|---|
| TRACK | 29 | 遛狗追蹤：暫停/繼續、停止確認、儲存後 recap、草稿復原、R16 啟動失敗仍顯示記錄中、session 持久化、照片上傳中被丟、3 小時自動停止、GPS 狀態提示 | **最高優先**（核心）。WIP branch 有大量半成品（`walk-tracking-view` 重構 + 7 個新 `tracking-*` 元件 + `walk-drafts.ts`），**不能 typecheck**，接手時評估沿用或重做 |
| WALKS | 14 | 遛狗主頁：最近紀錄列（刪除/遛狗人/縮圖）、下拉刷新、寵物選擇器、手動補登起訖時間、空狀態、目標達成紙花 | hook 層刷新已由 A3 完成，畫面接線待做；依賴 TRACK |
| PETSB | 16 | 寵物頁殼：**pets.tsx 接上 PETSA 的開銷編輯/刪除、健康刪除**、錯誤/重試、浮動切換面板、sticky tab、FAB 位置、提醒摘要列、逾期「-1 天前」、總覽假按鈕、刪除寵物、提醒編輯重置 notified（可能重複推播）| PETSA 的新 props 都是 optional，目前不接線也能運作，只是看不到編輯/刪除入口 |
| HOME | 17 | 首頁：0 寵物 hero、加入家庭 CTA、無貼文提示、查看更多、訪客提示 banner、邀請卡、錯誤/刷新 | |
| SETTINGS | 18 | 設定頁順序/卡片樣式、**成就入口卡**、**掛上語言切換**、訪客顯示鎖定卡而非隱藏、推播狀態、刪帳號鍵盤遮擋、匯出/封鎖名單 | |
| FAMACH | 7 | 家庭卡對齊 + 去重 `family.tsx`（450 行重複）、**匯入個人資料精靈**（既有 callable，不需改後端）、**成就頁** | Onboarding 已留 `SHELL-8 HOOK POINT` |
| LEAD | 14 | 排行榜：家庭範圍漏列未遛狗成員、載入閃爍、glow 失效、離開 tab 時暫停 listener、FlatList、錯誤 vs 計算中 | |
| SOCIAL | 24 | 好友（訪客鎖定、RouteHeader、icon 按鈕、我的 QR）與照片圖庫（**一鍵存全部未存**、卡片 footer、篩選樣式、空/部分錯誤、FlatList、批次存權限只問一次） | |

另外：
- **所有已完成 lane 尚未做第二輪 review**（Phase B 腳本內建 review-and-fix stage，本輪因額度未跑）。
- **未實機 / simulator 驗證**：Windows 環境無 iOS simulator；本輪只有 TypeScript 靜態檢查 + i18n key 存在性檢查。
- Phase A 交接中尚未落地：各畫面改用 RouteHeader / Dialog / EmptyState / confirm()（列在 `foundation.md` handoffs）。

## 4. 需要決策 / 交接（不在本輪範圍）

| 項目 | 接手 | 說明 |
|---|---|---|
| R11 每隻狗進度混算全家庭 walk（WALKS-18 / TRACK-26 / XCUT-19） | Cross-platform PM | web 同樣行為；iOS 維持一致，等語意拍板後兩端一起改 |
| FEED-23 iOS 貼文的寵物標籤 chip 已移除（web 沒有） | PM | 若想保留，應成為雙平台功能 |
| SOCIAL-M2 App 內 QR 掃描 | PM | web 也沒有，未做 |
| web `updateExpense` 忽略 items（編輯明細會遺失） | Web Bug Hunter | iOS 已在編輯時寫入 items；見 `apps/web/src/lib/firebase/expenses.ts` |
| web 刪除無文字貼文的確認文案寫死「貼文」 | Web UI/UX | 可改用新 key `Feed.deleteConfirm` |
| `app.json` `CFBundleLocalizations: ['zh-Hant','en']` | iOS Backend | 選配：讓原生 Apple 按鈕 / 權限提示跟隨 App 內語言 |

## 5. 如何接續

1. 在 worktree `C:\Users\jabir\Hacker_J\mango_pet_app-ios-pwa`（branch `ios-pwa-fidelity-2026-10`）繼續。
2. 決定 TRACK/WALKS/PETSB 從 WIP 接續或重做：`git diff ios-pwa-fidelity-2026-10 ios-pwa-fidelity-2026-10-wip -- apps/ios/src/components/walks apps/ios/src/lib`。
3. 跑剩餘 lane：`docs/research/ios-pwa-gap-audit-2026-10/tools/phase-b.js` 為 Workflow 腳本，`args: {"lanes": ["WALKS","PETS"]}` 選 lane（每批 ≤3 條，避免撞使用量上限）。完成後用 `tools/merge-i18n.js` 合併 agent 回報的新 key、`tools/check-keys.js` 檢查 key 存在。
4. 全部 lane 收齊 → review-and-fix → `npm run typecheck -w apps/ios` → merge main → iOS PM 發一顆 EAS build 實機批次驗收（README 規則 5）。
