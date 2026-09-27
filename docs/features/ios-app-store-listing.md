# App Store Connect Listing — 文案草稿

狀態：**DRAFT，待 user 確認後貼進 App Store Connect**（iOS PM 2026-09-27）
配合：[`ios-app-store-submission.md`](./ios-app-store-submission.md) §App Store Connect listing

> 這份是可以直接複製貼上進 ASC 表單的文案草稿。分類 / 年齡分級兩處需要你在 ASC 介面點選，這裡給推薦答案，但最終畫面上顯示的分級章由 Apple 系統依你點的答案算出。

## App 基本資訊

- **App 名稱**：Mango Pet
- **Bundle ID**：`com.mangopet.app`
- **主要語言**：繁體中文（台灣）
- **副標題**（30 字元內，中文全形算 2）：
  - 中文：`遛狗紀錄 · 寵物社群`（10 字，含空白/·）
  - EN：`Dog Walks & Pet Community`（25 字元）

## 描述（Description）

### 中文（繁體）
```
Mango Pet 是專為愛狗人設計的遛狗紀錄與寵物社群 App。

🐾 遛狗紀錄
一鍵開始遛狗，即時記錄路線、時長與距離——就算鎖屏或切到別的 App，
背景定位也會持續記錄，遛完自動結算今日進度。

🏆 家庭與排行榜
邀請家人加入同一個家庭，一起管理寵物、累積遛狗分數，跟朋友或全 App
使用者比拼排行榜，讓遛狗更有動力。

📸 動態分享
遛狗途中拍照，自動生成貼文分享給朋友或全世界；留言、按讚，
和其他飼主交流養寵心得。

🐶 寵物檔案
每隻寵物都有自己的檔案——健康紀錄、疫苗提醒、體重曲線、看診/用藥
紀錄，還能拍收據自動辨識記帳，寵物開銷一目瞭然。

👨‍👩‍👧‍👦 多寵物、多成員
一個帳號管理多隻毛孩；家庭成員共同編輯，資料即時同步。

免費使用，無廣告、無訂閱付費牆。
```

### English
```
Mango Pet is a dog-walking tracker and pet-parent community app.

🐾 Walk Tracking
Start a walk with one tap — route, duration, and distance are tracked
live, even in the background when your phone is locked or you switch
apps. Your daily progress tallies up automatically when you're done.

🏆 Family & Leaderboards
Invite family members to share pet care, stack up walk scores together,
and compete on leaderboards with friends or the whole app — a little
friendly motivation to get outside.

📸 Share Your Walks
Snap a photo mid-walk and it turns into a post for friends (or the
world) to see. Comment, react, and swap notes with other pet parents.

🐶 Pet Profiles
Every pet gets their own profile — health records, vaccine reminders,
weight trends, vet visits, and medications. Scan a receipt and it's
auto-categorized into your pet's expense log.

👨‍👩‍👧‍👦 Multi-Pet, Multi-Member
Manage every pet from one account; family members edit together and
stay in sync in real time.

Free to use — no ads, no paywall.
```

## 關鍵字（Keywords，100 字元內，逗號分隔，無空白）

```
遛狗,寵物,狗,養狗,寵物紀錄,健康紀錄,排行榜,家庭,社群,散步,dogwalk,pet,dog,petcare,walking
```
（zh + en 混列；ASC 的 keywords 欄位是單一語言各自填，上面這串偏中文；en 版另填：`dog,pet,walk,tracker,petcare,community,family,leaderboard,walking,health`）

## 分類（Category）— 待你拍板

Apple 只能選一個主分類、一個次分類。

- **主分類推薦：生活風格（Lifestyle）**
  理由：核心是寵物照護 + 社群，不是個人健身/健康追蹤（雖然有走路距離統計，但主軸是「養寵生活」不是「你的運動表現」）。
- **次分類推薦：社交（Social Networking）**
  理由：有 feed / 留言 / 好友 / 家庭協作，社群成分不小。

（備選：若你認為「遛狗步數/距離追蹤」才是賣點主軸，也可以主分類選「健康與健身」、次分類「生活風格」——兩種排法都合規，差別只在 App Store 搜尋/瀏覽時被歸在哪一類底下。）

## 年齡分級問卷 — 推薦答案

Apple 現行問卷是逐項問「有沒有以下內容」，最後由系統算出分級徽章（不是你直接選 4+/12+/17+）。逐項推薦：

