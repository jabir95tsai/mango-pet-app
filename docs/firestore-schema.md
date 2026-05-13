# Firestore Schema 設計

## 集合總覽

```
users/{uid}
users/{uid}/pets/{petId}
users/{uid}/pets/{petId}/healthRecords/{recordId}
users/{uid}/pets/{petId}/reminders/{reminderId}
users/{uid}/walks/{walkId}
users/{uid}/friends/{friendUid}
users/{uid}/friendRequests/{requestId}

posts/{postId}
posts/{postId}/reactions/{uid}

restaurants/{restaurantId}
restaurants/{restaurantId}/reviews/{reviewId}

knowledgeArticles/{articleId}

leaderboards/{period}/entries/{uid}
```

## 文件 schema

### `users/{uid}`
```ts
{
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  authProvider: "google" | "apple" | "facebook";
  locale: "zh-TW" | "en";
  city?: string;             // for 同城排行
  createdAt: Timestamp;
  lastSeenAt: Timestamp;

  // 隱私設定
  defaultPostVisibility: "private" | "friends" | "public";
  allowFriendRequests: boolean;
}
```

### `pets/{petId}` (sub-collection)
```ts
{
  petId: string;
  name: string;
  species: "dog" | "cat" | "other";
  breed?: string;
  birthday?: Timestamp;
  gender?: "male" | "female";
  weightKg?: number;
  photoURL?: string;
  bio?: string;
  createdAt: Timestamp;
}
```

### `healthRecords/{recordId}`
```ts
{
  recordId: string;
  type: "weight" | "feeding" | "vaccine" | "vet" | "medication" | "other";
  recordedAt: Timestamp;
  data: {
    // 依 type 不同
    // weight: { kg: number }
    // feeding: { brand: string, amountG: number }
    // vaccine: { name: string, nextDueAt?: Timestamp }
    // vet: { clinic: string, doctor?: string, diagnosis: string, prescription?: string }
    // medication: { name: string, frequency: string, startsAt: Timestamp, endsAt?: Timestamp }
  };
  notes?: string;
  attachments?: string[];   // Storage paths
}
```

### `reminders/{reminderId}`
```ts
{
  reminderId: string;
  title: string;
  triggerAt: Timestamp;
  repeat?: "daily" | "weekly" | "monthly" | "yearly";
  relatedRecordId?: string;
  notifyBeforeMinutes: number;
  sent: boolean;
}
```

### `walks/{walkId}`
```ts
{
  walkId: string;
  petId: string;
  startedAt: Timestamp;
  endedAt: Timestamp;
  distanceKm: number;
  durationMin: number;
  path?: GeoPoint[];   // 路徑點 (省 storage: 抽樣)
  isManual: boolean;   // 手動補登標記
  score: number;       // 加權分數 (algorithm v1)
  createdAt: Timestamp;
}
```

### `posts/{postId}`
```ts
{
  postId: string;
  authorUid: string;
  petIds: string[];          // 關聯寵物
  text: string;
  photoURLs: string[];
  visibility: "private" | "friends" | "public";
  createdAt: Timestamp;
  reactionCounts: {
    "❤️": number;
    "😂": number;
    "🐶": number;
    "👍": number;
    "🎉": number;
  };
}
```

### `posts/{postId}/reactions/{uid}`
```ts
{
  uid: string;
  emoji: string;
  reactedAt: Timestamp;
}
```

### `restaurants/{restaurantId}`
```ts
{
  restaurantId: string;
  name: string;
  address: string;
  location: GeoPoint;
  googlePlaceId?: string;
  phone?: string;
  petFriendlyLevel: "indoor_ok" | "outdoor_only" | "restricted";
  hasWaterBowl?: boolean;
  hasPetMenu?: boolean;
  averageRating: number;
  reviewCount: number;
  submittedByUid?: string;
  verified: boolean;
  createdAt: Timestamp;
}
```

### `restaurants/{id}/reviews/{reviewId}`
```ts
{
  reviewId: string;
  authorUid: string;
  rating: number;          // 1-5
  text: string;
  photoURLs?: string[];
  createdAt: Timestamp;
}
```

### `knowledgeArticles/{articleId}`
```ts
{
  articleId: string;
  title: { "zh-TW": string; en: string };
  category: "feeding" | "training" | "health" | "breed" | "lifestyle";
  contentMd: { "zh-TW": string; en: string };
  coverImageURL?: string;
  authorName: string;
  publishedAt: Timestamp;
  tags: string[];
}
```

### `leaderboards/{period}/entries/{uid}`
`period` 範例：`weekly_2026-W19`, `monthly_2026-05`, `all_time`
```ts
{
  uid: string;
  displayName: string;
  photoURL?: string;
  totalScore: number;
  totalDistanceKm: number;
  totalDurationMin: number;
  walkCount: number;
  streakDays: number;
  updatedAt: Timestamp;
}
```

## Security Rules 重點 (草案)

```
match /users/{uid} {
  allow read: if request.auth != null;
  allow write: if request.auth.uid == uid;

  match /pets/{petId} {
    allow read, write: if request.auth.uid == uid;
  }
  match /healthRecords/{recordId} {
    allow read, write: if request.auth.uid == uid;
  }
}

match /posts/{postId} {
  allow read: if resource.data.visibility == "public"
    || (resource.data.visibility == "friends"
        && exists(/databases/$(db)/documents/users/$(resource.data.authorUid)/friends/$(request.auth.uid)))
    || resource.data.authorUid == request.auth.uid;
  allow create: if request.auth.uid == request.resource.data.authorUid;
  allow update, delete: if request.auth.uid == resource.data.authorUid;
}

match /restaurants/{rid} {
  allow read: if true;
  allow create: if request.auth != null;
  allow update: if request.auth.token.admin == true;
}
```

## 索引需求
- `posts` by `visibility, createdAt desc`
- `walks` by `userUid, startedAt desc`
- `restaurants` by `location` (geohash) → 用 GeoFirestore
- `leaderboards/{period}/entries` by `totalScore desc`
