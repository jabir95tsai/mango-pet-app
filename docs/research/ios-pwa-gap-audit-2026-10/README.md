# iOS ↔ PWA gap audit 2026-10 — 原始資料

進度與交接見 [`docs/features/ios-pwa-parity-2026-10.md`](../../features/ios-pwa-parity-2026-10.md)。

| 檔案 | 內容 |
|---|---|
| `lane-<LANE>.json` | 每條實作 lane 的差異清單（id、severity、web_ref、ios_ref、current_ios、target、fix_plan；HOME/SOCIAL 另有 verifier verdict / corrected_fix_plan） |
| `lanes.json` | 差異 id → lane 分配規則 |
| `status.json` | 每項狀態 done / skipped / todo（截至 commit `41c1f94`） |
| `foundation.md` | Phase A 共用元件、訪客、資料 hooks 的 API 與交接（Phase B agent 必讀） |
| `tools/phase-b.js` | Phase B Workflow 腳本（每 lane 實作 → review-and-fix；`args.lanes` 選 lane） |
| `tools/merge-i18n.js` | 將 agent 回報的新 key 合併進 `packages/shared-i18n`（不覆蓋既有值） |
| `tools/check-keys.js` | 檢查 `apps/ios` 內所有字面 `t("…")` key 在 zh-TW / en 都存在 |
| `tools/build-lanes.js` | 從 workflow journal 重建 lane 檔（只在重新盤點時需要） |

⚠️ `status.json` 的 HOME-1 / WALKS-2 / PETS-1 顯示 todo，但 hook 層已由 Phase A（A3）完成，剩各畫面的下拉刷新 / 錯誤 UI 接線。
