# iOS Port Master Plan — PWA → Native (P2–P7)

狀態：**MASTER BACKLOG**（iOS PM 2026-06-01，workflow 並行盤點 6 web feature group + synthesis 產出）
建立日期：2026-06-01
規格作者：iOS PM session（`ios-port-master-plan` workflow：6 Explore mapper + 1 synthesis，~901k tokens）
配合：[`ios-app-strategy.md`](./ios-app-strategy.md)（戰略 + phase plan）、[`ios-parity-checklist.md`](./ios-parity-checklist.md)（§A single source of truth）、各 phase ship note

> 這是把 web 剩餘 surface port 到 iOS 的**完整施工藍圖**。P0 + P1(Walks) 已實機簽收，不重排。
> **本計畫只是 plan/spec（PM 產出），不寫 code**；實作仍走 gated role sessions（每個新 native dep = branch + linux rollout gate，規則 4）。
> ⚠️ 各 feature 的 data contract 引自 workflow 對 `apps/web/src` 的實查；實作前仍以當下 web 程式為準。

---

## 範圍與基準

已完成基準：**P0 Foundation**（monorepo migration、`@react-native-firebase` auth 含 Google+Apple Sign-In、BottomNav 5-tab + 中央 raised disc、`@mango/shared-tokens` mango palette）與 **P1 Walks**（前景 + 背景 GPS 實機簽收 EAS `4e875f0b`、radial dial + week strip、done/confetti、手動 walk、per-pet walk goal、拍照+自動分享）皆已實機驗收，**本計畫不重排**。對齊基準 = web commit `f5c1732`（2026-05-26 baseline snapshot），照片圖庫 `/app/photos`（`e76f97c`）為 post-snapshot drift 併入 P3。本計畫把 web 剩餘 surface（`apps/web/src/app/app/{pets,page,feed,photos,leaderboard,friends,settings}` + `/onboarding` + `/join/[code]`）port 到 Expo + `@react-native-firebase` 原生 app；後端（Firestore collections / Cloud Functions callables + crons / Rules）全部**沿用不改**。涵蓋 P2 Pets → P3 Home+Feed → P4 Leaderboard+Family → P5 Push+Settings → P6 Social → P7 Polish+Submit；餐廳 / 知識庫 deferred-v1（見 §風險）。

---

## Phase 藍圖 (P2–P7)

> 每列：feature — iOS approach ｜ data contract ｜ policy。policy 預設 parity，標 `native-upgrade` / `deferred-v1` / `web-only` 者另注。

### P2 Pets（最大 group，~20–25% 工期）
web 源：`apps/web/src/app/app/pets/page.tsx`、`apps/web/src/app/app/pets/[petId]/page.tsx`、`apps/web/src/components/pets/*`

- **Pets List & Switcher** — FlatList of pet cards + `/app/pets/[petId]` hard nav；chevron switcher 僅 `pets.length>=2`。｜`pets/{petId}`（ownerUid+familyId scope；personal: `where(ownerUid==uid, familyId==null)`）；onSnapshot。｜parity
- **Pet Header & Metadata** — 64px circular avatar + name/age/sex/weight chips；`formatAge(birthday)`；sex glyph ♂/♀。｜reads `Pet`；`pet-header.tsx` / `pet-avatar.tsx`。｜parity
- **4-Tab Nav (overview/reminders/expenses/health)** — sticky pill tab bar；active tab 存 route param `?tab=`（deep-link）。｜local state `usePetTab`；`pet-tabs.tsx`。｜parity
- **Overview Tab** — vertical ScrollView：2×2 StatGrid（nextReminder / monthSpend / weight / walkDays）+ Upcoming reminder card + Recent expense card。｜client-filter `reminders.petId && !done`、`expenses.petId`；`startOfMonth`/`dayDiffFromNow`。｜parity
- **Reminders Tab (list+summary+form)** — FlatList of ReminderCard + FAB → ReminderFormDialog（DateTimePicker、repeat select、notifyBefore [0/15/60/1440/10080]）；complete/edit/delete callables。｜`reminders/{reminderId}`（familyId scope；personal: createdByUid+familyId==null）；fns `createReminder`/`updateReminder`/`completeReminder`/`deleteReminder`；cron `scanReminders` (15min FCM)。｜parity
- **Expenses Tab (donut+filter+list+camera FAB)** — month total bar + 手刻 `react-native-svg` donut + 8-cat legend pills + filtered FlatList + camera FAB → ReceiptScanner（capture 在 dialog 外，傳 `initialFile` 跳過 intro）。｜`expenses/{expenseId}`（payerUid+familyId scope）；callable `extractReceipt`（gemini-2.5-flash）。｜**native-upgrade**（native 相機 first-flow）
- **Health Tab (weight trend+records+form)** — 手刻 `react-native-svg` area+line chart（last 6）+ HealthRecordCard FlatList + FAB → 多型 form（weight/feeding/vaccine/vet/medication）；建 weight record 同步 `pet.weightKg`。｜`pets/{petId}/healthRecords/{recordId}`（nested，polymorphic `data`）；query `type=='weight' orderBy recordedAt ASC`。｜parity
- **Pet Edit Form + Walk Goal Stepper** — `react-native-modal`/expo sheet；avatar picker（expo-image-picker）+ fields + walk-goal ±stepper（clamp 5–120 step 5）；`expo-image-manipulator` IMAGE_PRESETS.avatar。｜`PetInput`；`createPet`/`updatePet`；Storage `petAvatarPath(ownerUid,petId,ext)`。｜parity
- **0-Pet Empty State** — full-screen hero：`expo-linear-gradient` radial disc + paw icon + 「+ 新增寵物」CTA → form add mode。｜no data；`pets-empty-state.tsx`。｜parity

