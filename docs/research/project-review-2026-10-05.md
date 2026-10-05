# Mango Pet 全專案檢視與優化方向 — 2026-10-05

原始審查角色：**Cross-platform PM / 策略**。下文保留 `61f18e7` 的發現與驗證基準。
後續 Backend 已完成 R01、R02 與邀請碼限流的本機修補，詳見
[安全修補驗證](backend-security-fixes-2026-10-05.md)；**尚未合併／部署正式環境**。

**核心建議：先補資料授權、遛狗保存與跨平台資料契約，再完成可驗證的 iOS 上架流程；接著投入效能與設計系統收斂。** 現有 monorepo、Firebase 共用後端與 shared packages 可以延續，沒有證據支持整體重寫。

## 1. 檢視基準與驗證邊界

- 原 checkout：C:/Users/jabir/Hacker_J/mango_pet_app。
- 已成功 fetch；HEAD 與 origin/main 同為 **61f18e7f9d049f8e9285a30999d613c50e3c3985**，當時 ahead/behind = 0/0。
- 盤點到 535 個 tracked files；apps/packages/functions 下 332 個 TS/TSX/JS/MJS/CJS 原始檔、約 52,012 行。這是盤點數量，**不是逐行形式驗證的覆蓋率**。
- 三條並行唯讀檢視：Web/PWA；iOS 與共享契約；Firebase rules/Storage/functions/indexes。主審核對主要發現的呼叫鏈、建置設定、既有 spec、依賴公告與交付文件。
- 開始已有 ios-app-store-listing.md 未提交修改；期間 team/README.md、session-start-prompt.md 出現其他工作中的修改。本報告放在獨立 worktree，沒有覆蓋這些檔案。
- 本次沒有跑正式環境攻擊測試、Firebase Emulator、登入後瀏覽器 E2E、iPhone/iPad 真機、Lighthouse、負載測試或 App Hosting/EAS build。安全問題是**本地規則與程式路徑確認**，不代表已證實 production 遭利用。
- 舊 audit 僅作背景；本文件重新核對現況。不能用舊的 SHIPPED、code done 或 typecheck 結果代替部署／實機證據。

| 實際執行 | 結果與意義 |
|---|---|
| Web：npm run typecheck --workspace apps/web -- --incremental false | 通過 |
| iOS：npm run typecheck --workspace apps/ios | 通過 |
| Functions：node node_modules/typescript/bin/tsc --project functions/tsconfig.json --noEmit | 通過 |
| Web：npm run lint --workspace apps/web -- --format json | **無法啟動檢查**；hoisted eslint-config-next 找不到 next/dist/compiled/babel/eslint-parser。root 沒有 next，apps/web/node_modules 有。這不是本次取得的 lint warning baseline。 |
| moderation helper 受控重播 | 執行真實 TS helper、注入記憶體 fake Firestore。同一 reportId 執行 3 次，reportCount=3、hidden=true，audit 僅 1 筆。不是 Emulator／production 測試。 |
| root npm audit --omit=dev --json | npm 回報套件項目：3 critical / 56 high / 22 moderate，共 81 |
| functions/ 獨立 npm audit --omit=dev --json | 1 critical / 7 high / 10 moderate，共 18；與 root 結果有重疊，不能直接相加 |
| 自動化測試／CI 盤點 | tracked files 未找到 test/spec 測試檔或 .github workflow；各 package 無 test script，Firebase config 無 emulator 測試組態。這不代表團隊從未人工測試。 |

依賴 audit 包含間接依賴與 Expo/Metro 建置工具；數字不是 81 個已可利用的 production 漏洞。root audit 原始證據另存於原 checkout 的 outputs/project-review-2026-10-05/npm-audit-root.json（gitignored）。

## 2. 優先順序

P0 = 資料／授權風險，立即確認正式環境版本並修補；P1 = 核心流程或上架門檻，下個交付批次優先；P2 = 維護性、效能與體驗改善。嚴重度與「是否已在 production 重現」分開判斷。

