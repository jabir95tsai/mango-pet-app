# Mango Pet — 部署手冊

從零到上線，按順序執行。

## 0. 一次性前置

| 項目 | 動作 |
|---|---|
| Node.js | 安裝 v22+ (有 v24 也 OK) |
| Firebase CLI | `npm i -g firebase-tools` |
| Firebase 專案 | 在 [Firebase Console](https://console.firebase.google.com) 建立，已升級 Blaze 方案 |
| GCP 預算警報 | $5/月 警報 ([Billing → Budgets](https://console.cloud.google.com/billing/budgets)) |
| Vercel 帳號 | [vercel.com](https://vercel.com) 用 Google 登入 |

## 1. 環境變數 `.env.local`

複製 `.env.local.example` 並填入：

```bash
# Firebase Web config (從 Firebase Console → 專案設定 → 您的應用程式)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

# FCM Web Push (Firebase Console → 專案設定 → Cloud Messaging → 網頁推送憑證)
NEXT_PUBLIC_FIREBASE_VAPID_KEY=

# Google Maps (GCP → APIs & Services → Credentials)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=

# 你的站點網址 (production)
NEXT_PUBLIC_SITE_URL=https://mango-pet.app
```

## 2. 啟用 Firebase 服務

在 Firebase Console：

- ✅ **Authentication** → 啟用 Google / Apple / Facebook
- ✅ **Firestore Database** → production mode + Asia-east1 (或 Asia-northeast1)
- ✅ **Storage** → production mode + 同區域
- ✅ **Cloud Messaging** → 產生 Web push certificate (VAPID key)
- ✅ **Cloud Functions** → 已升 Blaze 自動啟用

## 3. GCP 啟用 Maps API

到 [Google Cloud Console → APIs Library](https://console.cloud.google.com/apis/library)：

- ✅ **Maps JavaScript API**
- ✅ **Places API**

到 **Credentials** 建 API Key，**設應用程式限制為「HTTP referrer」**：
```
http://localhost:3000/*
https://你的網域.com/*
https://*.vercel.app/*
```

## 4. 部署 Firestore / Storage rules + indexes

```powershell
firebase login
firebase deploy --only firestore:rules,firestore:indexes,storage
```

第一次部署 indexes 需要等幾分鐘 (Firebase Console 看狀態)。

## 5. 部署 Cloud Functions

```powershell
cd functions
npm install
cd ..
firebase deploy --only functions
```

部署完會印出 trigger URLs。包含：
- `scanReminders` — 排程，每 15 分鐘
- `aggregateLeaderboards` — 排程，每日 00:30 Asia/Taipei
- `acceptFriendRequest` — Callable
- `removeFriend` — Callable

## 6. 塞示範文章（可選）

```powershell
cd functions
node ../scripts/seed-knowledge.mjs
cd ..
```

## 7. 本機測試

```powershell
npm install
npm run dev
```
打開 http://localhost:3000

## 8. 部署到 Vercel

```powershell
npm i -g vercel
vercel
```

首次會問：
- Set up and deploy? **Y**
- Which scope? 你的帳號
- Link to existing? **N**
- Project name? **mango-pet**
- Directory? **.**
- Override settings? **N**

部署後到 Vercel dashboard → Project → Settings → Environment Variables，把 `.env.local` 全部 key 加上去（**Production + Preview + Development** 全勾）。

設定後重新部署：
```powershell
vercel --prod
```

## 9. 自訂網域

Vercel → Project → Settings → Domains → 加入你的網域，照指示在 DNS 設定 CNAME 或 A 紀錄。

## 10. 上線後 checklist

- [ ] Lighthouse score (Performance / PWA / SEO 各 > 90)
- [ ] PWA「加到主畫面」測試（iOS Safari + Android Chrome）
- [ ] FCM 推播實測（設一個 2 分鐘後的提醒，等 Cloud Function 執行）
- [ ] 排行榜聚合實測（手動觸發 `aggregateLeaderboards`）
- [ ] App Check 啟用（防止盜用 API key）
- [ ] Sentry 或類似的 error tracking 整合（可選）
- [ ] 產 PNG icons 取代 SVG（iOS 桌面圖示需要）

## 排錯

| 症狀 | 原因 | 解法 |
|---|---|---|
| The query requires an index | Firestore 自動建中或還沒部署 | 等 1-5 分鐘 或 `firebase deploy --only firestore:indexes` |
| Permission denied | Rules 沒部署 / 規則拒絕 | 看 Console → Firestore → 規則狀態 |
| FCM token 取不到 | VAPID key 沒設 / 通知權限被拒 | 檢查 `.env.local` 和瀏覽器設定 |
| Map 空白 | API key 錯 / referrer 限制 | 開 DevTools 看 console，確認 referrer 是否包含當前 URL |
| 推播沒收到 | Function 沒部署 / token 無效 | 看 `firebase functions:log` 找線索 |