### P3 Home + Feed（含 drift `/app/photos`）
web 源：`apps/web/src/app/app/page.tsx`、`apps/web/src/app/app/feed/page.tsx`、`apps/web/src/app/app/photos/page.tsx`、`apps/web/src/components/{home,feed}/*`、`apps/web/src/components/ui/photo-lightbox.tsx`

- **Home v3 Feed-first + Stories Bar** — ScrollView + 水平 Stories FlatList（dashed ring=user，conic ring=pet walk status done/pending/tracking via Skia/svg）；4 變體（0 pets / 無 family upsell / 0 posts hint / feed preview 10 + view-all）。｜`posts`（listFeedPosts 邏輯）、`pets`、`walks` today-status；`useTodayWalkStatus`（shared-business）。｜parity
- **Feed Timeline (full + home preview)** — FlatList of PostCard；home 限 10 + 「查看更多」→ `/app/feed`；pull-to-refresh；optimistic delete。｜`posts/{postId}`；`listFeedPosts(uid,friendUids,limit?)`（visibility public|friends + friend-scope）。｜parity
- **Post Card + Delete** — author avatar/name/relative-time/visibility icon + photo grid(1/2/2+) + reactions + comment badge；delete 僅 author（confirm + cascade）。｜`deletePost()` cascade reactions+comments；`commentCount` denorm（default 0）。｜parity
- **PhotoLightbox** — full-screen modal carousel：`react-native-gesture-handler` 水平切換(50px) + 下滑關閉(100px)；`react-native-reanimated` transitions；`react-native-safe-area-context` insets。｜photo URL array，stateless。｜parity
- **SaveToAlbumButton** — `expo-media-library` `saveToLibraryAsync(uri)`；移除 web 版本 gate；權限 prompt 非阻塞。｜single file/uri。｜**native-upgrade**（web Share → PhotosKit）
- **Emoji Reactions** — main ❤️ toggle + long-press tray（❤️😂🐶👍🎉）；optimistic count + rollback。｜`posts/{postId}/reactions/{uid}`；`reactionCounts` denorm；fn `onReactionCreated`（5min throttle push，self skip）。｜parity
- **Comment Section** — lazy-mount on open；oldest→newest，cursor 分頁(20)；`TextInput multiline` + `onContentSizeChange` auto-expand；optimistic append/rollback。｜`posts/{postId}/comments/{commentId}`；`commentCount` denorm via `onCommentCreated`/`onCommentDeleted`；`COMMENT_MAX_LEN=500`。｜parity
- **Post Composer (modal, shared home+feed)** — textarea + 2×2 photo grid(max 4) + expo-image-picker + per-photo SaveToAlbum + pet chips + visibility chips(default public) + publish；`IMAGE_PRESETS.post` downsample；prefill `initialPhoto`/`initialCaption`/`walkId`。｜`createPost` → `posts/{postId}`；Storage `users/{uid}/posts/{postId}/{i}-{ts}.{ext}`；partial-success handling。｜parity（state 用 Context/lifted 避免重複 session）
- **InviteFamilyCard / HomeEmptyState / NoPostsHint** — gradient cards（`expo-linear-gradient`）+ CTA → `/onboarding` 或 composer。｜no writes，navigational。｜parity
- **Photos Gallery `/app/photos`（drift）** — filter pills(all/post/walk/pet-avatar/expense-receipt) + grid + batch select save；`expo-media-library` save、`expo-sharing` 分享。｜`listMyPhotoAssets` aggregator（posts+walks+pets+expenses）；`GalleryPhotoAsset`。｜**native-upgrade**