| 順序 | 工作包 | 主要項目 | 完成的判準 |
|---|---|---|---|
| 1 | 授權與資料保護 | R01–R05、R15 | 跨帳戶負向測試通過；匯出／刪除／檢舉不能越權或留下未處理資料 |
| 2 | 核心遛狗與 iOS 基礎 | R06–R11、R16 | 首登、切家庭、每隻狗進度、停止保存、推播授權都能端到端完成 |
| 3 | 安全交付與送審 | R12–R14、R19 | 安全依賴版本、獨立 Linux build gate、符合 SDK 要求的 build、單次批次實機驗收 |
| 4 | 成長前整理 | R17–R18、R20–R21 | 讀取有界、統計一致、核心 UX 可用、已有品質與使用行為基線 |

工作包 1–3 可按角色使用獨立 worktree 並行；共用 rules/schema 的變更需先確定契約與雙平台相容順序。以下每條均有接手角色與驗收，不要求一次大改全部。

## 3. 需要立即處理的資料與安全問題

### R01 · P0 · 資料匯出信任可由使用者修改的家庭清單

**證據：** firestore.rules:44–47 允許已登入者讀 public user profile，也允許擁有者任意更新自己的 profile。functions/src/index.ts:3495–3501 的 exportUserData 直接依 userData.familyIds 用 Admin SDK 讀回完整 family，沒有檢查該 family.memberUids 是否含 caller。family 包含 inviteCode（packages/shared-types/src/index.ts:625–631）；joinFamilyByCode 在 functions/src/index.ts:2037–2067 接受此碼加入家庭。

**還有第二入口：** functions/src/index.ts:3370–3372 將 private/contact 展開覆蓋 userData，而 firestore.rules:53–54 允許 owner 任意寫該子文件。只限制公開 profile 的 familyIds 仍不完整。

**方向：** Backend 在 callable 以可信 family membership 做逐筆授權；匯出用明確欄位清單，private/contact 只合併允許的聯絡欄位。檢查其他 Admin SDK callable 是否也把 user-editable metadata 當權限來源。

**驗收：** 兩個隔離家庭的測試帳戶，從 public 與 private 兩入口偽造 familyIds 都不能匯出他家資訊；合法資料匯出維持完整。正式環境是否部署相同版本需另行核對。

### R02 · P0 · 健康紀錄 create 可略過身分與寵物授權

**證據：** firestore.rules:238–245 對 healthRecords 使用「allow read, write: if resource == null || …」。新增不存在的文件走 resource==null 分支，未驗登入或 parent pet owner/member。Web 新增在 apps/web/src/lib/firebase/health-records.ts:61–68；iOS 在 apps/ios/src/lib/health-write.ts:21–29。

**方向：** Backend 分離 create/read/update/delete；所有寫入都依 parent pet 授權，驗欄位與記錄者，拒絕 orphan 資料。

**驗收：** 匿名、其他家庭、合法家庭、個人寵物四類規則測試；知道 petId 仍不能越權新增、更新或刪除。

### R03 · P1 · iOS 推播仍寫舊公開欄位，且可能被後端漏讀

**證據：** apps/ios/src/lib/push.ts:64–69、81–84 將 fcmTokens 寫 users/{uid}；firestore.rules:44 讓其他已登入使用者讀完整 profile。Web 已改 private/contact。functions/src/index.ts:88–95 在 private tokens 非空時直接返回，忽略仍在 public doc 的 iOS token。

**方向：** iOS Backend 與 Backend 統一私人 token 寫入、token refresh、登出解除裝置關聯與舊欄位清理；先確保新舊客戶端遷移順序。token 可讀不等於持有者就能任意發送 FCM，但仍違反既定私人資料契約。

**驗收：** 同帳戶 Web/iOS 都送達；B 不能讀 A token；A 登出後該裝置不再收到 A 的私人通知。APNs 憑證與實際送達另需真機驗證。

### R04 · P1 · 檢舉未按人去重，事件重送也會錯算

