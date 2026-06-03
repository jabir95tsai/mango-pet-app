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
  // ── PM content session batch (2026-06-03): feeding×2 / training×3 / health×1 ──
  {
    title: {
      "zh-TW": "幼犬 vs 成犬：餵食頻率與份量怎麼抓",
      en: "Puppy vs. Adult Dog: How to Get Feeding Frequency and Portions Right",
    },
    category: "feeding",
    excerpt: {
      "zh-TW": "幼犬需要少量多餐，成犬一天兩餐即可，份量要跟著體重與活動量調整。",
      en: "Puppies need frequent small meals, while adult dogs do well on two meals a day—always adjust portions to weight and activity level.",
    },
    authorName: "Mango Pet 編輯",
    tags: ["餵食頻率", "幼犬飲食", "成犬飲食", "份量控制"],
    contentMd: {
      "zh-TW": `# 幼犬 vs 成犬：餵食頻率與份量怎麼抓

養狗新手最常問的問題之一就是「一天要餵幾次、餵多少？」幼犬和成犬的需求差很多，用錯方法容易造成腸胃不適或營養失衡。這篇文章帶你從年齡、體重、活動量三個面向找到適合自家毛孩的餵食節奏。

## 幼犬：少量多餐是關鍵

幼犬的胃容量小、血糖調節能力弱，**一天至少需要 3–4 餐**，部分超小型犬（如吉娃娃）甚至建議每天 4–5 餐，以避免低血糖。

- **8 週以下**：跟繁殖者或救援單位確認，通常仍以奶或離乳食品為主
- **8 週–4 個月**：一天 4 餐，每餐間隔約 4–5 小時
- **4–6 個月**：可逐漸減至一天 3 餐
- **6 個月以上**：視品種成熟速度，多數可轉為一天 2 餐

份量參考**飼料包裝背面的體重對照表**（依據 AAFCO 認證飼料廠商提供的餵食指引），但那只是起點。幼犬活動力高、生長速度快，若排便成形、體態適中，就是剛好；若糞便鬆散或體重增加太快，就要微調。

## 成犬：一天兩餐、定時定量

多數獸醫師與 WSAVA（世界小動物獸醫師協會）全球營養指南建議，**成犬每天餵食 2 次**，早晚各一，維持穩定的消化節律，也降低大型犬發生胃扭轉（GDV）的風險。

### 份量怎麼算？
1. 查飼料包裝的每日建議量（以理想體重而非目前體重為基準）
2. 分成兩份，早晚各餵一次
3. 每月量體重一次，依增減調整 ±10%

**活動量影響很大**：每天有充足散步和互動的狗，代謝較快，可維持建議量；運動量少或已絕育的狗，容易發胖，建議酌量減少 10–20%。

## 高齡犬的調整

7 歲以上（大型犬 5 歲以上）進入高齡期，消化吸收效率下降，建議：
- 維持一天 2 餐，但可改用**高齡犬專用配方**（蛋白質來源易吸收、熱量略低）
- 若食慾明顯下降或體重驟變，請儘早就診，排除牙科或器官問題

## 小提醒

- 換飼料時不要突然整包換，要做 **7 天漸進過渡**
- 飯後至少等 30 分鐘再出去散步，避免激烈運動引發腸胃不適
- 本文份量建議僅供參考，實際狀況請諮詢獸醫，本文不替代專業診療
`,
      en: `# Puppy vs. Adult Dog: How to Get Feeding Frequency and Portions Right

One of the most common questions new dog owners ask is "how many times a day should I feed my dog, and how much?" The needs of puppies and adult dogs differ significantly. Getting it wrong can lead to digestive issues or nutritional imbalances. Here's how to find the right feeding rhythm based on age, weight, and activity level.

## Puppies: Small, Frequent Meals Are Essential

Puppies have small stomachs and limited ability to regulate blood sugar, so they need **at least 3–4 meals per day**. Very small breeds (like Chihuahuas) may need up to 5 meals a day to avoid hypoglycemia.

- **Under 8 weeks**: Follow guidance from the breeder or rescue—usually still on milk or weaning food
- **8 weeks–4 months**: 4 meals a day, spaced roughly 4–5 hours apart
- **4–6 months**: Gradually reduce to 3 meals a day
- **6 months and up**: Most puppies can transition to 2 meals a day, depending on breed maturity

Use the **feeding chart on the food packaging** (based on AAFCO-compliant manufacturer guidelines) as a starting point. Adjust based on stool quality and body condition—not just weight gain.

## Adult Dogs: Twice a Day, Consistent Timing

Most vets and the **WSAVA Global Nutrition Guidelines** recommend feeding adult dogs **twice daily**—morning and evening. This supports a stable digestive rhythm and reduces the risk of bloat (GDV) in large breeds.

### How to Calculate Portions
1. Check the daily recommended amount on the packaging (based on ideal body weight, not current weight)
2. Split into two equal meals
3. Weigh your dog monthly and adjust by ±10% as needed

Activity level matters: dogs with regular walks and active playtime burn more calories and can stay at the recommended amount. Less active or neutered dogs tend to gain weight more easily—consider reducing portions by 10–20%.

## Senior Dogs (7+ Years)

Older dogs have reduced digestive efficiency. Consider:
- Switching to a **senior formula** (easier-to-digest protein, slightly lower calories)
- Keeping two meals a day
- Consulting your vet if appetite drops or weight changes significantly

## Quick Reminders

- Never switch food brands abruptly—use a 7-day gradual transition
- Wait at least 30 minutes after meals before heading out for a walk
- Portion guidelines are general references only. For your dog's specific needs, please consult a veterinarian.
`,
    },
  },
  {
    title: {
      "zh-TW": "這些人類食物狗狗絕對不能吃",
      en: "Human Foods That Are Toxic to Dogs",
    },
    category: "feeding",
    excerpt: {
      "zh-TW": "葡萄、洋蔥、巧克力、木糖醇……這些常見食物對狗狗可能致命，快來對照清單。",
      en: "Grapes, onions, chocolate, xylitol—these everyday foods can be deadly for dogs. Check the list before sharing a bite.",
    },
    authorName: "Mango Pet 編輯",
    tags: ["毒性食物", "飲食安全", "緊急處理", "居家照護"],
    contentMd: {
      "zh-TW": `# 這些人類食物狗狗絕對不能吃

遛狗回家、家人圍桌吃飯，毛孩用水汪汪的大眼盯著你——要分食物給牠之前，請先確認那是不是安全的。以下清單根據 **ASPCA 動物毒物控制中心（Animal Poison Control Center）** 的官方資料整理，是狗狗絕對不能碰的食物。

## 高危險：少量就可能致命

### 🍇 葡萄與葡萄乾
原因至今未完全明朗，但即使**少量**也可能引發急性腎衰竭，且不同個體反應差異大——有些狗吃一顆就出問題。無論是新鮮葡萄、葡萄乾、果凍或含葡萄成分的飲品，全部禁止。

### 🧅 洋蔥、大蒜、韭菜（蔥蒜類）
含有**有機硫化物**，會破壞狗的紅血球，造成溶血性貧血。生的、熟的、粉末狀（如洋蔥粉、大蒜粉）都有毒，且**大蒜的毒性比洋蔥強約 5 倍**。台灣常見的蔥爆料理、蒜味肉片絕對不能給。

### 🍫 巧克力（可可鹼）
黑巧克力與烘焙用純可可粉毒性最強，牛奶巧克力次之，白巧克力相對低但仍不安全。症狀包括嘔吐、腹瀉、心跳加速、癲癇，嚴重可致死。

### 🦴 木糖醇（Xylitol）
存在於**無糖口香糖、某些花生醬、烘焙食品、牙膏**中。對狗會造成胰島素急速釋放，引發低血糖，並可能導致肝衰竭。買花生醬前務必看成分標示。

### 🍺 酒精
狗的代謝系統無法處理乙醇，即使少量啤酒或含酒料理都可能造成中毒、呼吸抑制。

## 中危險：避免餵食

| 食物 | 風險 |
|------|------|
| 夏威夷豆 | 肌肉無力、顫抖、發燒 |
| 生麵糰（含酵母） | 腸胃脹氣、乙醇中毒 |
| 酪梨（果肉/核/皮） | 含 Persin，可能引發嘔吐腹瀉 |
| 咖啡因（咖啡、茶） | 心跳加速、癲癇 |
| 生肉/生雞蛋（未經處理） | 沙門氏菌、抗生物素蛋白影響維生素吸收 |

## 如果誤食了，怎麼辦？

1. **不要自行催吐**（某些情況催吐反而更危險）
2. 記下誤食的食物、份量、時間
3. 立即聯繫獸醫或動物急診
4. 台灣可撥打**動物保護諮詢專線 1959**（各縣市動保處）

> ⚠️ 實際狀況請諮詢獸醫，本文不替代專業診療。懷疑中毒請勿觀望，盡快就醫。
`,
      en: `# Human Foods That Are Toxic to Dogs

Before slipping your dog a bite from the dinner table, make sure it's actually safe. The following is based on the **ASPCA Animal Poison Control Center** official toxin list—foods your dog should never eat.

## High Risk: Even Small Amounts Can Be Dangerous

### 🍇 Grapes and Raisins
The exact mechanism is still unknown, but even a **small amount** can cause acute kidney failure. Individual sensitivity varies wildly—some dogs react to a single grape. Avoid fresh grapes, raisins, grape juice, and any grape-containing products.

### 🧅 Onions, Garlic, Leeks, and Chives
These contain **organosulfur compounds** that destroy red blood cells, causing hemolytic anemia. Raw, cooked, or powdered forms (onion powder, garlic powder) are all toxic. Garlic is roughly **5× more toxic than onion** by weight.

### 🍫 Chocolate (Theobromine)
Dark chocolate and baking cocoa are the most dangerous; milk chocolate is less so; white chocolate the least—but none are safe. Symptoms include vomiting, diarrhea, rapid heart rate, and seizures.

### 🦴 Xylitol
Found in **sugar-free gum, some peanut butters, baked goods, and toothpaste**. Causes a rapid insulin spike leading to hypoglycemia, and can result in liver failure. Always check peanut butter labels before sharing.

### 🍺 Alcohol
Dogs cannot metabolize ethanol. Even small amounts—including beer or dishes cooked with wine—can cause poisoning and respiratory depression.

## Moderate Risk: Best to Avoid

| Food | Risk |
|------|------|
| Macadamia nuts | Muscle weakness, tremors, fever |
| Raw yeast dough | Gas, bloating, ethanol toxicity |
| Avocado (flesh/pit/skin) | Contains Persin; may cause vomiting and diarrhea |
| Caffeine (coffee, tea) | Rapid heart rate, seizures |
| Raw meat/eggs (unprocessed) | Salmonella; avidin in eggs blocks biotin absorption |

## If Your Dog Eats Something Toxic

1. **Do not induce vomiting on your own**—it can make things worse in some cases
2. Note what was eaten, how much, and when
3. Contact your vet or an emergency animal clinic immediately

> ⚠️ This article is for general reference only and does not replace professional veterinary advice. If you suspect poisoning, act immediately—don't wait for symptoms to worsen.
`,
    },
  },
  {
    title: {
      "zh-TW": "坐下、等、過來：三個基礎指令這樣教",
      en: "Sit, Stay, Come: How to Teach Your Dog the Three Essential Commands",
    },
    category: "training",
    excerpt: {
      "zh-TW": "用正向強化打好基礎，這三個指令能讓遛狗更安全、互動更順暢。",
      en: "Use positive reinforcement to build a solid foundation—these three commands make walks safer and life with your dog smoother.",
    },
    authorName: "Mango Pet 編輯",
    tags: ["基礎訓練", "正向強化", "指令教學", "遛狗安全"],
    contentMd: {
      "zh-TW": `# 坐下、等、過來：三個基礎指令這樣教

很多人以為訓練是「給狗立規矩」，但現代動物行為學的共識是：**正向強化（positive reinforcement）** 才是最有效、最人道的訓練方式。用獎勵取代懲罰，狗狗學得快、也更願意與你互動。這三個指令是所有進階訓練的地基，也是遛狗安全的基本保障。

> 本文訓練方法符合 **IAABC（國際動物行為諮詢師協會）** 與 **PPG（寵物專業公會）** 推薦的 LIMA 原則（最少侵入性、最低厭惡性）。

## 訓練前的準備

- **零食**：選狗狗超愛、且小塊的獎勵（約指甲蓋大小），避免訓練中吃太多正餐
- **時機**：每次訓練 **5–10 分鐘**，一天可練 2–3 次；不要在狗狗太興奮或剛吃飽時練
- **環境**：從低干擾的室內開始，等指令穩定後再移到戶外、公園

## 坐下（Sit）

這是最容易上手的第一步。

1. 手拿零食靠近狗鼻子
2. 緩緩將手往狗的後腦勺方向移動——狗為了追零食，屁股自然會往下
3. 屁股一碰地，**立刻給獎勵 + 說「好！」**（口頭標記）
4. 重複 5–10 次後，加入口令「坐下」，在動作之前說

**常見錯誤**：把手舉太高，狗會跳起來而不是坐下。

## 等（Stay）

學會「坐下」後才練「等」。

1. 請狗坐下
2. 手掌朝向狗（像「停」的手勢），說「等」
3. 等 2 秒，給獎勵（不要讓狗先站起來才給）
4. 逐漸拉長時間：5 秒 → 10 秒 → 30 秒 → 1 分鐘
5. 時間穩定後，再練**加入距離**（你往後退一步、再退兩步……）

**原則**：寧可讓牠成功在短時間，也不要讓牠失敗在長時間。失敗就縮短時間重來。

## 過來（Come / 召回）

這是最重要的安全指令，能在危急時把狗狗叫回身邊。

1. 蹲下、張開雙臂，用開心的聲音叫「過來！」
2. 狗一到你身邊，給**最棒的零食 + 大力稱讚**
3. 永遠不要在狗跑過來後罵牠或做牠不喜歡的事（否則牠下次不來）
4. 室內練熟後，換到有圍欄的空間練習

**黃金原則**：「過來」永遠是美好的事。就算牠闖禍了，叫過來後也要先獎勵，再去處理善後。

## 帶到戶外練習

等三個指令在室內都穩定後，才帶到散步路線或公園練習。戶外干擾多（其他狗、聲音、氣味），一開始可能退步是正常的——降低難度、增加獎勵就好。

訓練不是一蹴可幾，保持耐心，每次散步都是練習的機會。
`,
      en: `# Sit, Stay, Come: How to Teach Your Dog the Three Essential Commands

Training isn't about control—it's about communication. Modern animal behavior science agrees that **positive reinforcement** is the most effective and humane approach. These three commands form the foundation for all advanced training and are essential for safe, enjoyable walks.

> The methods here align with the **LIMA principle** (Least Intrusive, Minimally Aversive) as recommended by IAABC and PPG.

## Before You Start

- **Treats**: Use small, high-value rewards (pea-sized). Keep sessions short so your dog doesn't fill up on treats
- **Session length**: **5–10 minutes**, 2–3 times a day. Avoid training when your dog is overly excited or just ate
- **Environment**: Start indoors with minimal distractions. Move outdoors only once the behavior is solid

## Sit

The easiest first command.

1. Hold a treat near your dog's nose
2. Slowly move your hand back toward their ears—they'll naturally lower their rear to follow it
3. The moment their bottom touches the floor, **give the treat and say "yes!"**
4. After 5–10 repetitions, add the verbal cue "sit" *before* the motion

**Common mistake**: Lifting your hand too high causes jumping instead of sitting.

## Stay

Teach "sit" first, then add "stay."

1. Ask your dog to sit
2. Show an open palm (like a "stop" signal) and say "stay"
3. Wait 2 seconds, then reward—*before* they break the position
4. Gradually extend: 5 seconds → 10 → 30 → 1 minute
5. Once duration is solid, add distance (take one step back, then two…)

**Key principle**: Set your dog up to succeed. If they break, shorten the duration and try again.

## Come (Recall)

The most important safety command—it can save your dog's life.

1. Crouch down, open your arms, and call "come!" in a happy voice
2. When they reach you, give the **best treat you have + enthusiastic praise**
3. Never scold or do anything unpleasant immediately after they come to you—or they'll stop coming
4. Practice indoors first, then in a safely enclosed outdoor area

**Golden rule**: "Come" must always predict something wonderful. Even if your dog did something wrong, reward the recall first—handle the problem separately.

## Taking It Outdoors

Only move to outdoor practice once all three commands are reliable indoors. More distractions mean more difficulty, so dial back your expectations initially and increase the reward value.

Training takes time—every walk is a practice opportunity. Stay patient and keep sessions positive.
`,
    },
  },
  {
    title: {
      "zh-TW": "如廁訓練全攻略：讓狗狗定點上廁所",
      en: "Potty Training Your Dog: A Complete Guide to Teaching a Designated Spot",
    },
    category: "training",
    excerpt: {
      "zh-TW": "把握時機、立即獎勵、不要懲罰意外，如廁訓練其實沒有那麼難。",
      en: "Timing, immediate rewards, and skipping punishment—potty training is simpler than you think when you follow the right steps.",
    },
    authorName: "Mango Pet 編輯",
    tags: ["如廁訓練", "幼犬訓練", "室內訓練", "行為習慣"],
    contentMd: {
      "zh-TW": `# 如廁訓練全攻略：讓狗狗定點上廁所

如廁訓練是新手飼主的第一道關卡，也是讓同住家人都心服口服的關鍵。好消息是：只要掌握「時機 + 獎勵 + 耐心」三個核心，大多數幼犬在 2–4 週內就能建立穩定習慣。

## 原理：狗狗怎麼學會定點？

狗天生偏好在有自己氣味的地方如廁。如廁訓練的本質，就是**反覆讓牠在你指定的地點成功排泄，並立刻獎勵**，讓牠把「那個地方」和「好事」連結在一起。懲罰（打、罵、把牠的鼻子按進排泄物）只會讓狗學會「人在旁邊時不能上廁所」，反而更難訓練。

## 關鍵時機：這幾個時刻最容易成功

狗狗通常在以下情況後不久就需要上廁所：
- **睡醒後**（午睡、早起）
- **吃飯後 15–30 分鐘**
- **玩耍興奮後**
- **從籠子/圍欄出來後**

幼犬膀胱容量小，大約**每 1 小時需要一次如廁機會**（3 個月大的幼犬大約憋 3 小時是極限）。掌握這些時機，帶牠去定點，就成功了一半。

## 室內訓練：尿布墊的正確用法

1. **固定一個角落**放尿布墊，面積要夠大（幼犬常找不準位置）
2. 每次把牠帶到墊子旁，**等待**，不要催促
3. 開始排泄時不要出聲打擾；**結束後立刻給零食 + 稱讚**
4. 留一點氣味在墊子上，方便下次引導（不需要洗得一塵不染）
5. 逐漸縮小墊子面積，引導牠更精準

## 戶外定點：搭配遛狗習慣效果更好

如果目標是讓狗在戶外上廁所：
- 每次散步到**同一個地點**（如路邊某棵樹旁）先等牠排泄，排完再繼續走
- 散步的「探索與玩耍」就是最棒的獎勵
- 台灣法規要求飼主清理寵物排泄物，請隨身帶便便袋

## 發生意外時怎麼辦？

- **當場發現**：輕輕打斷（拍手），帶牠去正確地點，在那裡等牠排完再獎勵
- **事後發現**：不要罵，狗無法連結過去的行為與現在的懲罰；直接清潔，用寵物專用酵素清潔劑去除氣味，避免牠下次去同一地點
- **退步是正常的**：換環境、搬家、增加家庭成員都可能讓訓練暫時倒退，耐心重新建立即可

## 多久才會穩定？

大多數幼犬需要 **2–8 週**，成犬領養後也需要 1–2 週重新建立習慣。若 3 個月後還是頻繁失誤，建議就診排除膀胱炎、尿道感染等醫療原因。
`,
      en: `# Potty Training Your Dog: A Complete Guide

Potty training is the first big challenge for new dog owners. The good news: most puppies can build a reliable habit within 2–4 weeks if you stick to three core principles—**timing, rewards, and patience**.

## How Dogs Learn a Designated Spot

Dogs naturally prefer to eliminate where they've gone before. Potty training works by **consistently letting your dog succeed at the designated spot and immediately rewarding them**, so they associate that place with good things. Punishment (scolding, rubbing their nose in it) only teaches dogs not to go in front of you—making training harder, not easier.

## The Key Moments to Watch For

Dogs typically need to go shortly after:
- **Waking up** (morning or naps)
- **15–30 minutes after eating**
- **After play or excitement**
- **Coming out of a crate or pen**

Puppies have tiny bladders. A 3-month-old puppy can hold it for roughly 3 hours maximum. Watch the clock and be proactive.

## Indoor Training: Using Pee Pads Correctly

1. Place a pad in a **consistent corner**—make it large enough for a puppy who misjudges
2. Lead your dog to the pad, **wait quietly** without pushing
3. Let them finish without interruption, then **give a treat and praise immediately**
4. Leave a faint scent on the pad to guide them next time
5. Gradually reduce the pad size to sharpen accuracy

## Outdoor Spot Training

If you want your dog to go outside:
- Take them to **the same spot** every walk—let them eliminate before exploring further
- The walk itself (sniffing, playing) becomes the reward
- Always carry waste bags—it's both courtesy and required by law in Taiwan

## When Accidents Happen

- **Caught in the act**: Gently interrupt (a clap), redirect to the right spot, and reward when they finish there
- **Discovered later**: Don't scold. Dogs can't connect past behavior to present punishment. Clean with an **enzyme-based cleaner** to remove the scent marker
- **Regression is normal**: Moving, new family members, or a change in routine can cause setbacks—rebuild gradually

## How Long Does It Take?

Most puppies need **2–8 weeks**. Newly adopted adult dogs may need 1–2 weeks to adjust. If accidents persist beyond 3 months, visit a vet to rule out medical causes like a UTI or bladder issue.
`,
    },
  },
  {
    title: {
      "zh-TW": "牽繩暴衝不再來：散步不拉人的訓練技巧",
      en: "Stop the Pulling: How to Train Your Dog to Walk Nicely on a Leash",
    },
    category: "training",
    excerpt: {
      "zh-TW": "狗狗暴衝不是壞，只是沒學過。用「停止前進法」讓散步變成享受。",
      en: "Leash pulling isn't defiance—your dog just hasn't learned yet. The stop-and-wait method turns walks into a pleasure for both of you.",
    },
    authorName: "Mango Pet 編輯",
    tags: ["牽繩訓練", "散步習慣", "暴衝", "正向強化"],
    contentMd: {
      "zh-TW": `# 牽繩暴衝不再來：散步不拉人的訓練技巧

每次帶狗出門，牠就像火箭一樣往前衝，你拉不住、肩膀都快脫臼？這是台灣最常見的遛狗困擾之一。好消息是：牽繩暴衝幾乎都是**後天習得的壞習慣**，而不是犬種或性格問題——當然，也能用訓練改掉。

## 為什麼狗狗會暴衝？

邏輯很簡單：**拉繩子有用**。只要牠往前衝，你就跟上了，牠就學到「拉繩＝前進」。解法也一樣直接——讓拉繩這個行為**完全失效**。

## 核心方法：停止前進法（Stop & Wait）

這是動物行為學中驗證有效的方法，不需要特殊工具。

1. 正常散步，牽繩一繃緊（狗開始拉），**立刻停下腳步，一步都不走**
2. 等牠自己鬆開繩子（轉頭看你、往回走一步、坐下……任何讓繩子鬆弛的動作）
3. 繩子一鬆，**立刻說「好！」並繼續前進**（前進本身就是獎勵）
4. 若牠走在你旁邊不拉繩，偶爾給零食強化
5. 重複，保持一致

**重點**：每次都要停，一次都不能讓牠拉著你走成功。家庭成員也要統一做法，否則訓練效果會打折。

## 輔助工具：選對比強迫更重要

- **前扣式胸背帶（front-clip harness）**：D 環在胸口，拉繩時狗會自然轉向，物理上減少衝力，適合訓練期使用
- **頭部控制帶（head collar / Halti）**：像馬具，控制頭部方向；效果顯著，但需要讓狗先適應，不適合硬上
- **避免**：P 鏈（懲罰型項圈）、電擊項圈——這類工具可能造成疼痛和恐懼，與正向訓練原則相違背

## 加入「看我」指令

等到「不暴衝」穩定後，可以加入「看我（look）」——叫狗的名字或說「看我」，牠轉頭看你就給獎勵。在有干擾的地方（看到其他狗、松鼠），先讓牠看你，比硬拉更有效。

## 現實期待：需要多久？

- 每次散步都是訓練，初期可能很「慢」，因為你會一直停
- 多數狗在 **2–4 週一致練習**後會明顯改善
- 若狗狗因看到其他動物或人而反應過度（吠叫、衝撞），建議諮詢認證動物行為師，這涉及反應性行為的脫敏訓練

散步本來應該是你和狗共同享受的時光——花幾週訓練，換來往後幾年的輕鬆遛狗，非常值得。
`,
      en: `# Stop the Pulling: How to Train Your Dog to Walk Nicely on a Leash

Does your dog turn every walk into a tug-of-war? Leash pulling is one of the most common complaints from dog owners—but it's almost always a **learned behavior**, not a breed trait or personality flaw. That means it can be unlearned.

## Why Dogs Pull

The reason is simple: **pulling works**. If your dog surges forward and you follow, they learn "pull = move forward." The fix is equally direct—make pulling completely ineffective.

## The Core Technique: Stop and Wait

This is a behaviorally validated method that requires no special equipment.

1. Walk normally. The moment the leash goes taut, **stop completely—not another step**
2. Wait for your dog to release the tension (look back at you, step back, sit—anything that slackens the leash)
3. The instant the leash loosens, say "yes!" and **walk forward again** (moving forward IS the reward)
4. When your dog walks beside you without pulling, occasionally give a treat to reinforce it
5. Repeat, every single time—no exceptions

**Critical**: Every person who walks the dog must do this consistently. One person who lets the dog pull will undermine everyone else's work.

## Tools That Help (Without Force)

- **Front-clip harness**: The D-ring sits on the chest—when the dog pulls, they naturally turn sideways, reducing forward momentum. Good for the training phase
- **Head collar (e.g., Halti)**: Works like a horse halter; very effective but requires a proper introduction so the dog accepts it calmly
- **Avoid**: Prong collars, choke chains, and shock collars—these cause pain and fear, and conflict with humane training principles

## Adding "Look at Me"

Once loose-leash walking is consistent, add a "look" cue—say the dog's name or "look," and reward any eye contact. This is your go-to when distractions appear (another dog, a squirrel). Getting attention is far more effective than pulling back.

## Realistic Timeline

- Expect walks to feel slow at first—you'll stop a lot
- Most dogs show significant improvement after **2–4 weeks of consistent practice**
- If your dog lunges or barks reactively at triggers (other dogs, people), consult a certified animal behavior consultant—this involves desensitization work beyond basic leash training

A few weeks of consistent effort buys you years of enjoyable walks. It's worth it.
`,
    },
  },
  {
    title: {
      "zh-TW": "疫苗與驅蟲時程一次看懂",
      en: "Dog Vaccination and Deworming Schedule: Everything You Need to Know",
    },
    category: "health",
    excerpt: {
      "zh-TW": "從幼犬核心疫苗到每年追加、驅蟲頻率，用一張時程表幫你管理毛孩健康。",
      en: "From core puppy vaccines to annual boosters and deworming intervals—use this schedule to stay on top of your dog's preventive care.",
    },
    authorName: "Mango Pet 編輯",
    tags: ["疫苗", "驅蟲", "預防醫學", "幼犬健康"],
    contentMd: {
      "zh-TW": `# 疫苗與驅蟲時程一次看懂

預防勝於治療——這句話在毛孩照護上非常貼切。定期打疫苗、做驅蟲，是保護狗狗最基本、也最划算的健康投資。這篇整理以 **WSAVA（世界小動物獸醫師協會）2022 犬貓疫苗接種指南** 與台灣動物保護法規為依據，幫你把時程搞清楚。

> ⚠️ 實際施打計畫請與您的獸醫師確認，本文不替代專業診療建議。

## 核心疫苗：每隻狗都需要打

WSAVA 將疫苗分為「核心（core）」與「非核心（non-core）」。**核心疫苗**是所有狗都應接種的，包含：

| 疫苗 | 預防疾病 | 初次施打時機 |
|------|---------|------------|
| **犬瘟熱（CDV）** | 高致死率病毒感染 | 6–8 週齡開始 |
| **犬小病毒（CPV）** | 出血性腸炎，幼犬死亡率高 | 6–8 週齡開始 |
| **犬腺病毒（CAV）** | 傳染性肝炎 | 6–8 週齡開始 |
| **狂犬病** | 人畜共患，**台灣法定必打** | 依各縣市規定，通常 12 週後 |

### 幼犬疫苗時程（核心）

- **6–8 週**：第一劑（CDV + CPV + CAV 混合，俗稱「三合一」或「五合一」）
- **10–12 週**：第二劑
- **14–16 週**：第三劑（這劑最關鍵，此時母源抗體已消退，疫苗才能確實生效）
- **12 個月後（或 6 個月齡）**：追加一劑，確認保護完整
- **之後**：依疫苗種類，每 1–3 年追加（與獸醫確認）

### 狂犬病疫苗（台灣特別規定）

台灣《動物保護法》要求飼主為犬隻**每年施打狂犬病疫苗**，並在完成晶片登記後進行寵物登記。未依規定施打可依法裁罰，各縣市有時辦理免費注射活動，可向地方動保單位查詢。

## 非核心疫苗：依生活環境選擇

| 疫苗 | 適合對象 |
|------|---------|
| 犬舍咳（犬傳染性支氣管炎，Bordetella） | 常去寵物店、狗公園、托育 |
| 鉤端螺旋體（Leptospirosis） | 常在戶外、農村、積水環境活動 |
| 犬流感 | 常與其他狗接觸 |

是否施打由獸醫師根據你的狗的**生活型態和地區風險**評估。

## 驅蟲：內外寄生蟲都要顧

### 體外寄生蟲（跳蚤、壁蝨）
台灣氣候濕熱，**全年都有感染風險**，建議每月使用滴劑或每 3 個月用咀嚼錠（依產品標示）。常在公園、草地散步的狗尤其需要注意。壁蝨可傳播萊姆病、焦蟲症，勿輕忽。

### 體內寄生蟲（蛔蟲、鉤蟲、絛蟲）
- **幼犬**：從 2 週齡開始，每 2 週一次，直到 3 個月齡；之後每月一次到 6 個月齡
- **成犬**：每 3–6 個月定期驅蟲（依生活環境調整）

### 心絲蟲預防
台灣為心絲蟲流行地區，建議**每月服用心絲蟲預防藥**（多數產品同時涵蓋體內驅蟲）。

## 一張快速對照表

| 項目 | 幼犬 | 成犬 |
|------|------|------|
| 核心疫苗 | 6、10、14–16 週，12 個月追加 | 每 1–3 年 |
| 狂犬病 | 12 週後，第一年 | 每年 |
| 跳蚤/壁蝨 | 每月或每季 | 每月或每季 |
| 心絲蟲 | 每月 | 每月 |
| 腸道驅蟲 | 每 2 週（至 3 個月）→ 每月 | 每 3–6 個月 |

定期回診、保存接種紀錄（手冊或 app 紀錄），讓你的獸醫師也能掌握毛孩的完整健康史。
`,
      en: `# Dog Vaccination and Deworming Schedule: Everything You Need to Know

Preventive care is the most cost-effective investment you can make in your dog's health. This guide is based on the **WSAVA Vaccination Guidelines for Dogs and Cats (2022)** and Taiwan's animal protection regulations.

> ⚠️ Always confirm your dog's specific vaccination plan with your veterinarian. This article does not replace professional medical advice.

## Core Vaccines: Every Dog Needs These

WSAVA divides vaccines into **core** (recommended for all dogs) and **non-core** (based on lifestyle/risk). Core vaccines include:

| Vaccine | Disease Prevented | When to Start |
|---------|------------------|---------------|
| **Canine Distemper (CDV)** | Highly fatal viral disease | 6–8 weeks of age |
| **Parvovirus (CPV)** | Hemorrhagic gastroenteritis; high mortality in puppies | 6–8 weeks |
| **Adenovirus (CAV)** | Infectious hepatitis | 6–8 weeks |
| **Rabies** | Zoonotic; **legally required in Taiwan** | After 12 weeks |

### Puppy Core Vaccine Schedule

- **6–8 weeks**: First dose (combination vaccine: CDV + CPV + CAV)
- **10–12 weeks**: Second dose
- **14–16 weeks**: Third dose—**most critical**, as maternal antibodies have waned by this point
- **12 months (or 6 months of age)**: Booster to confirm full protection
- **Ongoing**: Every 1–3 years depending on vaccine type (confirm with your vet)

### Rabies Vaccine (Taiwan Requirement)

Taiwan's Animal Protection Act requires **annual rabies vaccination** for all dogs. After microchipping, owners must complete pet registration. Local animal protection offices sometimes offer free vaccination events—check with your county or city government.

## Non-Core Vaccines: Based on Your Dog's Lifestyle

| Vaccine | Recommended For |
|---------|----------------|
| Bordetella (Kennel Cough) | Dogs that visit groomers, dog parks, or boarding facilities |
| Leptospirosis | Dogs with outdoor, rural, or flooded-area exposure |
| Canine Influenza | Dogs with frequent contact with other dogs |

Your vet will assess which non-core vaccines make sense based on your dog's environment and risk profile.

## Deworming: Internal and External Parasites

### External Parasites (Fleas and Ticks)
Taiwan's humid climate means **year-round risk**. Monthly topical treatments or quarterly chewables (per product instructions) are recommended—especially for dogs that walk in parks or grassy areas. Ticks can transmit Lyme disease and babesiosis.

### Internal Parasites (Roundworm, Hookworm, Tapeworm)
- **Puppies**: Starting at 2 weeks of age, every 2 weeks until 3 months; then monthly until 6 months
- **Adult dogs**: Every 3–6 months, adjusted for lifestyle

### Heartworm Prevention
Taiwan is a heartworm-endemic region. **Monthly heartworm prevention** is strongly recommended—most products also cover intestinal worms.

## Quick Reference Chart

| Item | Puppy | Adult |
|------|-------|-------|
| Core vaccines | 6, 10, 14–16 weeks + 12-month booster | Every 1–3 years |
| Rabies | After 12 weeks, first year | Annually |
| Flea/tick | Monthly or quarterly | Monthly or quarterly |
| Heartworm | Monthly | Monthly |
| Intestinal deworming | Every 2 weeks (to 3 months) → monthly | Every 3–6 months |

Keep a vaccination record—in a booklet or a pet care app—so your vet always has a complete health history at hand.
`,
    },
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