### P4 Leaderboard + Family
web 源：`apps/web/src/app/app/leaderboard/page.tsx`、`apps/web/src/components/leaderboard/*`、`apps/web/src/components/family/*`、`apps/web/src/components/friends/my-qr-dialog.tsx`、`apps/web/src/app/join/[code]/page.tsx`

- **Human Leaderboard (walker, realtime glow)** — onSnapshot；dimension(human/dog)+scope(all/family)+period(weekly/monthly/all_time) tabs（AsyncStorage 持久化）；`useLeaderboardEntryGlow`（lastUpdatedAt delta，<5s 才 glow，mount baseline 不閃）；refresh nonce。｜`leaderboards/{period}/entries/{uid}`；crons `aggregateLeaderboards`(00:30 Taipei) + `recomputeWalkerLeaderboards` onCreate/Delete(walks)；personal-mode 排除（需 family）。｜parity
- **Dog Leaderboard v2 (pet-aware)** — onSnapshot 全 dogs + useMemo filter（ownerVisibility + friendUids Set）；`useDogEntryGlow` keyed petId；`listFriends` one-shot；personal-mode dogs 含入。｜`dogLeaderboards/{period}/entries/{petId}`；`recomputeDogLeaderboards`；denorm `ownerVisibility`。｜parity
- **Family Management** — `FamilyProvider` Context；multi-family switcher pills(>1)；6-digit invite code + copy/share/regen(owner)；member list；leave。｜`families/{familyId}`、`users/{uid}.familyIds[]`/`currentFamilyId`（AsyncStorage 持久化）；callables `createFamily`/`joinFamilyByCode`/`leaveFamily`/`removeFamilyMember`/`regenerateInviteCode`。｜parity
- **Invite Links & QR** — `react-native-qrcode-svg`（H-level + logo overlay，320px）；friend QR → `/app/friends/add?uid=X`；family `/join/{code}` deep link；`expo-sharing` + `expo-clipboard` fallback。｜client-side gen，no write。｜parity
- **Leaderboard Visibility Toggle** — settings radio（public/friends/off）；optimistic + rollback。｜`users/{uid}.leaderboardVisibility`（default public）；trigger `syncDogEntryVisibility` fans to dog entries。｜parity
- **Family Join Deep-Link `/join/[code]`** — expo-router `/join/*`；驗 `^\d{6}$` → `joinFamilyByCode`；auto-bounce。｜callable `joinFamilyByCode`。｜parity
- **Auto-friend on family join** — 純後端 trigger，iOS 只在 `listFriends` re-fetch 看到新好友（可選 toast）。｜trigger `autoFriendFamilyMembers`；`createMutualFriendship`。｜**web-only**（後端）

### P5 Push + Settings
web 源：`apps/web/src/lib/firebase/messaging.ts`、`apps/web/src/components/settings/*`、`apps/web/src/lib/firebase/users.ts`、`apps/web/src/components/auth/{sign-in-buttons,guest-upgrade,guest-upgrade-nudge}.tsx`、`apps/web/src/lib/firebase/auth.ts`

