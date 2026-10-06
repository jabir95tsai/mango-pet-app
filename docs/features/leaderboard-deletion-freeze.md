# R05 排行榜延遲寫入不得復活刪帳資料

日期：2026-10-06；Bug Hunter 窄修補，基準 `fd7f6a1`。

原本 cron／walk triggers 在 transaction 外計算分數後直接 `set` entries。
如果計算完成後才開始刪帳，晚到的寫入可在 cleanup 之後重新建立 walker／dog entries；
`syncDogEntryVisibility` 的 `set(..., merge:true)` 也可用過時的 query snapshot 建立只有 visibility 的 partial doc。

新 `functions/src/leaderboard-write.ts` 將 owner 的 `deletedAccounts/{uid}` 讀取與 entry 寫入放入同一個 Admin transaction。
marker 存在就跳過寫入；一般帳號照原 payload／merge 語意寫入。
完整期間的刪除和新增分成最多 **400** 個操作一個 transaction。
visibility 同步另讀當下 entry，只 update 仍存在、owner 仍相符且位於 dogLeaderboards 的文件，避免重新建立或更新新 owner。
計分與排序演算法維持原樣；不修改 callable、刪帳 cascade、Storage 或 rules。

## 驗證

- Functions build 與 TypeScript noEmit 通過。
- `functions/tests/leaderboard-write.integration.cjs`：**5/5**，真 Admin SDK + Firestore emulator，project `demo-mango-leaderboard`、port **8197**。
- 包含一般 walker／dog merge、計分完成後才建立 deleting／complete marker、真交易並行刪除、visibility stale query／換 owner／非 dog path，以及 802 個操作分為 400／400／2。
- 測試直接驗證 production writer helper；writer callsites 已逐一確認接入。未宣稱已驗正式 cron／Eventarc 事件投遞。

```powershell
npm run build --prefix functions
New-Item -ItemType Directory -Force outputs/leaderboard-tests | Out-Null
'{"emulators":{"firestore":{"host":"127.0.0.1","port":8197},"ui":{"enabled":false},"singleProjectMode":true}}' | Set-Content outputs/leaderboard-tests/firebase.json -Encoding utf8
$env:JAVA_HOME='C:/Program Files/Java/jdk-21'
$env:PATH=$env:JAVA_HOME+'/bin;'+$env:PATH
$env:JAVA_TOOL_OPTIONS='-Duser.language=en -Duser.country=US'
$env:GCLOUD_PROJECT='demo-mango-leaderboard'
npx -y firebase-tools@15.32.1 emulators:exec --project demo-mango-leaderboard --config outputs/leaderboard-tests/firebase.json --only firestore 'node --test --test-concurrency=1 functions/tests/leaderboard-write.integration.cjs'
```

此為 Admin SDK 寫入交易測試，並非 Security Rules 測試；config 無 rules 的 emulator 警告是預期。
需使用新的空白 emulator state。

## 發布交接

root 整合後需部署六支使用這些 writer 的 functions：
`aggregateLeaderboards`、`recomputeWalkerLeaderboards`、`recomputeWalkerLeaderboardsOnDelete`、
`recomputeDogLeaderboards`、`recomputeDogLeaderboardsOnDelete`、`syncDogEntryVisibility`。
本 session 不 push／部署；與 R05 server-only deletion marker 一起驗證。
