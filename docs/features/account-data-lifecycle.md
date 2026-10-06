# 帳號與貼文資料生命週期（R05）

2026-10-06，固定 Backend 角色。延續 `delete-account.md` 已確認的 D1 政策：本人建立的寵物及其健康／散步／提醒／費用資料一起刪除；其他成員建立的寵物保留。這是多個可重試步驟，**沒有跨 Firestore、Storage、Auth 的原子 rollback**。

## 範圍與資料合約

| 路徑 | 本次行為／權限 |
| --- | --- |
| `posts/{postId}/comments/{id}` | 匯出本人 `authorUid` 留言（含別人貼文）；刪帳清本人留言，刪貼文清其所有留言。只有精確頂層 posts 路徑進入 cascade。 |
| `posts/{postId}/reactions/{id}` | 刪貼文清其反應；刪帳刪本人反應與交易內扣數，不會因並行／重試雙扣，無父文件的本人反應也清除。 |
| `restaurants/{id}/reviews/{id}` | 刪本人評論及依存活評論重算評分在同一交易，避免失敗後丟失待重算工作。 |
| `users/{uid}/**` | 最後遞迴清除全部後代，包含 private、friends、friendRequests、favorites、bookmarks、achievements、stats、photoDownloadState、legacy。朋友反向紀錄先清再清本人的名單，保留重試發現能力。 |
| `familyJoinAttempts/{uid}` | 刪帳完成階段清除；一般 client 仍無讀寫權限。 |
| `deletedAccounts/{uid}` | server-only 永久 mutation tombstone 與可恢復進度，client 不可讀寫。欄位 `uid`, `state`, `confirmationHash`, `startedAt`, `updatedAt`, 暫時 `leaseId`／`leaseUntil`，最後 `summary`／`completedAt`。不保存姓名明文。 |
| `deletedAccounts/{uid}/posts/{postId}` | 刪 post parent 前由 server 交易建立待清項，確保 parent 消失後還能清 children。完成即刪 queue。 |
| `postInteractionThrottle/{postId}` | 父貼文仍不存在時清除。 |
| moderation audit／votes／states、家庭 migration history | 保留既有稽核政策，並非本人個資匯出的範圍，不作跨 owner cascade。 |

新增單欄索引：collection group `comments.authorUid` ascending。override 同時保留既有 COLLECTION ascending／descending／contains，部署只新增此 group 索引，既有遠端索引不得順手刪除。

另補 `walks.familyId` collection group ascending 宣告：root 在正式唯讀 inventory 確認已存在但 baseline repo 漏列，這是保留既有遠端狀態，不新增 remote 行為。

`exportUserData` 的 `v1` 回傳額外提供 `comments`, `achievements`, `stats`, `photoDownloadState` 陣列；原本欄位不變。Web 與 shared-types 同步，iOS 使用 shared-types。`comments` 只包含本人的文字與 metadata，不將其他人的留言整批加入匯出。

刪除 summary 新增 `commentsHardDeleted`、`storagePhotosRetained`。各計數描述最後一次 worker 實際處理的數量；若前次已刪部分資料、或貼文 trigger 同時完成清理，summary 可能低於整個工作最初的總量，不是完整歷史盤點。

## 確認、失敗與伺服器續跑