- **FCM→APNs Push Registration** — `@react-native-firebase/messaging` `requestPermission()`+`getToken()`(APNs) → arrayUnion；settings 開啟時 reconcile；`onNotificationOpenedApp` 路由。｜`users/{uid}.fcmTokens[]`、`pushPrefs.globalDisabled`。｜**native-upgrade**（PWA push 殘缺 → APNs）
- **Global Push Toggle** — mount probe permission+token；`globalDisabled` 強制 off 狀態即使 OS granted；optimistic。｜同上。｜parity
- **Engagement Opt-Out (A1/A2/B1/B2 + comment/reaction)** — per-type 開關；`arrayUnion`/`arrayRemove`（concurrent-safe）；family-milestone personal-mode greyed。｜`users/{uid}.pushPrefs.engagementOptOut[]`；`ENGAGEMENT_PUSH_TYPES`。｜parity
- **A1 Evening / A2 Streak / B1 Rank-overtake / B2 Family-milestone** — 純後端 cron/trigger（Asia/Taipei）；iOS 只收 APNs + tap 路由。｜crons `eveningWalkReminder`(20:00)、`streakBreakWarning`(22:00)、`aggregateLeaderboards`(B1 all_time only)、trigger `familyGoalMilestone`(onCreate walks)。｜parity（client routing only）
- **Walk Auto-Photo Toggle** — Firestore merge:true write；walk-end 讀此 flag。｜`users/{uid}.walkPrefs.autoPhotoShare`（default on）。｜parity
- **Photos Preview Block / Friends Link** — settings 3-photo grid → `/app/photos`；Users icon → `/app/friends`。｜`listMyPhotoAssets`；nav-only。｜parity
- **Data Export** — callable → JSON；`expo-file-system` 寫 Documents + `expo-sharing`。｜callable `exportUserData`；`UserDataExport`。｜parity
- **Delete Account (hard cascade)** — impact preview + typed displayName confirm + callable；成功 signOut → login。｜callable `deleteUserAccount`（confirmDisplayName）、`previewDeleteAccountImpact`；`DeleteAccountSummary`。｜parity
- **Guest Login + Upgrade** — `signInAnonymously()` → `isGuest=true`；upgrade `linkWithCredential`(Google/Apple，NOT Facebook) uid 不變；nudge 2–3 walks 後 / settings。｜`users/{uid}.isGuest`/`authProvider`，無 `displayNameLower`；GC `gcAnonymousUsers`(30d)；community gates via rules。｜**native-upgrade**

### P6 Social / Friends
web 源：`apps/web/src/app/app/friends/page.tsx`、`apps/web/src/app/app/friends/add/page.tsx`、`apps/web/src/lib/firebase/friends.ts`、`apps/web/src/components/friends/{friend-search,my-qr-dialog}.tsx`

- **Friends List & Management** — onSnapshot `friends`(orderBy addedAt desc) FlatList + remove confirm；callables。｜`users/{uid}/friends/{friendUid}`（denorm bidirectional）；callable `removeFriend`(asia-east1)。｜parity
- **Incoming Friend Requests** — onSnapshot `friendRequests` + Accept/Reject。｜`users/{uid}/friendRequests/{fromUid}`；callable `acceptFriendRequest`、client-side `rejectFriendRequest`。｜parity
- **User Search (email/displayName)** — direct Firestore query（email exact + `displayNameLower` prefix range `>=q, <=q+'￿'`）；debounce；exclude self/friends/pending。｜`searchUsers(q)`；denorm `displayNameLower`（需 index）。｜parity
- **Send Friend Request** — `sendFriendRequest(fromUser,toUid)` setDoc；disable on send。｜`users/{toUid}/friendRequests/{fromUid}`；rule `isRealUser()`(guest blocked)。｜parity
- **QR Generation & Sharing** — `react-native-qrcode-svg`(H-level)；URL `/app/friends/add?uid={uid}`；`expo-clipboard` + `expo-sharing`。｜client-side，no write。｜**native-upgrade**
- **QR Deep-Link & Target Profile** — expo-router `/app/friends/add?uid=`；`getDoc(users/{targetUid})` → profile + Send；logged-out → login 保留 referrer。｜`AppUser`；error EmptyState。｜parity

### P7 Polish + Submit
- **App icon / splash / screenshots / App Store metadata** — EAS build assets。｜—。｜➖ iOS-only
- **Privacy / Terms** — in-app static page 或連 web（`/privacy`、`/terms`，App Store 必須）。｜static。｜parity（內容重用 web）
- **Onboarding `/onboarding`** — 首登導引：create/join family dialog + import-wizard / skip → `/app/walks`；auto-skip if 已有 family。｜callables `createFamily`/`joinFamilyByCode`；`listPersonalPets`/`listFamilyPets`。｜parity-lite（併 P0 auth flow 餘項）
- **UI Polish bundle** — friends icon → settings、post default public、leaderboard refresh button。｜`ui-polish-bundle-2026-05-25.md`。｜parity
- **i18n catch-up + reduced-motion + 全 surface QA** — 確認 zh-TW/en 全鍵齊、`Animated.reduceMotion`、device 回歸。

---

## 🔌 Native-dep 總清單 (gate inventory)

> **每一個新 dep = 一條 branch + 一輪 linux rollout gate（規則 4）。Windows-built lockfile 會掉 linux native binaries，必須在 EAS/CI linux 環境重生 lockfile 並驗 build。native-dep gates 是序列化的（一次只動一個，build 綠了才下一個）。**