**證據：** Web posts.ts:367–377、iOS posts.ts:342–353 每次用 auto ID 新增 report；firestore.rules:424–442 沒有 reporter-target 唯一性。functions/src/moderation-helpers.ts:58–65 每份 report 加一，3 次即 hidden。相同 reportId 重播也會加一，audit 在交易外覆寫（73–83）。

本次受控重播已確認 count=3/hidden=true。Firebase Firestore trigger 是至少一次投遞，helper:44–47「onCreate 只執行一次」的假設不成立。[Firebase 官方說明](https://firebase.google.com/docs/functions/firestore-events)

**方向：** Backend 同交易去重「reporter + target」及 event/report ID；驗目標存在、可見度、真實 author，加入合理限流與人工處理紀錄。相同事件問題也應檢查 onCommentCreated（functions/src/index.ts:1247）與 applyWalkToLifetimeStats（functions/src/achievements.ts:253–325）。

**驗收：** 同人多次只計一次；同事件並发／重播三次只生效一次；三個不同合格 reporter 才達既定門檻。UGC 已有 UI 與 function，不需從零重做。

### R05 · P1 · 刪帳／刪文／匯出沒有涵蓋完整資料生命週期

**證據：** 刪帳貼文只清 reactions（functions/src/index.ts:2793–2801），未處理本人寫在他人貼文的 comments；user 子集合清理（2925–2935）漏 achievements、stats、photoDownloadState。匯出（3375–3379、3451–3463）也漏 comments 等後增資料。普通 deletePost 僅刪父 doc（Web posts.ts:129–130、iOS posts.ts:121–124），沒有對應 post-delete cascade trigger。

另 storage.rules:27–31 在所有 write 讀 request.resource.size/contentType，delete 沒有新 resource，owner 刪自己的照片也會被拒絕；apps/web/src/lib/firebase/storage.ts:20–24 確實有 deleteObject 呼叫。

**方向：** Backend 維護「每種資料如何 export/delete/anonymize」清單與可重跑 deletion job；先处理子集合再父層，記錄失敗續跑；Storage upload 驗 size/MIME，delete 獨立驗 owner。

**驗收：** 建齊貼文、他人貼文下留言、反應、照片、成就、下載狀態，再分別刪文與刪帳；另一帳戶看不到應移除的留言，資料及 Storage 無未處理殘留，export 包含約定資料。

## 4. 核心體驗與跨平台一致性

### R06 · P1 · Web「停止並儲存」尚未實際保存，重整可丟掉散步

**證據：** packages/shared-i18n/src/messages/zh-TW.json:756 承諾確認後儲存；apps/web/src/components/walks/walk-tracking-view.tsx:425–436 只 stop + done。實際寫入延後到 saveWalkOnce（461–488），END 跳過（312–314）也不存。done 畫面已慶祝，CTA 是回遛狗／看排行榜，沒有未保存提示。session 在記憶體（apps/web/src/lib/walk-tracking.ts:75）。

**方向：** Web Bug Hunter 停止時先保存核心紀錄，備註／照片可後續更新；使用既有預鑄 walkId 與防重入機制，加入可恢復 draft 與清楚保存狀態。

**驗收：** 停止→跳過照片→重整／關閉重開仍且僅有一筆；離線或保存失敗時可見且可重試，不提前宣稱成功。

### R07 · P1 · iOS 缺少登入後 profile 初始化

**證據：** apps/ios/src/state/auth-context.tsx:28–34 只更新 Auth state，没有 Web upsertUser 的對等流程（apps/web/src/lib/firebase/users.ts:63–158）。新 Google/Apple 使用者略過建立家庭，沒有 users doc；user-prefs.ts:57、65、77 merge set 不帶 uid，違反 firestore.rules:45–46 create 規則。接受好友與刪帳分別要求 profile 存在（functions/src/index.ts:1829–1836、2609–2618）。createFamily 建的 user 也只含家庭欄位。

**方向：** iOS Backend 實作 auth-ready/profile-ready 分離、可重試且冪等的 profile/private contact bootstrap；保留 Apple 首次姓名，補訪客升級後 profile 同步。

**驗收：** 使用從未登入 Web 的 Google、Apple、Guest 測試帳戶，完成改設定、搜尋、好友、刪帳與 Guest 升級。既有開發帳號無法覆蓋這條路徑。

### R08 · P1 · 家庭切換與載入錯誤可能造成錯誤資料範圍

**證據：** iOS family-context.tsx:74–80 更新 Context；use-walks-data.ts:44–65、use-pets-data.ts:41–70 卻自行讀 currentFamilyId、只依 user 變化，不消費家庭 Context。已掛載 tab 切 A→B 可能維持 A 的資料，walks.tsx:224–236 再以舊 scope 保存。

Web family-provider.tsx:95–100 讀取失敗設 family=null，等同 personal mode；walks/page.tsx:182–189 等把錯誤轉空陣列，容易顯示寵物消失。pets-page-content.tsx:180 又以 familyId/null 決定寫入範圍。

**方向：** Web/iOS Bug Hunter 統一 scope 來源，query key 至少含 uid/familyId/petId；mutation 後 invalidate，拒收過期請求。unknown/error 與真正 personal/empty 分開，未知 scope 不允許寫入。

**驗收：** 先開所有 tabs 再切家庭／新增第一隻狗／離開家庭；資料與後續寫入皆一致。家庭讀取失敗只能重試，不自動改成個人資料。

### R09 · P1 · iOS 首次推播授權被 UI 擋住

**證據：** push.ts:33–44 把 NOT_DETERMINED 視為 denied；push-toggle.tsx:58 又 disable denied 的 Switch。唯一 requestPermission 在 enablePush:58，因此新安裝無法從此 UI 首次要求授權。reconcile 在 push.ts:86–88 吞註冊錯誤，probe:51–52 仍回 enabled。

**方向：** iOS Bug Hunter 區分未詢問、被拒絕、註冊中、已註冊、註冊失敗；token 真正完成才顯示啟用。

**驗收：** fresh install 可叫出系統授權；拒絕後有設定入口；APNs/網路/getToken 失敗不顯示成功。APNs capability 與憑證是另一項必驗前置，不能只修 UI。

### R10 · P1 · 16 位好友便會超過 feed 查詢限制

**證據：** apps/web/src/lib/firebase/posts.ts:164–175 每批 30 個 authorUid in，再乘 visibility in 兩值；iOS listFriendsPosts 同模式。16×2=32，超过 Firestore DNF 上限 30。listFeedPosts 用 Promise.all，好友來源失敗会使整體 reject。[Firebase 查詢限制](https://firebase.google.com/docs/firestore/query-data/queries)

**方向：** Backend/雙平台 Feature Builder 統一 query plan，拆 visibility 或限制每批 author 數，保留正確去重排序與錯誤狀態。

**驗收：** 0、15、16、30、31、60 位好友皆可載入；朋友限定內容權限不被放寬。本次以程式及官方限制確認，未在生產建立測試好友。

### R11 · P1 · 每隻寵物的目標進度混用了全家庭 walk

**證據：** apps/web/src/app/app/walks/page.tsx:217–242 切 activePet 只改 goalMin，getTodayProgress(walks, goalMin) 與週旗標仍用全部 walks；walk-tracking.ts:537–545 累加所有今日 walk。A 狗走滿会让沒走的 B 狗也達標。

**方向：** Cross-platform PM 明確區分 dog progress、walker streak、family total；共享純函式按正確主體計算，Web/iOS 同驗。不把「家庭共同帶同一隻狗」誤排除。

**驗收：** 兩狗不同目標、兩位 walker、個人／家庭模式；A 不推高 B，兩人帶同一隻狗則依產品規格合計。

## 5. 依賴、交付與送審

### R12 · P1 · 依賴需要安全更新，但不可直接 audit fix --force

**證據：** apps/web/package.json 固定 Next 16.2.6，root override 固定 RN 0.76.9、Firebase 12.13.0，iOS Expo 52。當次 npm audit root 回報 81 項、functions 回報 18 項。Next 是直接依賴且列 critical；維護者公告將 16.2.6 列入 AVIF optimization 問題的受影響版本。[Next 官方安全公告](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4)

部分公告有嚴格前提，例如 Windows server、next/og、AVIF 圖像；本專案 App Hosting 是 Linux，且未找到 next/og 使用，因此**不能把所有 advisory 當成當前已可利用的漏洞**。root audit 建議的 Next 修正版為 16.3.8；實作當天仍要重新核對相容性與公告。

**方向：** Web 維護批次先處理 Next/相關 image runtime；Expo/RN/RNFirebase 以兼容矩陣整組規劃，Functions 分開處理。避免 audit 提議的盲目降版或全域 force upgrade。

**驗收：** fresh npm ci、三端 typecheck、無發佈副作用的 Linux Web build、native build/實機、主要 flows；逐條記錄剩餘 advisory 的實際可達性與原因。

### R13 · P1 · 「branch rollout 當純 build gate」的文件有生產發布風險

**證據：** 基準 docs/team/README.md:124–128 建議 apphosting:rollouts:create -b branch 作 Linux build，並描述綠後才 merge、production 保持原版。官方說明該命令是對指定 backend 建立 rollout，完成後成為 current rollout；從 branch 建立不等於只做 build。[Firebase rollout 文件](https://firebase.google.com/docs/app-hosting/rollouts)

工作期間另一份未提交 session-start-prompt 已增加「不把未確認 rollout 當純 build」提醒；README 規則 4 的原範例仍需一致化。

**方向：** Backend/交付維護者採 Linux CI build-only，或明確隔離的 staging App Hosting backend。生產 rollout 與 build gate 使用不同步驟、不同目標。保留原本 branch-first 與 Linux gate 目的，不再使用有發布副作用的操作證明「沒發布」。

**驗收：** feature branch gate 成功後 production current rollout 不變；只有明確發布動作才改 production。本次沒有執行任何 rollout。

### R14 · P1 · iOS 上架需先補 Xcode/SDK 與實際 build 證據

**證據：** Apple 自 2026-04-28 起要求上傳 App Store Connect 的 app 以 Xcode 26+、iOS/iPadOS 26 SDK+ 建置。[Apple 官方要求](https://developer.apple.com/news/upcoming-requirements/?id=04282026a)

apps/ios/eas.json 的 production 僅 autoIncrement，未指定 image。Expo 官方說預設 auto 依 SDK/RN 選，現列 SDK 52 image 為 Xcode 16.2。[Expo infrastructure](https://docs.expo.dev/build-reference/infrastructure/)

這是**送審相容性需優先證明的風險**，不等同宣稱 SDK 52 無法在任何新 image 建置。本次未查 EAS build log 或 IPA metadata，不能確認最近 build 使用哪版 Xcode。

**方向：** iOS Backend 先確認真實 production build log；必要時在獨立 branch 升 Expo/RN/native Firebase 或採已驗證相容 image。iOS PM 整併剩餘 APNs、iPad、截圖、UGC、首登、刪帳驗收成一輪 TestFlight。

**驗收：** build ID、commit、Xcode/SDK 版本可追溯；ASC 接受該 build；iPhone/iPad 批次通過。維持每 phase 一次完整裝機驗收，日常 TSX/style/text 使用現有 Development Build + Metro。

## 6. 第二波：正確性、效能與維護性

| ID／優先 | 已確認的結構或缺口 | 優化方向／角色 | 驗收重點 |
|---|---|---|---|
| R15 · P1 | firestore.rules:362–374 允許 real user 任改 reactionCounts，缺可見度／schema 約束；Web posts.ts:228–250 分多次改 count。walk create rules:253–258 未驗 petId 所屬，leaderboard-helpers.ts:229–284 按該 petId 收 walks。 | Backend 將 count/score/attribution 設為伺服器可驗證契約；reaction 原子更新，walk 驗 parent pet 權限與範圍。 | 無權讀 private post 不能反應／改 count；外人不能以自己的 walk 污染別人的狗榜；並發重試仍一致。 |
| R16 · P2 | Web tracking view:339–364 用陣列 idx 認上傳，391–396 刪圖重編 idx，晚到上傳找不到原 slot；pets-page-content.tsx:122–150 缺 stale guard，慢 A 請求可覆蓋 B 體重。iOS tracking-service.ts:211–215 回 start 失敗，tracking view:136、243–252 仍可顯示記錄中。 | Web/iOS Bug Hunter 用 immutable photoId、scope/generation guard 與明確 tracking state。iOS持久化完整 walk session identity，補恢復／捨棄。 | 慢上傳時刪前圖不丟後圖；快速切寵物不混資料；native start failure 不顯示記錄中；重新啟動可恢復已有 draft。 |
| R17 · P2 | Web walks/page.tsx:185–186 每次全歷史讀取；pets-page-content.tsx:131–138 先取全家庭前200筆再篩寵物，低頻狗可能被擠掉。functions/index.ts:407–433 每日掃全部 family walks 再重算；all_time 重讀無界。feed page 僅各源30筆，沒有完整歷史 cursor。 | Backend/Feature Builder 分離摘要、近期列表與分頁歷史；per-pet query、daily aggregate/incremental totals，低頻 reconciliation。 | 以10,000筆合成資料測讀取數/p95及摘要正確性；首次頁面不隨全歷史線性變慢；舊 feed/walk 可分頁到達。未量測真實成本，暫不宣稱省幾成。 |
| R18 · P2 | iOS walk-stats.ts 明註複製邏輯，147–155 streak 用 UTC，26–39 今日／週用 local。Web scoring.ts:21–27 同類 UTC 日桶。Firestore資料多用型別斷言而無 runtime 契約。 | PM 決定連續天數時區語義；Backend 抽 shared-business dates/stats，注入 now；資料層先為 User/Walk/Post 加 normalizer。維持 Web/native SDK adapter 分離。 | 台北昨天23:00、今天07:00；負時區、DST、跨月跨週；Web/iOS/server 統計一致，舊 doc 缺欄位不使頁面崩潰。 |
| R19 · P1 | root package.json typecheck 只跑 Web，functions 不在 root workspace；未找到 tracked CI/test。lint 實跑因 next parser resolution 中止。functions/index.ts 4,682行、Web tracking view 1,026行，變動影響難隔離。 | 先修 lint 啟動與建立跨三端 check，為本報告風險加 rules/契約/純函式/核心flow測試；CI Linux npm ci+build。之後按 auth/family/walk/social/push/account 拆 functions，保持 export 名稱。 | 負向權限及回歸例子能在 PR 擋下錯誤；dependency change 有 Linux gate。先記既有 lint baseline，再逐檔還債；不以一次格式重寫造成大 diff。 |
| R20 · P2 | Web ui/dialog.tsx:20–49 有 aria-modal/Escape，缺 focus trap/restore/inert。shared-tokens 主要只有顏色，radius/spacing 仍兩端維護；iOS walks.tsx:87–117 與追蹤頁有硬寫中文。 | UI/UX 先收共用 Dialog/Button/Input/Tabs，沿用 mango SoT；補 keyboard/VoiceOver、shared radius/spacing、一致翻譯。保留 simple toggle 與 reduced-motion。 | Tab 不到 modal 背景、關閉還焦点、VoiceOver 可操作；中英文主流程無混語；320/390px Web與iPhone/iPad、大字級不裁切。 |
| R21 · P2 | README 仍列 Vercel、根 src 結構；deploy.md 有舊腳本路徑。submission 同時說 UGC已部署/未部署、ASC已建/未建；parity仍有舊 sliding indicator。未找到 crash/產品事件上報 SDK。 | PM 統一 release evidence 清單；文件標「planned/code complete/deployed/verified」。工程先補錯誤與核心漏斗觀測，再按真實使用率排優化。 | 每個完成勾選有 commit/build/日期/操作結果；新加入者能按 README 跑起來；保存失敗與版本可追蹤，不能只靠 console 或使用者截圖。 |

iOS session 恢復補充：walk-tracking-service.ts:44–59 有 persisted accumulator，但 UI 的 sessionOpen/walkId 在 walks.tsx:43–48 仍為記憶體 state，缺完整 owner/family/pet/walk identity 恢復。需真機驗證 OS 回收；強制終止後不承諾作業系統繼續定位。

App Check 補充：Web 有 init（apps/web/src/lib/firebase/config.ts），iOS 未找到對應整合，callables 未看到 enforceAppCheck。Console enforcement、API key 限制、PII migration 是否完成均未 live 查核；列 Backend 盤點，不從 repo 推定「正式環境完全沒防護」。

## 7. 產品優化方向與成功指標

**建議將近期目標收斂為「第一次成功帶狗出門、結束有保存、家人看得到、下次還會用」。** 現有功能面已很廣；優化順序應由可靠性與使用行為決定。

| 候選工作 | 使用者價值 | 建議觀察／驗收 |
|---|---|---|
| 第一趟散步啟動與保存 | 新用戶不因 profile、權限或零寵物狀態卡住 | onboarding完成→建狗→開始→保存各步轉換率；首次保存耗時；失敗原因分佈 |
| 家庭共同照護 | 切家庭、選狗後看到正確進度，不重複遛或漏遛 | 每隻狗每週達標天數、共同參與家庭比例、切換scope相關錯誤數 |
| 安心保存與恢復 | 鎖屏、斷線、App回收後仍知道紀錄去向 | walk stop→server ack成功率、pending/retry/recovered比例、無重複紀錄 |
| 穩定留存 | 準確提醒與清楚成果促成下一次散步 | 首次成功walk cohort 的D7/D28回訪、每週完成散步家庭數、推播送達／啟動率 |

上表是**建議新增的指標定義，不是已量到的成效**。先收一至兩週基線再訂改善幅度；觀測以事件、耗時、錯誤碼、版本與不直接識別個人的識別方式為主，不傳照片內容或原始 GPS 路徑當 analytics。

暫緩：Apple Glass 全面重設、餐廳/知識庫擴張、Android、新資料库或大型狀態框架重寫。延續既有 deferred-v1 決策；這些不是目前最短的品質／上架改善路徑。

## 8. Handoff 與共用規格影響

| 接手角色 | 優先項 | 前置／完成要求 |
|---|---|---|
| Backend | R01、R02 → R04、R05、R15 → R17 | 先定資料權限與生命週期；Emulator跨帳戶負向測試、事件重播測試；依相容順序部署，另留production回驗證據 |
| iOS Backend / Bug Hunter | R03、R07–R09 → R14、R16 | 與Backend對齊profile/token/scope；新帳戶測試；phase末一顆build驗完整路徑 |
| Web Bug Hunter | R06、R11 → R08、R16 | 停止保存、每狗統計、切換競態回歸；不混入整體視覺重寫 |
| Web/iOS Feature Builder | R10、R17–R18 | 共用查詢計畫、統計語義與分頁契約先確定；兩端SDK adapter各自實作 |
| UI/UX | R20 | 先共用primitives，再高頻頁；依既有mango/reduced-motion規格 |
| PM / 交付維護 | R12–R14、R19、R21 | 明確build-only gate、release evidence與必要驗收；保留真機批次節奏 |

**Decision（本次提案）：** 採前三個工作包作下一輪候選，不啟動功能擴張或整體重寫。實作優先由授權與停止保存開始。

**Shared spec impact：** 建議把「停止即可靠保存」「profile/private token契約」「family/pet scope單一來源」「每狗進度與時區」「資料export/delete涵蓋範圍」「UGC唯一檢舉與冪等」補為Web/iOS共同驗收；未驗證前不把parity改勾完成。

**Deferred / not-do：** 本輪不修改production code、不執行部署、不建立新Firebase project、不改既定品牌、不宣稱真機或production驗收通過。

**完成範圍：** 已留下具證據、優先序、角色及驗收的檢視報告；工程修復與送審操作為後續獨立交付。