1. callable 驗證 `req.auth.uid`、明確傳入的 `confirmDisplayName`。有 profile 時比對其姓名；舊 iOS 缺 profile 時比對 Firebase Auth displayName，沒有姓名可明確傳空字串。確認成功後才以交易建立 tombstone。
2. `deleting` 使用六分鐘 lease；同時第二個 callable／事件回 `aborted`。Firestore 清理 batch 在交易內讀同一 lease；階段與 Storage 每檔邊界重新檢查；轉入 `finalizing` 也核對 lease，舊 worker 不能覆寫新 worker 的完成狀態。lease 逾期不是假定舊程式已停止，重複操作本身仍須冪等。
3. caller 和 `onAccountDeletionProgress` 共用 `runAccountDeletion`。後端事件會讀**現在**的 marker，忽略過時事件內容。active lease 令事件拋錯重試；失敗後 finally 釋放 lease，marker 寫入也會再觸發續跑。已確認後不依赖 App 重新進設定或保留原 profile。
4. Firestore 與可清除照片處理成功才進 `finalizing`。Auth 錯誤不可吞掉，只有 `auth/user-not-found` 視為冪等成功；再遞迴清 user tree、join quota，最後 `complete`。永久 tombstone 保留。重送 finalizing 事件或 callable 不會復活 profile。
5. Firebase 事件 retry 是有限服務保留期，永久服務錯誤、資料異常或超大帳號仍需要營運處理；需監控 `deletedAccounts` 長時間非 complete 及 function error，不能宣稱無限重試保證完成。未新增 cron、TTL、migration 或既有稽核資料清除政策。

**整合必要條件**：root 的 Firestore mutation rules 必須在所有 client 寫入檢查 tombstone；另外 Admin callables／auto-friend 等 producer 要在其寫入交易讀 marker，只有入口非交易檢查不足。這些跨角色整合由 root 的獨立修補交付。本提交已在 achievement grant、walk stats 與 backfill stats 寫入交易檢查 marker。

## 貼文刪除與事件競爭

`onPostDeletedCleanup` 接既有 Web／iOS 的 parent delete，保留既有 client API。重送時逐批交易確認父文件不存在才清 comments／reactions；檔案清理前也確認 parent 不存在。若同 ID 已被重建，保留新 parent、children、photos。帳號 queue 遇到其他 owner 重建的同 ID，交易確認後移除舊待清項，不會永久卡住刪帳；檔案仍保守保留。

帳號路徑的 queue 建立／移除、post parent 刪除、children 與 throttle 清理，全部在各自的 mutation transaction 讀同一 checkpoint lease。交易外的 check 只用來提早中止，不能當寫入授權；過期 worker 在新 worker 接手／完成後不得補寫 queue。

留言 create／delete handler 都以存活留言集合交易重算 `commentCount`，防止重送雙扣與先 delete 後收到 create 的回加。推播段未變。delete handler 開 retry；create handler 維持原 retry 設定，推播去重不屬本次。

## Storage：保護共用資料

清理只列舉經 server 驗證的 owner namespace，從不依照 `photoURLs` 跳去刪其他帳號／bucket。已知格式只有：

- `users/{uid}/pets/{petId}/avatar.{ext}`
- `users/{uid}/posts/{postId}/{index}.{ext}`
- `users/{uid}/walks/{sessionId}/photos/{index}-{timestamp}.{ext}`

未知 namespace／子路徑格式一律保留。canonical parent 仍存在、存活資料仍引用該完整物件名稱、或引用無法安全解碼也保留。Web sessionId 不一定等於 Firestore walkId，因此同時掃描實際 URL。比較字串原值及最多兩次 URL decode（含 `%2f` 小寫及 double encoding）；這些字串只作**保留依據**，不作刪除權限。

存活引用 registry：pets.photoURL；posts.photoURLs／authorPhotoURL；walks.photoURLs／walkerPhotoURL；expenses.receiptURL；users.photoURL；comments.authorPhotoURL；reviews.photoURLs／authorPhotoURL；friends.photoURL；friendRequests.fromPhotoURL；entries.photoURL／petPhotoURL；knowledgeArticles.coverImageURL／contentMd。嵌套 markdown 也檢查。引用掃描失敗使工作失敗重試，不能猜測未被使用。帳號清理只排除即將刪除的本人 public profile 那一張文件；其他帳號／子文件引用仍全部保留。

先比對 listing generation 與最新 metadata，再使用 `ifGenerationMatch` 刪除，保護覆寫後的新物件。Firestore 與 Storage 沒有跨服務交易；掃描之後才新增的引用／最後存在性檢查與 delete 間的 parent 重建，仍有極短競爭窗口，不能宣稱完全消除。新 schema 加照片欄位必須同步 registry；長期應改為 server 管理的物件引用／生命週期設計。

