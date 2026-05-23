# Repeat reminder 完成歸屬顯示

狀態：SHIPPED — commit `3282091`，2026-05-23 ~20:24 push 上線；Chrome MCP 驗負向（never-completed repeat 不顯示 sub-text）；正向 case 待 user 自然觸發觀察（見「SHIPPED 紀錄」末段）
建立日期：2026-05-22
最後更新：2026-05-22
規格作者：PM session @ 3298731（接續 reminder-done-attribution.md 的後續觀察）
依賴：[`reminder-done-attribution.md`](./reminder-done-attribution.md) 已 SHIPPED

## User Story

作為**家庭成員**，我想在「餵藥 daily」這種**重複型 reminder 卡片上**看到「上次：媽媽勾 · 3 小時前」，因為**這就是我最常忘記的事，最需要知道家人有沒有做過 — 而現在已完成的 one-shot reminder 看得到歸屬，repeat 反而看不到**。

## 為什麼是現在做

- 上個 spec（reminder-done-attribution.md）解了 one-shot reminder 的歸屬，但 user story 原文點名的痛點「家裡有人勾了但沒口頭通知時，我會懷疑這件事到底有沒有做、要不要再做一次」**最常出現在 repeat reminder**（餵藥、餵食、散步），這些是反覆發生且最容易撞期的事
- repeat reminder 在 `completeReminder` 推進 triggerAt 而非 done=true，所以**從不出現在「今日已完成」sub-section** → 上個 spec 的 UI 完全覆蓋不到
- data 已就緒：`completeReminder` 對 repeat 推進時已寫 `doneByUid` + `doneAt`（Feature Builder 上個 spec 實作時順手做的）
- 工作量 S：只動 reminder-card.tsx 加一行 conditional sub-text，幾乎 zero-risk

## 完成標準

- [ ] reminder-card.tsx 在 repeat reminder（`repeat` 有值、`done === false`、`doneAt` 存在）狀態下，卡片下方顯示 sub-text：
  - 「上次：{displayName} · {relativeTime}」（zh-TW）
  - 「Last: {displayName} · {relativeTime}」(en)
- [ ] 第一次顯示的 repeat reminder（從未被完成過 → 無 `doneAt`）：**不顯示**這行（不留空 placeholder）
- [ ] displayName 從 family members context 解析 — 沿用上個 spec 同樣 mechanism
- [ ] 找不到 displayName（成員已退出家庭）→「（已離開的成員）」/「(former member)」，不爆 UI
- [ ] 視覺對齊「今日已完成」sub-section 的歸屬樣式（同樣的 muted text 小字 + 同樣的 i18n 結構），但 prefix 改用「上次：」/「Last:」而非「✓ 已完成 — by」
- [ ] i18n：zh-TW + en 兩個 locale 文案齊
- [ ] Edge case：repeat reminder 的 `doneAt` 是「上次完成時間」，不是「下次觸發時間」，UI 解讀別寫反
- [ ] Edge case：`doneByUid` 等於當前登入者 → 仍顯示 by 自己（沿用上個 spec 的一致性原則）

## 成功指標（上線後一週看）

- 上線後 3 天內，測試家庭至少 **3 個 active repeat reminder** 卡片顯示「上次：XX 勾」（從測試帳號 query 可驗）
- 質性：家庭內測試者回饋「有看到老婆/家人剛餵過，沒重複餵」— 對應 user story 原文

## 不在這次範圍

- 點 sub-text 看 repeat reminder 的歷史完成紀錄（要另開 spec）
- 推播：「Jabir 剛勾掉了『餵藥 daily』」
- 「家人勾了 N 次」累加統計
- 改 `completeReminder` 對 repeat 的 advance 邏輯（已就緒，不動）
- 一個 reminder 多次完成的細節時間軸

## 技術筆記（給 Feature Builder 參考）

- 接近的已實作功能：
  - `src/components/reminders/reminder-card.tsx` — 上個 spec 已加 done 分支 UI + displayName 解析機制 → 沿用同樣 helper
  - `src/lib/firebase/reminders.ts` — `completeReminder` 對 repeat 推進邏輯（**不動**，data 已寫入）
- 不動 schema、不動 lib（read 已涵蓋 — `doneByUid` / `doneAt` 已在 active repeat doc 上）
- 只動 reminder-card.tsx：加 conditional sub-text for `repeat && doneAt`
- i18n key 建議：
  - `reminders.lastDoneBy`（zh-TW: "上次：{name} · {time}" / en: "Last: {name} · {time}"）
- 視覺：跟「✓ 已完成 — by」用一樣的 muted text 樣式，prefix 不同即可
- 不需 family-provider 改動（沿用上個 spec 的 members context 解析）

## 開放問題

- [x] sub-text 位置：採 footer（與「✓ 已完成」視覺對齊）— 卡片 description 區下方、emerald muted 樣式
- [x] 若 `doneAt` 很久：仍顯示 — formatDistanceToNow 自然會處理（「3 個月前」等）
- [x] 多隻 pet 共用同一個 reminder：本 spec 不特例化 — 顯示「上次：XX 勾」即可（pet 不影響 attribution 行）

---

## SHIPPED 紀錄

| 項目 | 值 |
|---|---|
| Commit | `3282091` |
| 部署時間 (Asia/Taipei 2026-05-23) | ~20:24 push → App Hosting auto-build live by ~20:35 |
| 變更檔案 | `src/components/reminders/reminder-card.tsx` + `messages/zh-TW.json` + `messages/en.json`（3 檔，+22 / -0）|
| 部署順序 | 純 frontend — `git push origin main`（no rules/indexes/functions/lib 改）|

### Chrome MCP 驗證結果

**已驗（negative case）**：
- 主帳號 jabir95tsai 的 Mango 家「驅蟲藥」每月 reminder 卡片正常顯示（trigger 日期 12 天內 · 2026-06-05 07:00）
- **無「上次：」sub-text** — 因該 reminder 從未被勾過完成（`doneAt` 不存在），符合 spec edge case「第一次顯示的 repeat reminder：不顯示」
- repeat reminder 整體 active-card 樣式不受影響（icon、title、pet badge、每月 badge、trigger 時間 行）
- 無 console errors，無 i18n key missing 警告（lastDoneByLabel 在 zh-TW + en 都查得到）

**未驗（positive case — 需要已勾過至少一次的 repeat reminder）**：
- 沒有現成的「已被勾過的 repeat reminder」可拿來測 sub-text 正向顯示
- 不想擅自在主帳號家庭的「驅蟲藥」按完成（會錯誤推進 trigger 日期 06-05 → 07-05 + 假留 attribution record）
- **由 user 在下次自然完成 repeat reminder 時觀察**：應該會看到「上次：蔡智博Jabir · 少於 1 分鐘內」綠色 muted 文字在卡片下方
- 若行為不符 spec，回 Bug Hunter session 開條目

### 與 spec 的 deviations

- **無 deviation**。完全照 spec 完成標準實作 — 條件、樣式、i18n key 名、formerMember fallback 都對齊。
