# 🥭 Mango Pet — 芒果寵物

一站式寵物照護與社交 PWA：

- 🐶 **多寵物紀錄**：照片、健康紀錄（體重/餵食/疫苗/就醫/用藥）、提醒
- 📰 **動態牆**：分享照片貼文，emoji 反應，公開度可選
- 🗺️ **寵物友善餐廳**：Google Maps + 評論 + 收藏
- 🏃 **遛狗 GPS + 排行榜**：即時追蹤、加權公式、週/月/總榜
- 📚 **知識庫**：Markdown 文章，依類別分類，可收藏
- 👥 **好友系統**：搜尋、邀請、看好友動態
- 🔔 **推播通知**：提醒到期時 FCM Web Push

## 技術棧

| 層 | 技術 |
|---|---|
| Frontend | Next.js 16 + React 19 + TypeScript + Tailwind 4 |
| State | Zustand + React Context |
| i18n | next-intl (zh-TW / en) |
| PWA | Serwist + FCM service worker |
| Auth | Firebase Auth (Google / Apple / Facebook) |
| Database | Firestore |
| Storage | Firebase Storage |
| Push | Firebase Cloud Messaging |
| Functions | Firebase Cloud Functions v2 (Node 22) |
| Maps | Google Maps JS API + Places |
| Charts | Recharts |
| Markdown | react-markdown + remark-gfm |
| Deploy | Vercel (前端) + Firebase (後端) |

## 快速開始

```powershell
npm install
cp .env.local.example .env.local
# 填入 Firebase / Maps keys
npm run dev
```

開 http://localhost:3000

完整部署流程看 [docs/deploy.md](docs/deploy.md)。

## 專案結構

```
src/
├─ app/                              # Next.js App Router
│  ├─ page.tsx                       # 登入頁
│  ├─ privacy/, terms/               # 法律頁面
│  ├─ error.tsx, not-found.tsx       # 錯誤處理
│  ├─ sitemap.ts, robots.ts          # SEO
│  ├─ app/                           # 登入後的主應用
│  │  ├─ pets/, pets/[petId]/        # 寵物 + 詳情頁
│  │  ├─ feed/                       # 動態牆
│  │  ├─ walks/                      # 遛狗 (GPS + 補登)
│  │  ├─ leaderboard/                # 排行榜
│  │  ├─ restaurants/, [restaurantId]/  # 餐廳地圖 + 詳情
│  │  ├─ knowledge/, [articleId]/    # 知識庫 + 文章
│  │  ├─ friends/                    # 好友 + 搜尋 + 邀請
│  │  └─ settings/                   # 設定 (語言、推播)
│  ├─ actions/                       # Server Actions
│  └─ sw.ts                          # Serwist service worker
├─ components/
│  ├─ auth/                          # AuthProvider, RequireAuth, SignIn
│  ├─ nav/                           # AppNav, RouteHeader, LanguageSwitcher
│  ├─ pets/                          # PetCard, PetForm
│  ├─ health/                        # Records, WeightChart
│  ├─ reminders/                     # ReminderCard, ReminderForm
│  ├─ feed/                          # PostCard, PostComposer, EmojiReactions
│  ├─ walks/                         # WalkSession, ManualWalk, WalkCard
│  ├─ leaderboard/                   # LeaderboardRow
│  ├─ restaurants/                   # Map, Card, AddRestaurant, ReviewForm
│  ├─ knowledge/                     # ArticleCard
│  ├─ friends/                       # FriendSearch
│  ├─ settings/                      # PushToggle
│  └─ ui/                            # Button, Input, Textarea, Dialog, Tabs, Avatar
├─ i18n/                             # next-intl 設定
├─ lib/
│  ├─ firebase/                      # SDK wrappers (auth, users, pets, posts, health-records, reminders, walks, leaderboards, restaurants, knowledge, friends, messaging, storage)
│  ├─ types.ts                       # 共用 types
│  ├─ scoring.ts                     # 排行榜加權公式
│  ├─ walk-tracking.ts               # GPS 追蹤 session 管理
│  ├─ maps.ts                        # Google Maps loader + geolocation
│  ├─ dates.ts                       # local-time 日期工具
│  └─ utils.ts                       # cn() 等共用工具
functions/
├─ src/index.ts                      # scanReminders, aggregateLeaderboards, acceptFriendRequest, removeFriend
public/
├─ manifest.json                     # PWA manifest
├─ firebase-messaging-sw.js          # FCM service worker (generated)
└─ icons/                            # PWA icons
scripts/
├─ generate-fcm-sw.mjs               # 自動生成 FCM SW (predev/prebuild)
└─ seed-knowledge.mjs                # 塞示範文章
messages/                            # i18n 翻譯
docs/                                # PRD / Schema / Sprint / Deploy
```

## 文件
- [PRD](docs/PRD.md)
- [Firestore Schema](docs/firestore-schema.md)
- [Sprint 計畫](docs/sprint-plan.md)
- [部署手冊](docs/deploy.md)
