# 2026-10-05 發布與驗證紀錄

授權：使用者要求「合併 + push + 正式部署與驗證 接著繼續做」。
正式 Firebase 專案為 `mango-pet-app`，Firestore `(default)` 位於 `asia-east1`。
Backend 主 session；R06 由獨立 Web Bug Hunter session 實作。未修改依賴或 lockfile。

## 第一批：R01／R02／邀請碼限流

- `main` fast-forward 並 push 至 `5eec30b`；原有三份未提交文件保留，內容雜湊一致。
- 2026-10-05 22:36–22:37（Asia/Taipei）完成 Firestore rules 與五支 functions 選擇性部署：
  `exportUserData`、`deleteUserAccount`、`joinFamilyByCode`、`createFamily`、`regenerateInviteCode`。
- 五支均 ACTIVE、Node 22，最新 revision 接受全部流量。Rules 與本機該 commit 相符，
  正規化 SHA-256：`538f045b178bf0d6d9dda1add088b803bbc93f8eaec157198479343a768a42d6`。
- 真實 Firebase Auth 臨時匿名帳號 + 正式 rules/callable HTTP：**9 組通過**。
  涵蓋健康 CRUD 與拒絕路徑、匯出實際 membership／防 private 覆寫／無 inviteCode、
  換碼權限、guest 限制、client 無法重設 quota，以及兩種家庭刪帳授權路徑。
- 臨時帳號、測試家庭／寵物／quota 已清理；刪帳 audit 保留。未操作既有使用者資料。
- 正式一般帳號的 join 成功與額度耗盡仍以 emulator 為證；未驗 Storage 檔案刪除、
  強制 App Check、Safari／iOS 真機。家庭 fixture 由 Admin 建立。
- Push 自動觸發 App Hosting `rollout-2026-10-05-001`，已 SUCCEEDED；公開登入頁可載入。
  2026-10-05 22:54 檢查本批 functions 發布後 ERROR 日誌為 0。

## 接續批次：R04／R06／R10

| 項目 | 實作 commit | 行為 |
|---|---|---|
| R04 | `6194430` | 每人每目標一票；交易一次完成 vote/state/audit/hidden，事件重送不重複累計；兼容舊 audit |
| R10 | `37cd115` | Web/iOS 共用查詢分組，每組 15 名作者 × 2 種 visibility，避免超過 30 個 OR 分支 |
| R06 | `069bc0f` | Web 停止／自動停止立即保存固定 ID；未確認核心 draft 可恢復，摘要與晚完成照片更新同筆 |

整合後驗證：Functions build、Web typecheck、iOS typecheck 通過；**60 tests / 60 pass**：
Backend 36、雙端 feed 9、Web stop handler/draft 10、Web SDK walk persistence 5。
散步 emulator 曾因並行管理埠衝突異常退出；改獨立埠並乾淨重跑，5/5 通過且 CLI exit 0。
舊版對照已證明 R06 停止不保存、R10 超過 15 位好友查詢失敗。

此批正式發布與 smoke 結果將在發布完成後補記。目前這一節只確認實作與本機回歸。

詳細設計：[R04](../features/moderation-dedupe.md)、[R06](../features/walk-stop-save-fix.md)、
[R10 測試](../../tests/feed/README.md)。R10 iOS 程式碼須隨後續 App build 才能送達裝置。

## 後續界線

- R03 私人推播資料、R05 刪帳完整性、R07/R09 iOS profile 與首次推播權限、R19 CI 尚待修補。
- 六位邀請碼的多帳號猜測、檢舉的多帳號濫用與原始 report 建立頻率限制仍是後續工作。
- 60 項本機回歸不代表真實 GPS、iOS Safari／PWA 或原生裝置測試；UI 路徑須另行驗收。
- 原始全專案報告保留 `61f18e7` 的審查基準，不把尚未修補項目標為完成。
