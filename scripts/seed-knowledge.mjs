#!/usr/bin/env node
/**
 * Seed sample knowledge articles into Firestore.
 *
 * Usage:
 *   cd functions && npm install   # we use firebase-admin from functions/
 *   node ../scripts/seed-knowledge.mjs
 *
 * Or with a service account key:
 *   set GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json
 *   node scripts/seed-knowledge.mjs
 *
 * Requires the Firebase Admin SDK + app default credentials.
 */

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? "mango-pet-app";

initializeApp({
  credential: applicationDefault(),
  projectId,
});

const db = getFirestore();

const articles = [
  {
    title: {
      "zh-TW": "新手養狗的第一週清單",
      en: "First Week Checklist for New Dog Owners",
    },
    category: "lifestyle",
    excerpt: {
      "zh-TW": "從食物、睡覺到第一次看醫生 — 帶毛孩回家前必備清單。",
      en: "Food, sleep, first vet visit — what you need before bringing home a pup.",
    },
    authorName: "Mango Pet 編輯",
    contentMd: {
      "zh-TW": `# 新手養狗的第一週

## 帶回家前要準備

- **食物**：先沿用收容所/前主人的飼料，避免突然換食物造成腸胃不適。慢慢過渡 7-10 天。
- **睡覺**：準備一個安靜、有圍欄的小空間。前幾晚可能會吠，這是正常的分離焦慮。
- **如廁訓練**：尿布墊放固定位置。每次吃飯後 15 分鐘帶去廁所。

## 第一週要做的事

1. 找一間獸醫院，預約健康檢查
2. 確認晶片登記資料
3. 準備一個牌子（名字 + 你的電話）
4. 開始基本指令訓練：坐下、過來

## 注意事項

不要太早帶出門社交，疫苗未完成前感染風險高。`,
      en: `# Your First Week With a New Dog

## Before bringing them home

- **Food**: Keep them on their previous food first. Transition slowly over 7-10 days.
- **Sleep**: Set up a quiet, enclosed area. Expect some whining the first few nights — it's separation anxiety, totally normal.
- **Potty training**: Pee pads in a fixed spot. Take them out 15 min after each meal.

## Week one tasks

1. Find a vet, book a check-up
2. Verify microchip registration
3. Make an ID tag (name + your phone)
4. Start basic commands: sit, come

## Watch out

Don't socialize them outdoors until vaccinations are complete — infection risk is high.`,
    },
    tags: ["新手", "新養"],
  },
  {
    title: {
      "zh-TW": "貓砂選擇全攻略",
      en: "Cat Litter — A Complete Guide",
    },
    category: "lifestyle",
    excerpt: {
      "zh-TW": "礦砂、豆腐砂、木屑砂... 哪一種最適合你的貓？",
      en: "Clay, tofu, wood pellet — which litter fits your cat?",
    },
    authorName: "Mango Pet 編輯",
    contentMd: {
      "zh-TW": `# 貓砂怎麼選

| 種類 | 優點 | 缺點 |
|---|---|---|
| 礦砂 | 凝結快、便宜 | 粉塵大 |
| 豆腐砂 | 環保可沖馬桶、低粉塵 | 較貴 |
| 木屑砂 | 除臭佳 | 不凝結，需常換 |
| 水晶砂 | 吸水力強 | 貓不愛踩 |

## 換砂訣竅

新舊砂混合慢慢過渡。突然全換貓會抗拒去廁所。`,
      en: `# Choosing Cat Litter

| Type | Pros | Cons |
|---|---|---|
| Clay | Cheap, clumps fast | Dusty |
| Tofu | Eco, flushable, low dust | Pricier |
| Wood | Great odor control | Doesn't clump |
| Crystal | High absorption | Uncomfortable paws |

## Transition tip

Mix old + new gradually. Sudden swaps make cats refuse the box.`,
    },
    tags: ["貓砂"],
  },
  {
    title: {
      "zh-TW": "疫苗時程：狗",
      en: "Dog Vaccination Schedule",
    },
    category: "health",
    excerpt: {
      "zh-TW": "從幼犬到成犬完整施打時程，含複合疫苗與狂犬病。",
      en: "Full schedule from puppy to adult, including combo + rabies.",
    },
    authorName: "Mango Pet 編輯",
    contentMd: {
      "zh-TW": `# 狗的疫苗時程

## 幼犬 (8-16 週)

- **8 週**：第一劑五合一
- **11-12 週**：第二劑五合一
- **15-16 週**：第三劑五合一 + 狂犬病

## 成犬 (每年)

- 五合一補強：每年一次
- 狂犬病：每年一次（台灣法定）

## 注意

施打後 2-3 天可能輕微嗜睡或食慾不振，若超過 48 小時或紅腫嚴重請回診。`,
      en: `# Dog Vaccination Schedule

## Puppies (8-16 weeks)

- **Week 8**: First DHPP
- **Week 11-12**: Second DHPP
- **Week 15-16**: Third DHPP + Rabies

## Adults (yearly)

- DHPP booster annually
- Rabies annually (legally required in many regions)

## Watch out

Mild lethargy 2-3 days post-shot is normal. Anything over 48 hours or visible swelling → revisit the vet.`,
    },
    tags: ["疫苗", "狗"],
  },
  {
    title: {
      "zh-TW": "基本指令訓練：坐下、握手、等待",
      en: "Basic Training: Sit, Shake, Wait",
    },
    category: "training",
    excerpt: {
      "zh-TW": "用零食誘導法教三個最實用指令，每天 10 分鐘有效果。",
      en: "Lure-based training for three foundational commands — 10 min/day.",
    },
    authorName: "Mango Pet 編輯",
    contentMd: {
      "zh-TW": `# 三個必學指令

## 1. 坐下 (Sit)

1. 手拿零食，讓狗鼻子聞到
2. 慢慢把零食舉過狗的頭頂
3. 狗自然會抬頭、屁股坐下
4. 屁股一碰地立刻說「Yes!」並給零食

## 2. 握手 (Shake)

1. 狗坐下後，輕碰他的腳掌
2. 他抬起腳的瞬間說「握手」+ 給零食
3. 重複 5-10 次/天，3 天就會

## 3. 等待 (Wait)

1. 放下飯碗前，手掌伸出說「等」
2. 等 3 秒後說「Yes!」放下飯碗
3. 慢慢加長等待時間`,
      en: `# Three Must-Learn Commands

## 1. Sit

1. Hold a treat near your dog's nose
2. Slowly lift it above their head
3. They'll naturally look up and sit
4. The moment their butt hits the ground — say "Yes!" and reward

## 2. Shake

1. After sit, gently touch their paw
2. The instant they lift it, say "shake" + treat
3. 5-10 reps/day → got it in 3 days

## 3. Wait

1. Before placing the bowl down, palm up: "wait"
2. Hold 3 seconds, then "Yes!" and bowl down
3. Gradually extend the wait time`,
    },
    tags: ["訓練", "基礎"],
  },
  {
    title: {
      "zh-TW": "狗狗中暑怎麼辦？",
      en: "Heatstroke in Dogs — What to Do",
    },
    category: "health",
    excerpt: {
      "zh-TW": "夏天高溫加上厚毛，狗很容易中暑。緊急處理 + 預防。",
      en: "Heat + fur = trouble. Emergency handling and prevention.",
    },
    authorName: "Mango Pet 編輯",
    contentMd: {
      "zh-TW": `# 狗中暑

## 症狀

- 急喘、舌頭發紫
- 流大量口水
- 倒地不起、抽搐
- 嘔吐、腹瀉

## 緊急處理

1. **立刻移到陰涼處**
2. 用**常溫水**(不是冰水) 沖腳掌、肚子
3. 給予少量飲水
4. **馬上送獸醫**

## 預防

- 中午 11-15 點不要遛
- 永遠帶水出門
- 短毛/厚毛犬更要小心 (法鬥、柴犬、哈士奇)
- 車內等於烤箱，**絕對不要**留狗在車內`,
      en: `# Heatstroke in Dogs

## Symptoms

- Heavy panting, purple tongue
- Excessive drooling
- Collapse, seizures
- Vomiting, diarrhea

## Emergency response

1. **Move to shade immediately**
2. Wet paws & belly with **room-temp water** (NOT ice)
3. Small sips of water
4. **Vet ASAP**

## Prevention

- No walks 11am-3pm
- Always carry water
- Brachycephalic breeds (Frenchies, Pugs, Huskies) extra vulnerable
- **Never** leave a dog in a parked car`,
    },
    tags: ["健康", "夏天"],
  },
];

async function run() {
  console.log(`Seeding ${articles.length} articles to project ${projectId}...`);
  for (const a of articles) {
    const data = { ...a, publishedAt: FieldValue.serverTimestamp() };
    const ref = await db.collection("knowledgeArticles").add(data);
    console.log(`  ✓ ${ref.id} — ${a.title["zh-TW"]}`);
  }
  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
