# Backend 安全修補驗證 — 2026-10-05

狀態：**已實作、已在本機 Emulator 驗證、未合併 main／未部署正式環境**。
角色：Backend。基準為 `61f18e7`；分支 `codex/backend-security-r01-r02`。
原 checkout 的三份未提交文件未改動；原審查報告已保存於 commit `c32bd28`。

## 修補範圍

| 項目 | 改變 | Commit |
|---|---|---|
| R01 家庭匯出授權 | 由 `families.memberUids array-contains uid` 決定可匯出的家庭，忽略 profile/private 的 familyIds；家庭 DTO 僅保留 familyId/name/ownerUid/memberUids/createdAt，不含 inviteCode | `4da139e` |
| R01 私密欄位覆寫 | private/contact 僅合併合法型別的 email/fcmTokens；呼叫者 uid 固定，輸出 familyIds 重新由實際成員名單產生 | `4da139e` |
| 同根因刪帳路徑 | family cleanup 不遍歷使用者可寫的 familyIds；以真正 membership 查詢，交易內重驗成員／owner／存在性，防止跨家庭或巢狀路徑刪除 | `4da139e` |
| R02 健康紀錄 | 移除 create 的 `resource == null` 放行；所有操作檢查既存 parent pet 的個人 owner／家庭 membership；新資料驗 schema，更新不准修改 attribution 等 metadata | `3841143` |
| 邀請碼猜測補充項 | server-only UID bucket，每滾動 15 分鐘 5 次／24 小時 20 次；猜錯、成功、already-member 都扣額；並發交易保護 | `0c73111` |
| 加入家庭競爭 | membership transaction 重讀邀請碼與家庭存在性；兩份 membership 更新原子提交；使用 crypto 產生六位邀請碼 | `0c73111` |

保留 Web／iOS callable 輸入與回傳格式。超限新增 `resource-exhausted`，附
`details.retryAfterSeconds`；現行 caller 可走既有錯誤處理。本輪沒有新增倒數 UI。
schema 與限額詳見 [Firestore schema](../firestore-schema.md)。

## 實際驗證

- Functions TypeScript **編譯通過**，使用已安裝的依賴，未改 package.json 或 lockfile。
- Firebase CLI **15.32.1**、Firestore Emulator **1.22.0**、Java **21**、本機 Node **24.14.1**。
  Functions 的部署 engine 仍是 Node 22；本機測試不等同該 runtime 的雲端驗證。
- 乾淨 Standard edition emulator，專案 **demo-mango-security**，僅 localhost。
- 以文件化 `emulators:exec` 指令自動啟動／結束：**22 tests，22 pass，0 fail，0 skipped**。
- `git diff --check` 通過。
- 两條獨立唯讀複核：家庭授權／限流與 rules／雙端 payload，相容性與安全性未發現阻擋項。

| 測試群 | 數量 | 涵蓋 |
|---|---:|---|
| family-access | 5 | 真實 export handler、偽造 public/private familyIds、巢狀 path／錯誤型別、DTO 無邀請碼、正常 pet/health/walk 匯出；家庭清理的轉移 owner、撤銷成員及刪除競爭 |
| family-join | 11 | auth/guest/格式拒絕、錯碼扣額、成功與已加入扣額、8 個併發請求僅 5 次查碼、15 分鐘／24 小時精確邊界、過期恢復、换碼與刪除、並發成員保留、client 不可重設 quota、錯誤 quota state fail closed |
| health-rules | 6 | 未登入／外人／偽造家庭快取／缺 parent 拒絕；個人 owner／匿名 owner／家庭成員正常 CRUD；五類合法資料、空 feeding、optional dates；惡意欄位／型別／NaN／Infinity／過長內容拒絕；metadata 不可變更、legacy 讀刪、撤銷 membership |

重現步驟：[functions/tests/README.md](../../functions/tests/README.md)。測試設定必須在
repo root：Firebase CLI 不允許設定檔引用 project directory 之外的 rules。
測試沒有跑真實 Auth／Storage 刪帳、正式 callable HTTP/IAM/App Check、登入後瀏覽器或 iOS 真機。
Callable 用 `.run` 呼叫實際 handler，注入 synthetic verified-auth context；rules 則透過
client SDK + emulator mock auth 實際執行允許／拒絕路徑。刪帳只驗本輪修改的家庭清理 helper。

## 尚未交付的範圍

- **正式漏洞尚不能宣稱已消除**：這些 commit 尚未合併／部署。後續針對 `firestore.rules`、
  `exportUserData`、`deleteUserAccount`、`joinFamilyByCode`、`createFamily`、`regenerateInviteCode`
  進行選擇性發布（最後兩項共用更新後的 crypto 邀請碼產生器），再用授權測試帳號驗證。
  本輪沒有新增 index；memberUids array-contains 使用單欄索引，正式專案是否另有豁免未驗證。
- 六位邀請碼保留相容性；UID 限流仍不能阻擋大量帳號分散猜碼。後續再規劃較長碼、
  到期機制與雙端 App Check；未擅自強制尚未確認可用的裝置驗證。
- R05 其他刪帳遺漏仍待修；本輪只關閉 familyIds 導致的家庭清理授權問題。
- R04 檢舉去重／單人多次檢舉、R06 停止即保存、R10 大量好友 feed 等仍依原報告交接。
- R19 已有本輪安全回歸基礎，尚無 CI、全系統測試或正式發布 gate。
- 舊健康資料即使不符新 schema 仍能由合法使用者讀／刪；若缺 petId 或內容超出新上限，
  update 會拒絕。現行兩端沒有 health update caller，沒有新增現行流程回歸。

## Scoped Security Rules Auditor

以下只針對修改的 healthRecords 區塊；**不是整份 rules 或整個專案的安全評分**。

```json
{
  "score": 5,
  "summary": "Scoped healthRecords review found no actionable defect in parent authorization, create schema validation, immutable metadata or current client compatibility. Six client-SDK emulator test groups passed.",
  "findings": []
}
```