一次帳號 worker 將貼文的 Storage 清理延後到最後集中掃描，避免每篇重掃；普通刪文仍每事件掃描 registry。這是全專案投影讀取（11 個 query），成本隨存活文件量增加，記憶體還受被列舉的物件數影響，並非固定成本。大規模資料需後續 reference index／分頁 worker，未在本次偷偷建立遷移。舊版刪貼文已留下的孤兒無 delete event，不會被本次自動掃掉。

Storage rules 拆 create/update 與 delete：上傳保留 `<10 MiB` 及 `image/*` 限制；正常 owner 可刪除包括舊版非圖片檔案，foreign／unauth 拒絕。tombstone 存在時 owner 的 upload／update／delete 均凍結，避免殘留 token 刪共用照片。既有 authenticated shared-read 與 owner-only private-read 政策保留。

跨服務 rules 需 Storage service agent `service-722604603606@gcp-sa-firebasestorage.iam.gserviceaccount.com` 有 `roles/firebaserules.firestoreServiceAgent`，角色含 `datastore.entities.get`；不授予一般使用者。root 已唯讀確認需要補此角色，本工作未變更 IAM。[官方說明](https://firebase.google.com/docs/rules/manage-deploy#manage_permissions_for_cross-service_cloud_storage_security_rules)

## 測試與部署交接

`firebase.lifecycle-tests.json` 使用 demo project 與獨立 localhost Firestore 8188／Auth 9098／Storage 9198；測試含真 emulator 資料／Auth 使用者／Storage 物件，但 callable／trigger 以 exported `.run` 呼叫。沒有驗證正式 HTTP IAM、App Check、Eventarc 排程退避或真實裝置。

測試涵蓋：授權及確認拒絕、並行 lease、缺 profile／空姓名、完整 cascade 與 shared 保留、Auth／Storage 故障、server 自動續跑、post queue 中斷與他人重建、重送／晚到留言、反應／評論並行、late achievements、物件覆寫、新 parent、解碼引用／未知路徑、Storage 實際正負 rules。Storage emulator 不實作 GCS `ifGenerationMatch`，因此本地覆寫測試驗到額外 metadata refresh guard；正式 GCS 的原子 precondition 未在 production 做破壞性驗證。

本分支驗證：Functions build／noEmit、Web typecheck、iOS noEmit 全通過；Firebase CLI 15.32.1、Firestore emulator 1.22.0 的乾淨完整回歸 **58/58 PASS**（36 個既有安全測試＋22 個 lifecycle／Storage 測試）。各角色尚未整合的 marker rules／Admin producer gates 要由 root 再跑合併後回歸。

追加 post queue lease 交易防護後，Functions build 通過；乾淨三服務 emulator 的 account lifecycle 組 **20/20 PASS**，包含 enqueue、children、一般 queue 移除及 foreign-recreated queue 移除前的 lease takeover。此追加驗證未重跑其他未變更的安全／Storage rules 組。

與 root 的 marker rules／Admin producer gates 一起整合，先準備最小 IAM、rules 與新增 comments index（確認 READY），再部署 worker 與 producers，最後開啟新刪帳 callable。沒有 push、deploy 或正式資料 mutation 於此提交執行。

本提交需要的 Functions targets（合併時與其他提交取聯集）：`deleteUserAccount`, `exportUserData`, `onPostDeletedCleanup`, `onAccountDeletionProgress`, `onCommentCreated`, `onCommentDeleted`, `onWalkCreatedAchievements`, `onPetCreatedAchievements`, `onPostCreatedAchievements`, `onReactionCreated`, `joinFamilyByCode`, `aggregateLeaderboards`, `backfillAchievements`。另有 `storage` rules、`firestore:indexes`。