| dep | 用途 | 哪些 feature 用到 | gate 提醒 |
|---|---|---|---|
| `react-native-svg` | 手刻 donut / weight trend chart、conic story rings、custom icons、QR(透過 qrcode-svg) | P2 Expenses donut、P2 Health weight chart、P3 Stories rings、P4/P6 QR | **新 native；P2 先落**。chart 為 P2 第一個 hard dep，優先驗 build。多數其他 dep transitive 依賴它 |
| `expo-image-picker` | 相簿選圖（avatar / post / receipt） | P2 Pet form、P2 Receipt、P3 Composer | 新 native；需 `NSPhotoLibraryUsageDescription` |
| `expo-camera` | 相機拍攝（receipt camera-first、composer 拍照） | P2 Expenses FAB / Receipt | 新 native；需 `NSCameraUsageDescription`；模擬器無相機，須實機 |
| `expo-image-manipulator` | resize/compress（取代 browser-image-compression；IMAGE_PRESETS avatar/receipt/post） | P2 avatar+receipt、P3 post | 新 native；HEIC iOS 原生 OK |
| `expo-linear-gradient` | radial/linear gradient（empty state disc、FAB、cards） | P2 empty state、P3 home/invite cards | 新 native；conic ring 若需更精確改 Skia |
| `react-native-date-picker` | DateTimePicker（reminder/expense/health/birthday） | P2 reminders/expenses/health/pet-form | 新 native；比 expo-date-time-picker 在各 EAS profile 穩 |
| `react-native-modal`（或 expo-router sheet） | 表單 modal | P2 全 forms、P3 composer/lightbox | sheet 若用 expo-router 內建則免新 dep；二擇一先定 |
| `react-native-gesture-handler` + `react-native-reanimated` (v3+) | lightbox swipe carousel + drag-dismiss、long-press reaction | P3 Lightbox、P3 Reactions | **重 native**；reanimated v3 須 babel plugin + 完整 rebuild；單獨一輪 gate |
| `expo-media-library` | 存相簿（PhotosKit） | P3 SaveToAlbum、P3 Photos gallery | 新 native；`NSPhotoLibraryAddUsageDescription`；iOS14 limited-library 處理 |
| `expo-sharing` | native share sheet（export / QR / photo） | P4 invite、P5 export、P3/P6 share | Expo 內建，gate 輕 |
| `expo-clipboard` | 複製 invite code/URL | P4 family、P6 QR | Expo 內建 |
| `expo-file-system` | 寫 export JSON 到 Documents | P5 Data Export | Expo 內建 |
| `react-native-qrcode-svg` | QR 生成（SVG，取代 qrcode npm） | P4 family invite、P6 friend QR | 新 native；依賴 `react-native-svg`（同輪驗） |
| `react-native-tab-view`（可選） | pets/friends/leaderboard 可滑動 tabs（保留 per-tab scroll） | P2 4-tab、P4 lb tabs、P6 friends tabs | 可選；若用自刻 pill bar 則免此 dep。先定 tab 策略再決定 |
| `@react-native-firebase/{firestore,storage,messaging,auth,functions}` | Firestore/Storage/APNs/auth/callables | 全 phase | **已安裝**（P0/P1）；`messaging` 需 Firebase Console 註冊 **APNs 憑證**（DevOps 一次性，非 dep gate） |
| `@react-native-async-storage/async-storage` | tab/period 選擇、currentFamilyId、push pref 離線快取 | P4 lb tabs、P4 family、P5 push | **已安裝** |
| `react-native-safe-area-context` | lightbox/modal notch+home-indicator insets | P3 Lightbox/modals | **已安裝** |
| `expo-localization` + `i18n-js`（若 next-intl 不相容 RN） | zh-TW/en i18n | 全 phase（P7 收斂） | **待評估**：先確認 next-intl RN 可行性；不行則此組為新 dep，**P2 前先拍板**（影響全 surface 文案） |
| `react-native-maps` + `expo-location` | 餐廳地圖/距離 | 餐廳（deferred-v1） | **暫不引入**；re-open 時才走 gate |
| `react-native-markdown-display` | 知識庫 markdown | 知識庫（deferred-v1） | **暫不引入** |

---

## 📦 Shared-package 追加

