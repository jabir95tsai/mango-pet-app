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
  （該頁含營運負責人 蔡智博 與客服信箱 `jabir95tsai@gmail.com`，且 App 內「設定 → 條款與客服支援」亦直接提供 `聯絡客服（jabir95tsai@gmail.com）` 入口與隱私／條款連結。）
- **Marketing URL（選填）**：`https://mango-pet--mango-pet-app.asia-east1.hosted.app`
- **隱私政策 URL（必填）**：`https://mango-pet--mango-pet-app.asia-east1.hosted.app/privacy`
  （已同步說明 Google/Apple/Email/訪客模式、遛狗期間背景定位行為、不當內容過濾與 App 內刪帳流程。）

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

## 審查聯絡與登入帳號資訊（App Review Information）

- **Contact Information（聯絡人）**：
  - First Name / Last Name：`Chih-Po` / `Tsai`（蔡智博）
  - Email：`jabir95tsai@gmail.com`
  - Phone Number：送審前請於 ASC 補填本人聯絡電話
- **Sign-In Required**：**打勾（Sign-in required）**，並於下欄填入審查專用 Email/密碼帳號（由密碼管理器提供環境變數 `REVIEWER_PASSWORD` 後執行 `node functions/scripts/seed-reviewer-account.mjs --commit` 建立，並確認 Firebase Console → Authentication → Sign-in method 已啟用 **Email/Password**）：
  - Email：`appreview@mangopet.app`
  - Password：`<填寫密碼管理器中的審查帳號密碼>`

## 審查備註（App Review Notes）— 建議內容

```
1. 登入方式與完整功能存取：
   App 支援 Google、Apple 登入，並提供「使用 Email 帳號登入」次要入口與
   「以訪客身分繼續」（匿名登入，僅限個人寵物／遛狗紀錄）。
   請點選登入頁下方的「使用 Email 帳號登入」，輸入上述 App Review 帳號密碼，
   即可直接操作所有主要功能（包含預先建立好的寵物「芒果 Mango」、遛狗紀錄、
   家人排行榜，以及社群動態牆上的貼文與他人示範貼文／留言）。
   設定頁最下方提供 App 內立即刪除帳號功能（「危險區 → 刪除我的帳號」）
   及公開客服聯絡入口（jabir95tsai@gmail.com）。

2. 背景定位用途：
   本 App 的核心功能是遛狗路線／距離追蹤。使用者按下「開始遛狗」後，
   App 會請求「永遠允許」定位權限，用於使用者鎖屏或切換到其他 App 時仍能
   繼續記錄路線；使用者按下「結束遛狗」後定位立即停止，不會在遛狗流程之外
   持續背景追蹤。

3. 使用者產生內容審核（Guideline 1.2）：
   - 發文／留言前自動過濾：發布動態或留言時會於送出前及後端雙重檢查並攔截不當字詞。
   - 檢舉與封鎖：動態牆預設已有另一位示範帳號「柴柴鄰居」的公開貼文與留言，
     點選右上角「⋯」選單即可操作「檢舉」與「封鎖」（封鎖後立即雙向隱藏，
     並可在設定頁「已封鎖的使用者」解除封鎖）。
   - 人工審核處置：收到檢舉後會即時推播與告警給維運負責人蔡智博
     (jabir95tsai@gmail.com)，累計 3 次檢舉內容自動隱藏，並於 24 小時內完成人工複查與處置。
```

### English（貼這版 — 審查員讀英文）
```
1. Sign-in & Full Feature Access:
   The app offers Sign in with Google, Sign in with Apple, a secondary
   "Sign in with Email" toggle on the sign-in screen (for App Review / demo
   access), and "Continue as guest" (anonymous session limited to personal pet
   & walk tracking).
   To review ALL features (including pet profiles, background walk tracking,
   family leaderboards, community feed posting, comments, and moderation):
   1) Tap "Sign in with Email" at the bottom of the welcome/sign-in screen.
   2) Sign in with the App Review email and password provided in the Sign-In
      Information fields.
   The demo account comes pre-populated with a dog ("芒果 Mango"), a sample
   walk, and community posts. In-app account deletion is available in Settings
   ("Danger zone -> Delete my account"), and direct support contact is listed
   under Settings ("Legal & Support -> Contact Support").

2. Background Location:
   The core feature is dog-walk route and distance tracking. When the user taps
   "Start walking", the app requests "Always" location authorization so the
   walk route continues recording while the screen is locked or another app is
   active. Location updates stop immediately when the user finishes or discards
   the walk; no background location runs outside an active walk session.

3. User-Generated Content Moderation (Guideline 1.2):
   - Pre-post objectionable content filter: Posts and comments are screened for
     objectionable language prior to publishing (plus server-side fallback).
   - Report & Block: The feed includes a public post and comment from another
     demo user ("柴柴鄰居") so reviewers can test the "..." menu to Report a
     post/comment or Block a user (blocked users' content disappears
     immediately and can be unblocked in Settings).
   - 24-hour moderation SLA: New reports notify the designated moderator
     (Chih-Po Tsai, jabir95tsai@gmail.com) immediately, auto-hide content at 3
     distinct reports, and are reviewed within 24 hours.
```

## 📋 這份文件之後怎麼用

1. 你（或我）先確認上面「App Privacy — Firebase Analytics 有沒有開」這一項。
2. 你去 App Store Connect 建立 App 紀錄後，把上面內容逐欄複製貼上。
3. 分類 + 年齡分級問卷在 ASC 介面互動式填寫，這裡只給推薦答案，不是自動化。
