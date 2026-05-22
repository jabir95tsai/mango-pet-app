# Reminder 完成歸屬顯示

狀態：READY-FOR-DEV
建立日期：2026-05-22
最後更新：2026-05-22
規格作者：PM session @ 3298731

## User Story

作為**家庭成員**，我想在 reminder 完成後看到「由誰、什麼時候勾掉的」，因為**家裡有人勾了但沒口頭通知時，我會懷疑這件事到底有沒有做、要不要再做一次**。

## 為什麼是現在做

- `createdByUid`（誰建的）attribution UI 在 Phase 4 已上線 — `doneByUid`（誰勾的）是同一條設計線的收尾，使用者拿到一半會奇怪「為什麼建立有寫誰，完成沒有」
- reminder 資料量還小，schema 加 2 個 optional 欄位幾乎零 backfill 成本；越晚做家庭累積越多歷史 reminder，越尷尬
- 工作量 S，是 sprint 內塞得下、value 又高的「補完型」改動

## 完成標準

- [ ] reminder schema 新增兩個 optional 欄位：
  - `doneByUid?: string`（勾掉的 user uid）
  - `doneAt?: Timestamp`（勾掉的時間）
- [ ] 使用者勾掉 reminder 時：
  - [ ] `doneByUid` 寫入當前登入使用者 uid
  - [ ] `doneAt` 寫入 `serverTimestamp()`
  - [ ] 已存在的 `sent` / `notified` / done flag（依現有命名）邏輯不變
- [ ] 使用者**取消勾選**時：兩個欄位都清為 `null`/不存在（不留髒資料）
- [ ] reminder-card.tsx 在已完成狀態下顯示：
  - 「✓ 已完成 — by {displayName} {relativeTime}」（zh-TW）
  - 「✓ Done by {displayName} {relativeTime}」(en)
  - displayName 從 family members context 解析（避免每張 card 都 fetch user doc）
  - relativeTime：「2 小時前」/「2 hours ago」（用已存在的 i18n 相對時間 helper，若無則加一個簡單版本）
- [ ] 找不到 displayName（成員已退出家庭）→ 顯示為「（已離開的成員）」/「(former member)」，不爆 UI
- [ ] 找不到 `doneByUid` 但有 done flag（舊資料）→ 顯示「✓ 已完成」不帶 by，不爆 UI
- [ ] i18n：zh-TW + en 兩個 locale 文案齊
- [ ] Edge case：本人勾自己建的 reminder → 仍顯示 by 自己（保持資料一致性，不特例化）

## 成功指標（上線後一週看）

- 上線後 3 天內，**測試家庭**至少 5 個 reminder 被勾，**100%** 都有 `doneByUid` 寫入
- 質性：家庭內測試者回饋「現在知道老婆/家人有沒有餵」或「不會再重複餵」

## 不在這次範圍

- reminder 歷史紀錄頁面（「過去 30 天勾掉的清單」）
- 統計 dashboard：「這週誰勾最多」
- 推播：「Jabir 剛勾掉了『餵藥』」
- backfill 舊 reminder 補 doneByUid（沒辦法回溯，且舊資料量少）
- 撤銷完成的權限控制（家庭成員都可以勾、也都可以取消，沿用現有權限）

## 技術筆記（給 Feature Builder 參考）

- 接近的已實作功能：
  - `src/lib/firebase/reminders.ts` — reminder CRUD
  - `src/components/reminders/reminder-card.tsx` — reminder UI 列表項
  - `src/components/reminders/reminder-form-dialog.tsx` — 建立/編輯（這條 spec 不動）
  - `src/components/family/family-provider.tsx` — 取 members displayName
- 新 type / collection：
  - 動 `src/lib/types.ts` 裡 reminder type，加 `doneByUid?` + `doneAt?`
- 新 security rule 需求：
  - reminder write 規則應已允許家庭成員寫 → 沿用，不動
  - 但要檢查 update 時 `doneByUid` 是否強制等於 `request.auth.uid`（不能代別人勾），這條建議加 rule guard
- 新 index 需求：無
- 對 Backend / Migration 的依賴：無
- 相對時間 helper：如果現有 codebase 沒有，可暫用 `Intl.RelativeTimeFormat`（瀏覽器原生）

## 開放問題

- [ ] reminder 目前用什麼欄位記「已完成」？是 `sent`、`completed`、`done`？（Feature Builder 開工先讀 `src/lib/firebase/reminders.ts` 確認；spec 不假設名稱）
- [ ] 取消勾選的 UI 路徑是否現存？如果現存，沿用；如果不存在，本 spec **不負責新增**取消勾選的 UI（但邏輯要寫好讓未來易加）
- [ ] 「relativeTime」要 live tick 嗎（每分鐘自動更新「N 分鐘前」）？建議：不要，重新整理才更新（簡化）
