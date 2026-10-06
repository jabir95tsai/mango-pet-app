# R06 草稿恢復收尾

2026-10-06，Web Bug Hunter，接續 [停止即保存](walk-stop-save-fix.md)。

修正兩個剩餘路徑：無法保存的草稿原本只能一直重試；離線停止後也沒有 reconnect 觸發器。

- 停止摘要：離線→上線後自動重試原 walkId。若已有請求在執行，等待其結果；僅失敗時再補一次，不平行保存、不設重試計時迴圈。
- 返回遛狗頁：當下連線時自動處理一次目前帳號的本機草稿；離線則等待 reconnect。單筆失敗不會阻擋後續草稿。持續失敗者仍顯示錯誤、手動重試與單筆捨棄。
- 捨棄前使用既有確認視窗，確認期間暫停自動／手動重試；保存進行中不能捨棄。確認後僅移除本機草稿，完全不呼叫 Firestore delete。已在伺服器的 walk 保留。
- 本機留下 `mango.walks.discarded.v1.<uid>.<walkId>` 記號（僅 ID，沒有 GPS／照片內容），防止舊 callback／分頁重建同筆草稿。這不是伺服器取消操作；其他分頁已送出的請求仍可能完成，已保存紀錄不因此刪除。
- 切換帳號／開啟新一輪會使舊 UI 操作失效。舊回應不能標記新一輪成功；舊捨棄確認不能移除新帳號草稿；舊批次不再發出後續保存。已確認的舊請求仍可以清理它自己的已保存 draft。

連線訊號只用來觸發嘗試，不當成 Firebase 可用或保存成功的證據；仍以原本的 SDK 回應判定成功。依 [MDN online event](https://developer.mozilla.org/en-US/docs/Web/API/Window/online_event) 的界線，保留可手動重試的入口。

驗證：

- `node --test apps/web/scripts/walk-save-regression.test.cjs`：24/24。含既有 10 項與新增 14 項實際 TSX handler／本機儲存測試：當頁 reconnect、in-flight 排一次重試、永久失敗無迴圈、捨棄取消／確認／競爭、晚到保存、帳號切換、返回頁批次恢復／隔離與捨棄記號。
- `npm run typecheck -w apps/web`、`npm run typecheck -w apps/ios`：通過，後者確認新增 Walks 共用字串相容。
- 設 `WALK_SAVE_BASELINE_REF=248686f` 只跑 `offline stop retries the same snapshot once after reconnect`：舊版在連線恢復後仍只有 1 次保存嘗試，期望 2 次，確實失敗；不修改 checkout。
- SDK 資料層、Firestore rules／functions／schema／依賴未變更；沿用先前交易與正式 smoke 結論，不將此次 handler 測試冒稱為新一次正式保存或 GPS 實測。

部署後仍需瀏覽器／Safari PWA 驗收：離線停止後連回網路；重整後重新連線；不可保存草稿取消／確認捨棄；切帳號後舊回應不污染畫面。當頁未保存的後續備註／照片依然沒有跨重整 draft；localStorage 不可用時依然不能保證跨重整恢復。