**`@mango/shared-types`**（單一真相，web+iOS 共用）
- Pet types：`Pet`, `PetInput`, `Species`, `Gender`, `WalkGoal`
- Reminder：`Reminder`, `ReminderInput`, repeat enum、notifyBefore 常數
- Expense：`Expense`, `ExpenseInput`, `ExpenseCategory`, `ExtractedReceipt`
- Health：`HealthRecord`, `HealthRecordInput`, `HealthRecordType`（polymorphic data union：WeightData/VaccineData/VetData…）
- Feed：`Post`, `PostInput`, `Comment`(`COMMENT_MAX_LEN`), `ReactionEmoji`(`REACTION_EMOJIS`), `Visibility`(public/friends/private)
- Leaderboard：`LeaderboardEntry`, `DogLeaderboardEntry`, `LeaderboardVisibility`, `LeaderboardPeriod`
- Family/Social：`Family`, `FamilyMember`, `Friend`, `FriendRequest`, `AppUser`(含 `displayNameLower`, `allowFriendRequests`)
- Push：`ENGAGEMENT_PUSH_TYPES`, `PushPrefs`, `WalkPrefs`
- Photos：`GalleryPhotoAsset`, `PhotoDownloadState`
- Account：`UserDataExport`, `DeleteAccountSummary`

**`@mango/shared-business`**
- Date utils：`startOfMonth`, `dayDiffFromNow`, `formatAge`, `toLocalDateInput`, `fromLocalDateInput`, `taipeiDayIdx`
- Walk goal 常數：`WALK_GOAL_MIN_MINUTES`(5)/`MAX`(120)/`STEP`(5)、`getPetWalkGoalMinutes`
- `useTodayWalkStatus`（story rings done/pending/tracking 判定，home+leaderboard 共用）
- Streak：`streakFromDays`
- `listFeedPosts` query 邏輯（friend-scope + visibility gating）抽為共用 helper（避免 web/iOS 查詢漂移）
- `IMAGE_PRESETS`（avatar / receipt / post 維度，web+iOS 同尺寸）
- Glow 邏輯（`lastUpdatedAt` delta 判定）若可純化也抽出

**`@mango/shared-i18n`（新，條件性）**
- 若 next-intl 無法在 RN 跑：把 message 定義（zh-TW/en）抽到此包，iOS 用 `expo-localization`+`i18n-js` 消費；web 維持 next-intl 讀同源 JSON。先做相容性評估再決定。

**`@mango/shared-firebase`（新，optional 但建議）**
- 共用 auth hook + user profile + family context wrapper
- Firestore query builder（pets/posts/walks/families/friends/leaderboards 的 scope 規則集中），降低 web↔iOS 重複與漂移
- Callable region 常數（`asia-east1`）

**落地次序**：shared-package 變更**先於 consumer**。建議在 P2 開工前先補齊 P2 用到的 types/business（Pet/Reminder/Expense/Health + date utils + walk-goal 常數），其後每 phase 開工前先補該 phase 的型別。

---

## 🗺 建議排序

**總原則**：(a) native-dep gates 序列化（一次一個 dep branch，linux build 綠了才併下一個）；(b) device 驗收手動且無 Mac，每個 native 變更要一輪 EAS build → 實機，故**把同類 native dep 聚在同一 sub-phase 一次驗**；(c) shared-package 先落、consumer 後做。

**Phase 序：P2 → P3 → P4 → P5 → P6 → P7**（依賴遞進：P3 stories 需 P2 pet+walk status；P4 family 為 P3 upsell 落點；P5 push 依 P4 leaderboard cron 已穩）。

**前置（serial，擋全部）**
- **i18n 決策**：next-intl RN 相容性評估 → 定 `@mango/shared-i18n`。P2 開工前拍板。
- **shared-types/business P2 批次**：Pet/Reminder/Expense/Health types + date utils + walk-goal 常數先 merge。

**P2 sub-phases（native-dep gate 為界）**
1. **P2a 骨架**：Pets list + switcher + header + 4-tab + Overview（純 RN + Firestore，**無新 native dep**）→ 可先動，不擋 gate。
2. **P2b chart gate**：引入 `react-native-svg` → Expenses donut + Health weight chart 一起做（同 dep 一輪 EAS 驗）。
3. **P2c form/picker gate**：`react-native-date-picker` + `react-native-modal`/sheet + `expo-image-picker` + `expo-image-manipulator` + `expo-linear-gradient` → Reminders form / Pet edit form / Health form / Expense form / Empty state。建議拆 2 個 dep branch（picker 一支、image 一支）序列驗。
4. **P2d camera gate**：`expo-camera` → Receipt scanner camera-first。需實機（模擬器無相機）。

