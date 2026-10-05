# R04 — 檢舉唯一票數與事件冪等

日期：2026-10-05。角色：Backend / 資料工程師。
狀態：本地實作與 Emulator 驗證完成；正式發布由整合 session 執行。

同一位使用者換 auto ID 重複檢舉，以及 Firestore trigger 的重送，現在都只計一票。三位不同的合格檢舉者才會使新內容達到既有的 3 票隱藏門檻。Web / iOS 仍照原本格式建立 `reports/{reportId}`，原始檢舉全部保留。

## 資料與授權

| 路徑 | 欄位／用途 | 客戶端權限 |
|---|---|---|
| `reports/{reportId}` | 既有 reporterUid、targetType、targetId、targetAuthorUid、postId、reason、status、createdAt | 正式登入者以自己的 uid 新增；不可讀、改、刪 |
| `moderationAudit/{reportId}` | 原始 report 的處理結果、voteVersion=2、outcome、detail、當時的 reportCount | 全部拒絕 |
| `moderationVotes/{sha256}` | reporterUid、targetType、targetPath、firstReportId、legacy、createdAt | 全部拒絕 |
| `moderationTargetState/{sha256}` | targetType、targetPath、權威 reportCount、updatedAt | 全部拒絕 |
| `posts/{id}` 或 `posts/{id}/comments/{id}` | denormalized reportCount、hidden | 延用既有規則；票數與 hidden 仍由後端更新 |

vote key 是 `[reporterUid, targetType, canonical target path]` 的 SHA-256；comment path 包含 parent postId，因此不同貼文恰好使用相同 comment ID 時不互相吃掉票數。字串以 JSON array 編碼，避免串接分隔符碰撞。

目標必須存在、targetAuthorUid 必須與資料中的實際作者相符；貼文或留言的 parent post 必須允許 reporter 讀取（public、本人，或 author-owned friends 關係）。不符合的原始 report 仍留下 audit，outcome 為 ignored，不新增票數。使用者檢舉只記錄，沒有自動隱藏帳戶。

vote、target state、內容 count / hidden、audit 放在同一個 Firestore transaction。既有 audit 表示該 report 已處理，重送不覆寫原始 audit。trigger 啟用 retry，暫時性錯誤重新拋出；不合法的 report 以 ignored audit 結束，不進入無限 retry。

## 歷史資料相容

- 尚無 v2 state 的 target，第一次收到新的 report 時，從舊 moderationAudit 重建不同 reporter 的票數；原始 reportCount 曾可被重複投遞污染，因此不作權威來源。
- 重建只接受相同 target type / id / parent、相同實際作者、舊版已計票 audit；原始 audit 不改寫。重建後，舊 reporter 再送 report 仍不增加票數。
- 若歷史只有 reportCount、缺少 audit，不把無法驗證的數字當有效票數。原本 hidden=true 會保留，不自動撤回人工或歷史處置。必要時由管理者檢查原始 reports / audit 後決定恢復內容。
- 既有 audit 的讀取採單欄位 equality query，無新增 composite index。首次初始化讀該 target 的 audit；後續尚未記入 ledger 的 reporter 讀自己的歷史 audit。

## 驗證與發布

`functions/tests/moderation.test.cjs` 涵蓋重複 report、同事件併發／重播、多人併發、同 ID 重建後恢復權威處置、comment parent 隔離、缺目標／作者偽造／不可見目標／非法 path、正常 friends 報告、舊版重複 audit、未 seed 的舊 reporter、既有 hidden、user audit-only、交易失敗完整回滾、trigger retry 設定與錯誤拋出，以及客戶端拒絕存取所有 server-only 集合。

Functions build / typecheck 與 Web typecheck 為本地檢查。Emulator 的 trigger 測試直接呼叫 handler，沒有驗證正式 Eventarc 投遞、IAM、真實登入或 Web / iOS UI。

本次結果：`npm --prefix functions run build`、Functions `tsc --noEmit`、根目錄 `npm run typecheck`（Web）通過；乾淨的 localhost:8188 / demo-mango-security Firestore Emulator 上，完整 backend security suite **36/36 PASS**，其中本次新增 **14 組 R04**。獨立唯讀 reviewer 提出的同 ID 重建問題已修正並加入回歸。重跑完整 suite 需乾淨 Emulator，既有 health tests 會重用不可改 createdAt 的固定 ID；此限制不是新的 moderation 邏輯失敗。

發布 targets：先 `firestore:rules`，再 `functions:onReportCreated`。沒有 client、package、index 或資料搬遷部署。發布後用獨立合成貼文及三個合成正式測試帳戶確認相同 reporter 重送只一票、第三個 reporter 才隱藏，並檢查 function logs；避免對真實使用者內容製造檢舉。

## 保留限制

此修補以 Firebase uid 為一個檢舉者；多帳戶協同檢舉仍需後續濫用防護／人工處理。原始 reports 的提交頻率尚未限流，極大量歷史 audit 的惰性重建可能需要離線 migration。舊版已錯誤 hidden 的內容不會自動解鎖。刪除後以相同 Firestore ID 重建內容會沿用同 target 身分，下一份有效檢舉會同步權威 count / hidden，即使 reporter 已計票亦然；現有雙端新增皆使用新的 auto ID。