| 問項 | 推薦答案 | 理由 |
|---|---|---|
| 寫實暴力 / 卡通暴力 | 無 | 無此內容 |
| 恐怖 / 驚悚 | 無 | 無此內容 |
| 成人 / 性暗示內容 | 無 | 無此內容 |
| 褻瀆 / 粗俗幽默 | 無 | 無此內容 |
| 酒精 / 菸草 / 毒品 | 無 | 無此內容 |
| 賭博（模擬） | 無 | 無此內容 |
| 賭博（真錢，含連結） | 無 | 無此內容 |
| **使用者產生內容（UGC）** | **有** | 貼文/留言/好友——如實回答，本次已補齊檢舉/封鎖/處置機制（Guideline 1.2），問卷後段通常會問「是否有內容審核機制」，答**有**（report + block + 24h 內處置） |
| 未經過濾的網路存取 | 無 | app 內無開放式瀏覽器/外部網頁嵌入 |
| 醫療/治療資訊 | 無 | 寵物健康紀錄是使用者自填，非醫療建議內容 |

預期落點：因為有 UGC + 社群互動，多半會落在 **12+**（Apple 對「有 UGC 但有審核機制」的 app 通常落 12+，不太會到 4+，除非你在互動範圍問項上都選最嚴格限制）。這不是你能精準控制的數字，照實填即可，Apple 系統會給出章。

## Support URL / Marketing URL / 隱私政策 URL

- **Support URL（必填）**：`https://mango-pet--mango-pet-app.asia-east1.hosted.app/terms`
  （該頁含聯絡信箱 jabir95tsai@gmail.com；沒有專屬 /support 頁面，terms 頁可以先頂著用。若你想要更像樣的支援頁，可以之後開一個 Web Feature Builder session 加 `/support`，非上架 blocker。）
- **Marketing URL（選填）**：`https://mango-pet--mango-pet-app.asia-east1.hosted.app`
- **隱私政策 URL（必填）**：`https://mango-pet--mango-pet-app.asia-east1.hosted.app/privacy`

> 這三個都是目前的 Firebase Hosting 預設網域（非自訂網域）——Apple 只要求「公開可達」，不要求自訂網域，所以「買網域」不是上架 blocker，可以之後再做。

## App Privacy 資料標籤問卷 — 推薦答案

Apple 問「你（或你用的第三方 SDK）蒐集哪些資料類型」，逐類回答：

| 資料類型 | 有蒐集？ | 用途 | 是否連結身分 | 是否用於追蹤 |
|---|---|---|---|---|
| 位置（精確） | 有 | App 功能（遛狗路線記錄） | 是（連結帳號） | 否 |
| 照片或影片 | 有 | App 功能（貼文/寵物照片/收據） | 是 | 否 |
| 使用者內容（貼文/留言） | 有 | App 功能 | 是 | 否 |
| 聯絡資訊（email） | 有 | 帳號功能（登入識別） | 是 | 否 |
| 識別碼（使用者 ID / 裝置 ID for push） | 有 | App 功能（推播、帳號） | 是 | 否 |
| 使用資料（App 內互動） | **無** | grep 全 repo 確認 web/iOS/functions 都沒有引入 `firebase/analytics` 或 `@react-native-firebase/analytics` — 只用 Auth/Firestore/Storage/FCM/Functions，不用勾這類 | — | — |
| 財務資訊 | 無 | — | — | — |
| 健康與健身 | 無（寵物健康記錄不算「使用者本人」健康資料，Apple 這欄問的是 App 使用者的健康，不是寵物的） | — | — | — |
| **追蹤（Tracking）** | **否，全部否** | 沒有把資料分享給第三方做廣告投放/跨 App 追蹤 | — | — |

✅ **已確認（2026-09-27 grep）**：專案沒有引入 Firebase Analytics — 上表「使用資料」類別不用申報。

## 審查備註（App Review Notes）— 建議內容

```
1. 登入方式：App 提供 Google / Apple / Facebook 登入，也提供「以訪客身分繼續」
   （匿名登入），審查員可直接點「以訪客身分繼續」進入 App 體驗核心功能
   （遛狗、寵物檔案），無需申請帳號。

2. 背景定位用途：本 App 的核心功能是遛狗路線/距離追蹤。使用者按下「開始
   遛狗」後，App 會請求「永遠允許」定位權限，用於使用者鎖屏或切換到其他
   App 時仍能繼續記錄路線；使用者按下「結束遛狗」後定位立即停止，
   不會有背景定位在遛狗流程之外持續運作。

3. 使用者產生內容審核：App 內的貼文與留言功能已提供檢舉（貼文/留言的
   「⋯」選單）與封鎖使用者機制。收到 3 次檢舉後內容會自動隱藏，開發者
   （同時也是唯一維運者）會在 24 小時內人工複查並視情況移除違規內容或
   停權帳號。
```

## 📋 這份文件之後怎麼用

1. 你（或我）先確認上面「App Privacy — Firebase Analytics 有沒有開」這一項。
2. 你去 App Store Connect 建立 App 紀錄後，把上面內容逐欄複製貼上。
3. 分類 + 年齡分級問卷在 ASC 介面互動式填寫，這裡只給推薦答案，不是自動化。