**P3 sub-phases**
1. **P3a feed 核心**：Post Card / Composer / Reactions / Comments（`expo-image-picker`+`expo-image-manipulator` 已在 P2c 過 gate，複用）。state 用 Context lift。
2. **P3b animation gate**：`react-native-gesture-handler`+`react-native-reanimated` v3（babel plugin + full rebuild，**單獨一輪重 gate**）→ PhotoLightbox + long-press reaction tray。
3. **P3c photos save gate**：`expo-media-library`+`expo-sharing` → SaveToAlbum + Photos gallery + Stories bar gradient/`expo-linear-gradient`(已過)/conic ring。

**P4 sub-phases**
1. **P4a leaderboard**：human + dog board onSnapshot + tabs（用已裝 async-storage，**無新 native dep**）。
2. **P4b family + QR gate**：Family management + visibility toggle + `/join/[code]`；`react-native-qrcode-svg`(+svg 已過) + `expo-clipboard`+`expo-sharing`(已過) → invite QR/links。

**P5**：APNs 設定（Firebase Console 憑證，DevOps 前置）→ push registration + toggles + engagement opt-out（`@react-native-firebase/messaging` 已裝，但**首次實機 APNs 須真機 + 提早 TestFlight internal**，呼應 §F.3 早暴露審查風險）。Settings 其餘（walk-auto-photo / data-export `expo-file-system`+sharing / delete-account / guest upgrade）可並行。

**P6**：friends/requests/search/send + QR deep-link（QR dep 在 P4b 已過 gate，純 RN+Firestore，**無新 native dep**，輕量）。

**P7**：app icon/splash/screenshots/metadata + privacy/terms + onboarding + UI polish + i18n/QA 收斂。

**可並行 role-session vs 須序列**
- **須序列**：所有引入新 native dep 的 sub-phase（P2b/P2c/P2d/P3b/P3c/P4b）— 一次一個 EAS build 實機驗，不可並行。
- **可並行**：純 RN + Firestore 不碰新 dep 者可在另一 role-session 同時推進 — 如 P2a 骨架、P4a leaderboard、P6 friends、P5 settings 非 push 項。但仍須等其依賴的 shared-package + 已過 gate 的 dep 落地。

---

## ⚠️ 風險 + deferred-v1

**Top 風險**
1. **APNs / push 審查與設定**：須 Firebase Console 註冊 APNs 憑證（過期靜默失敗）；模擬器無 APNs，**只能真機驗**。背景定位（P1 已過）+ push 都是 Apple 重點審查項。緩解：P5 提早跑 TestFlight internal（沿用 §F.3 早暴露策略），App Review notes 草稿沿用 §F.2。
2. **Chart 效能 / 純度**：web 用 recharts(JS)，RN 改手刻 `react-native-svg`（donut + weight trend），須 memoize；weight 全相同時 `yScale=0` 除零須 safeguard；low-end 大資料 filter O(n) 須上游預過濾。
3. **Realtime listener 量 + 清理**：leaderboard/feed/friends/family 多 onSnapshot，**unmount 必 unsubscribe**（否則 quota drain）；app 進背景時 Context 須清 listener；composite index `(walkerUid ASC, startedAt ASC)`、`(petId ASC, startedAt ASC)`、`friendRequests.fromUid`、`displayNameLower` 缺一即 `FAILED_PRECONDITION`，部署前先補 `firestore.indexes.json`。
4. **Image pipeline**：`browser-image-compression` → `expo-image-manipulator`，avatar/receipt/post 三 preset 須與 web 同尺寸；receipt 給 Gemini 須保 OCR 可讀（~150 DPI）；客端 enforce ≤8MB；HEIC iOS 原生 OK。
5. **QR / deep-link**：`react-native-qrcode-svg` H-level + logo overlay 須仍可掃；`/app/friends/add` 與 `/join/{code}` 須註冊 universal links（apple-app-site-association）+ expo-router handler，否則掃描落 Safari。
6. **Animation (reanimated v3)**：babel plugin + full rebuild，gesture 與頁面捲動衝突須 Gesture Handler 優先序處理；reduced-motion 須 `Animated.reduceMotion`。
7. **Guest 資料 / GC**：anonymous 30 天未升級被 `gcAnonymousUsers` 硬刪；UX 不可宣稱「永久 guest」，須早 nudge 升級；link 衝突（email 已被佔）須 recovery UI。
8. **Reanimated/SVG 等 native dep 與 Windows lockfile**：每個 dep 須 linux 重生 lockfile + EAS 驗（規則 4），serial gate 拉長工期。

