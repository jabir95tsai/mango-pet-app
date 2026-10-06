# R05：刪帳 checkpoint 與一般 callable 寫入

2026-10-06，Web Bug Hunter；基線 `77b0ce5`。接續 Backend 的刪帳 checkpoint／清理流程，未修改 `deleteUserAccount`、匯出或新增清理 trigger。

原本 Firestore client rules 即使拒絕刪帳帳號，Admin SDK callable 仍可在較早讀取完成後，用 batch 重建 profile、家庭或好友子文件。單次函式入口檢查不能阻止這個競爭。

## 修正範圍

- `account-mutation.ts` 的共用 helper 在每次實際寫入的同一個 transaction 讀取 `deletedAccounts/{uid}`。任何狀態的 checkpoint 都拒絕寫入；profile 缺少本身不代表刪帳，舊 native 首次登入直接建立家庭的 API 維持可用。
- `createFamily`、加入家庭（含限流紀錄）、接受／移除好友、離開家庭、更新邀請碼、移除成員、清理自己的孤立散步：所有寫入及 audit 寫入改用 guard transaction。寫入對方 profile／好友子文件、轉交 owner 時，同交易也檢查該目標帳號。
- `importPersonalToFamily`／`mergeAndImportToFamily`：每個 400 筆 import chunk、200 筆健康紀錄 move chunk、寵物刪除與最後 audit 都重新檢查 checkpoint 及目前家庭成員資格；重新讀取被搬移文件與父寵物。目的寵物的 owner 已開始刪帳時也拒絕合併。
- `autoFriendFamilyMembers`：helper 同交易讀兩側 checkpoint、profile、好友文件及最新家庭成員。晚到事件不能重建已刪帳或已離家的帳號子文件；並行事件只建立一次。
- `sendTestPush`：入口及取得 tokens 後檢查 checkpoint，避免用已凍結帳號發送。FCM 與 Firestore 無法共用交易；最後檢查後才開始的刪帳仍可能與傳送重疊。R03 token 清理本身有交易 guard，不會重建 profile／contact。
- admin-only `cleanupLegacyPaths` 每個帳號開始前跳過已有 checkpoint 者；此舊工具只刪資料，不重建 profile。其餘 admin migration／achievement guard 由本批 Backend 交付。

## 競爭邊界

checkpoint 與受保護的寫入會依 Firestore transaction 序列化：若寫入先完成，後開始的 cascade 能讀到這批資料；若 checkpoint 先完成，交易拒絕或重試後拒絕。多批操作並非整個 callable 原子化，已完成批次不回滾，後續批次停止；刪帳流程負責清掉先前批次。

本次不取消已送出的 FCM，也不宣稱 client guard 能管到明確使用 Admin SDK 的人工工具。部署前已啟動的舊版 function invocation 仍可能使用舊程式，需待舊 invocation 結束後才驗收整批刪帳邊界。此 commit 必須與同批 R05 checkpoint、client／Storage rules、late achievement guards 一起整合。

## 驗證

- `npm run build --prefix functions` 通過。
- Firestore emulator（Java 21、Firebase CLI 15.32.1、`127.0.0.1:8196`、demo project）完整既有與新增 suite 第一輪 **59/59**；最後補上 FCM 查 token 後 guard 與實際 auto-friend handler 後，專項 **14/14**。
- 專項使用實際 Admin SDK 與 callable `.run()`：三種 checkpoint 狀態、缺 profile 正常建立、雙方好友、每個一般 mutation seam、401 筆 import 的批次間刪帳、merge 途中刪帳、目的 owner 刪帳、正常 merge、晚到與並行 auto-friend、同 checkpoint transaction 競爭。FCM transport 使用 stub，未發送通知。
- 以 `git show 77b0ce5:functions/src/family-join.ts` 載入舊 helper，對已存在 `complete` checkpoint 的本機帳號執行相同拒絕斷言：出現 `Missing expected rejection`，證明舊版可繞過；不修改 checkout。
- 沒有部署、正式 Firebase 寫入、瀏覽器登入／GPS 或 APNs 驗收。Functions emulator 未啟動；trigger 以實際 handler 直接呼叫，未宣稱 Eventarc delivery 驗證。

部署時受影響 functions：`purgeMyOrphanWalks`、`acceptFriendRequest`、`removeFriend`、`sendTestPush`、`createFamily`、`joinFamilyByCode`、`leaveFamily`、`regenerateInviteCode`、`removeFamilyMember`、`importPersonalToFamily`、`mergeAndImportToFamily`、`autoFriendFamilyMembers`、`cleanupLegacyPaths`。
