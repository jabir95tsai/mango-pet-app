# iOS P3 — Home v3 + Feed + Photos (minimal spec)

狀態：**READY-FOR-DEV**（iOS Full-stack Builder 2026-06-02；無既有 ios-p3 spec，依 master plan + web 實作寫最小 spec）
配合：[`ios-port-master-plan.md`](./ios-port-master-plan.md) §P3、[`home-v3-feed-first.md`](./home-v3-feed-first.md)（web）、[`feed-comments-and-reactions-v2.md`](./feed-comments-and-reactions-v2.md)（web）、[`photo-lightbox.md`](./photo-lightbox.md)、[`photo-gallery-downloads.md`](./photo-gallery-downloads.md)、[`save-photo-to-album.md`](./save-photo-to-album.md)

> 目的：把 web `/app`(home v3) + `/app/feed` + `/app/photos` + lightbox port 到 iOS。後端不改（Firestore 同 collection / 同欄位 / 同 callable）。對齊 web behavior，native 處 SaveToAlbum 用 PhotosKit（native-upgrade）。

## 已知架構事實（沿用，不重查）

- **posts 直寫**：`posts/{postId}` top-level，client 自寫 `reactionCounts` increment（web `setReaction` 直接 `updateDoc reactionCounts.{emoji}`）；`commentCount` 由 Cloud Function 維護，client 不寫。
- iOS `posts.ts` 已有 `createPost`/`deletePost`（P1c）。需補 `listFeedPosts`/reactions/comments read+write。
- `reactions`：`posts/{postId}/reactions/{uid}` `{ uid, emoji, reactedAt }`。
- `comments`：`posts/{postId}/comments/{commentId}` `{ authorUid, authorName, authorPhotoURL, text(≤500), createdAt }`，oldest-first cursor 分頁(20)。
- `listFeedPosts(uid, friendUids, max)` = 3 query 並聯（mine/public/friends-in-chunk）→ dedup → desc。composite index 與 web 同（已部署）。
- `friendUids` = `users/{uid}/friends` 的 **doc id**（doc id 即 friend uid）。P3 只 read doc ids（read-only helper，不做 friends UI；UI 是 P6）。
- familyId：`resolveCurrentFamilyId(uid)`（已 shipped）。pets：`listPetsForScope(fam, uid)`。walks：`listWalksForScope`。
- family name：one-shot read `families/{familyId}.name`（FamilyProvider 全功能是 P4；P3 只讀 name 顯示 top bar）。
- 圖片壓縮：`@/lib/photos` `compressImage` + `uploadPostPhoto`（已 shipped，post preset）。

## Sub-phase 切分（native-dep gate 為界）

| sub | 內容 | native dep |
|---|---|---|
| **P3a** | feed 資料層（listFeedPosts/reactions/comments）+ shared `computeTodayWalkStatus` + PostCard + EmojiReactions（main toggle + tap tray，long-press 留 P3b）+ CommentSection + 完整 PostComposer（相簿選圖 expo-image-picker 已過 P2c gate）+ Feed timeline page + Home v3（StoriesBar/TopBar/empty/InviteFamilyCard/feed-section-header）+ i18n | **無新 native dep**（gesture-handler + svg + linear-gradient + image-picker/manipulator 皆已裝）→ 直接 main |
| **P3b** | PhotoLightbox（swipe carousel + drag-dismiss）+ reaction long-press tray | **`react-native-reanimated`**（gesture-handler 已裝）→ branch + babel plugin + web rollout gate |
| **P3c** | SaveToAlbumButton（PhotosKit）+ Photos gallery（filter pills + grid + batch save）+ `listMyPhotoAssets` aggregator + Stories conic ring polish | **`expo-media-library` + `expo-sharing`** → branch + web rollout gate |

## P3a 元件 / 檔案

- `src/lib/posts.ts`（補）：`listFeedPosts` / `listMyPosts` / `listPublicPosts` / `listFriendsPosts` / `getMyReaction` / `setReaction` / `createComment` / `deleteComment` / `listComments`（cursor 用 `FirebaseFirestoreTypes.QueryDocumentSnapshot`）。
- `src/lib/friends-read.ts`（新，read-only）：`listFriendUids(uid)` → `users/{uid}/friends` doc ids。
- `src/lib/feed-data.ts`（新）：`useFeedData({ home })` hook — familyId + pets + friendUids + posts（home 限 10）+ walks(今日 status) + family name。pull-to-refresh + unmount 安全（一次性 getDocs，無 onSnapshot）。
- `packages/shared-business/src/walk-status.ts`（新）：純函式 `computeTodayWalkStatus(pets, walks): Map<petId, 'done'|'pending'|'tracking'>`（web hook 的 useMemo 邏輯抽出，web+iOS 共用）。
- `src/components/feed/post-card.tsx`（新）：author avatar/name/relative-time/visibility icon + photo grid(1/2/2+) + EmojiReactions + comment badge（lazy CommentSection）+ delete（僅 author，confirm）。
- `src/components/feed/emoji-reactions.tsx`（新）：main ❤️ toggle + 「＋」開 tray（P3a tap 開；long-press P3b）；optimistic + rollback。
- `src/components/feed/comment-section.tsx`（新）：lazy mount、oldest→newest、cursor 20、optimistic append/rollback、`TextInput multiline`。
- `src/components/feed/post-composer.tsx`（改）：加相簿選圖（expo-image-picker，與相機並存）；保留 walk auto-share 入口（initialPhoto/Caption/walkId）。
- `src/components/home/*`（新）：`stories-bar.tsx` `your-story-avatar.tsx` `pet-story-avatar.tsx` `home-top-bar.tsx` `feed-section-header.tsx` `home-empty-state.tsx` `invite-family-card.tsx`。
- `app/(tabs)/index.tsx`（改）：Home v3 整頁 — 4 variants（0 pets / personal / no-posts / main）。
- `app/feed.tsx`（新 route，stack screen 於 (tabs) 外或 modal）：full timeline + composer。
- i18n：`Home.*` + `Feed.*` keys（zh-TW + en，packages/shared-i18n）。

## 護欄

- 不碰 functions/ / firestore.rules / firestore.indexes.json / storage.rules。
- reactionCounts client 寫（mirror web）；commentCount 不寫。
- 不引入 web-only DOM；RN 原生元件。
- listFeedPosts query 與 web 完全一致（同 index）。
- onSnapshot 不用（與 web 一致 one-shot getDocs）→ 無 listener 清理風險。
- P3b/P3c 每個新 dep = branch + lockfile 4 linux binary 確認 + web rollout gate 綠 + merge。

## 驗收（P3 末一次 EAS build，user 走查）

見回報清單（phase 收齊時列）。
