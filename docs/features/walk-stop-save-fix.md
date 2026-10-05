# R06：Web 停止散步即保存

2026-10-05，Web Bug Hunter 實作；對應 `docs/research/project-review-2026-10-05.md` R06。

原流程只在停止時切到摘要，直到返回／排行榜／拍照 CTA 才寫入，因此停止後跳過照片並重整會遺失紀錄；`null` 保存結果也被誤判成功。

現在手動停止確認與三小時自動停止都立即保存核心紀錄，保存前不顯示完成慶祝或分享提示。失敗留在摘要並提供重試；每輪固定寵物、家庭保存 callback、時間與預鑄 walkId，多次點擊合併為一個保存工作。成功後的備註與晚完成照片只更新同筆 walk 的 `notes`、`photoURLs`。

預鑄 ID 使用 transaction create-if-absent；重試不覆寫 `createdAt` 或後來的摘要編輯。既有 ID 的 walker、pet、family、開始／結束時間不一致會拒絕。開始散步的訪客、關閉拍照提示及一般入口皆先預鑄 ID，再開 tracker；手動補登使用獨立 ID。

已停止但未得到伺服器確認的核心紀錄保留於本機 `mango.walks.pending.v1.<uid>.<walkId>`，返回遛狗頁後可重試，日期與原家庭範圍一併還原。只列出目前登入帳號的 draft；多筆 draft 不互相覆蓋。伺服器確認後移除。localStorage 不可用時仍嘗試線上保存，但無跨重整恢復能力。這不是追蹤中路線的背景備份；未按停止前的瀏覽器／OS 關閉不在本次範圍。

驗證：

- `npm run typecheck -w apps/web`：通過。
- `npm run typecheck -w apps/ios`：通過（新增共用翻譯字串的使用端檢查）。
- `node --test apps/web/scripts/walk-save-regression.test.cjs`：10/10 通過。執行真正 TSX handler，以小型 hook scheduler 與平台替身涵蓋取消、即時保存、null／失敗重試、連點、備註失敗阻擋離開、晚完成照片、多狗／新一輪狀態重設、自動停止、本機 draft 與 idempotent persistence。
- 指定 `WALK_SAVE_BASELINE_REF=5eec30b` 並只跑 `confirmed stop saves immediately`：舊 TSX 確實失敗，停止後保存呼叫數為 0，期望為 1；沒有覆寫 checkout。
- `FIRESTORE_EMULATOR_HOST=127.0.0.1:8190 node --test apps/web/scripts/walk-save-emulator.test.cjs`：5/5 通過。實際 Firebase Web SDK + 本分支 `firestore.rules`，使用 `demo-mango-walk-save`；測試後清除自己建立的 fixture。涵蓋重試保留摘要／建立時間、同 ID 不同 metadata 拒絕、其他 auth UID 拒絕、同家庭他人成員 walk 不誤認成功、並行重試及兩隻狗的獨立紀錄。
- 實作時尚未執行真實瀏覽器 GPS、iOS Safari／PWA 或 production 寫入流程；其後已完成正式 Web SDK 保存／摘要更新／重試 smoke，詳見[發布驗證紀錄](../research/release-validation-2026-10-05.md)。GPS／瀏覽器完整停止流程與真機仍待驗收。

恢復界線：核心紀錄得到確認後即移除 draft；之後新增但尚未成功寫入的備註／晚完成照片沒有獨立的跨重整恢復 draft。當頁仍以失敗提示、重試與離開警告保護；不可把本次核心紀錄恢復解讀成所有摘要編輯都已持久化。

部署後交接：Web Bug Hunter 以 disposable pet 驗證「開始→停止→跳過照片→重整」僅一筆，另驗證離線停止後重新連線重試、摘要備註與拍照上傳；不操作既有真實寵物資料。此修補無 Firebase rules／functions／schema 或 dependency 變更，只需要 Web rollout。