**deferred-v1（已 user 拍板 2026-05-30，parity §D Q1/Q2）**
- **餐廳 `/app/restaurants` + `/[restaurantId]`**：戰略零提及、roadmap 列未來候選且因 Google Places 成本暫停（2026-05-30）。**re-open 條件**：(a) Places 成本軸鬆綁；(b) 引入 `react-native-maps`+`expo-location` 並過 gate；(c) post-launch catch-up sprint。
- **知識庫 `/app/knowledge` + `/[articleId]`**：內容導向、非核心遛狗 loop。**re-open 條件**：(a) `react-native-markdown-display` 過 gate 並驗 GFM 子集（表格/刪除線）；(b) 雙語 `title`/`contentMd` 渲染確認；(c) catch-up sprint。知識庫可獨立於餐廳先排（無成本連動）。

---

## 📋 Parity checklist 待補列

> 對 [`ios-parity-checklist.md`](./ios-parity-checklist.md) §A（P2–P7）逐列確認/補登。現有 §A 已列多數骨幹列；下列為需**新增**或**確認 policy 標註**者。

**P2 — 確認既有列 + 補登**
- 既有列（list/switcher/header、4-tab、開銷 donut+FAB、健康 trend、提醒、AI 收據、pet edit、empty state）policy 全 parity；**開銷 camera FAB / AI 收據**應標 `native-upgrade`（native 相機 first-flow）對齊本計畫。
- 補：Pet Header age/sex/weight chip 細項（formatAge）為既有列子項，確認不漏。

**P3 — 補登 drift + 細列**
- **照片圖庫 `/app/photos`**：§B 已標「parity，排 P3，native-upgrade」但 §A P3 區尚無此列 → **§A P3 新增一列**（GalleryPhotoAsset aggregator + PhotosKit save，policy native-upgrade）。
- Comment Section（lazy load + cursor 分頁 + optimistic）與 Emoji Reactions — §A P3 目前只有「PostCard list + PostComposer」，**建議拆獨立列**（各有 Cloud Function denorm 依賴）。
- NoPostsHint / HomeEmptyState 變體列已含於 InviteFamilyCard 列，確認涵蓋 4 變體。

**P4 — 補 dog board v2 + visibility**
- 既有列為「Leaderboard family-aware + glow」**單列**；**新增「Dog Leaderboard v2（pet-aware，含 personal-mode dogs）」獨立列**（post-baseline ship，parity）。
- **新增「Leaderboard Visibility Toggle」列**（`syncDogEntryVisibility` 連動）— 目前掛在 P5 settings，建議 P4 也交叉登記或註明跨 phase。
- Family multi-family switcher（pills，>1 family）為既有 Family section 列子項，確認標註。

**P5 — 補 settings 細項**
- 既有列含 push/toggle/walk-auto-photo/delete/export/UI-polish。**補登「Guest Login + Upgrade flow」列**（§A 現無；policy native-upgrade）— 目前 guest 僅散見 sign-in，需在 §A P5 或 P0 auth 區明列。
- **補「Engagement opt-out per-type（A1/A2/B1/B2 + comment/reaction）」** 為獨立列（對齊 `ENGAGEMENT_PUSH_TYPES`）。
- **補「Photos Preview block / Friends link in settings」**（UI polish bundle 子項，確認登記）。

**P6 — 補 search/send/deep-link**
- 既有列：Friends list+search、request send/accept、My QR。**補「User Search via displayNameLower（需 index）」**、**「Send Friend Request（isRealUser guest gate）」**、**「QR Deep-Link 落地頁 `/app/friends/add?uid=`（target profile + send）」** 三列細化。
- 標 My QR / friend QR 為 `native-upgrade`（expo-clipboard/sharing）對齊本計畫。

**P7 — 補 onboarding**
- 既有 P7 列為 app 上架物 + privacy/terms。**補「Onboarding `/onboarding`（首登 create/join family + import wizard）」**列。
- **補「`/join/[code]` family join deep-link」**列。

**跨表維護提醒**
- §B drift 三項中：餐廳/知識庫維持 deferred-v1（§D 已拍板）；照片圖庫須從 §B「建議」轉為 §A P3 正式列。
- 本計畫產出後，Cross-platform PM 在 §A 各 phase 把 iOS 狀態欄初始化為 ⬜，並把本 master plan 列為 §A 各 phase 的 backlog 連結。
