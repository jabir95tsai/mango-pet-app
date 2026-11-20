const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  WALK_GOAL_AI_MODEL,
  WALK_GOAL_RATE_LIMIT_MAX,
  WALK_GOAL_RATE_LIMIT_WINDOW_MS,
  WALK_GOAL_RESPONSE_SCHEMA,
  snapAndClampWalkGoalMinutes,
  computeAgeSummary,
  normalizeWalkGoalRequest,
  buildWalkGoalSystemInstruction,
  buildWalkGoalPrompt,
  parseWalkGoalResponse,
  loadRecentPetWalkSummary,
  enforceWalkGoalRateLimit,
  generateWalkGoalRecommendation,
} = require("../lib/walk-goal-ai.js");

test("snapAndClampWalkGoalMinutes clamps [5, 180], snaps to 5-min steps, and falls back to 30", () => {
  assert.equal(snapAndClampWalkGoalMinutes(30), 30);
  assert.equal(snapAndClampWalkGoalMinutes(32), 30);
  assert.equal(snapAndClampWalkGoalMinutes(33), 35);
  assert.equal(snapAndClampWalkGoalMinutes(2), 5);
  assert.equal(snapAndClampWalkGoalMinutes(183), 180);
  assert.equal(snapAndClampWalkGoalMinutes(180), 180);
  assert.equal(snapAndClampWalkGoalMinutes(NaN), 30);
  assert.equal(snapAndClampWalkGoalMinutes(Infinity), 30);
  assert.equal(snapAndClampWalkGoalMinutes(-10), 30);
  assert.equal(snapAndClampWalkGoalMinutes("45"), 30);
});

test("computeAgeSummary formats puppy months and adult years, and rejects invalid/future birthdays", () => {
  const now = new Date("2026-11-19T00:00:00Z");
  assert.equal(computeAgeSummary("2026-11-10", now), "under 1 month");
  assert.equal(computeAgeSummary("2026-07-19", now), "4 months");
  assert.equal(computeAgeSummary("2023-05-19", now), "3.5 years");
  assert.equal(computeAgeSummary("2027-01-01", now), undefined);
  assert.equal(computeAgeSummary("2024-02-31", now), undefined);
  assert.equal(computeAgeSummary("1970-01-01", now), undefined);
});

test("normalizeWalkGoalRequest validates fields, trims strings, and defaults locale", () => {
  const now = new Date("2026-11-19T00:00:00Z");
  const normalized = normalizeWalkGoalRequest(
    {
      species: "dog",
      breed: "  Shiba Inu  ",
      birthday: "2024-05-19",
      gender: "male",
      weightKg: 9.24,
      petId: "pet_123",
      bio: "  Energetic morning walker  ",
      locale: "en",
    },
    now,
  );
  assert.deepEqual(normalized, {
    species: "dog",
    speciesOther: undefined,
    breed: "Shiba Inu",
    birthday: "2024-05-19",
    gender: "male",
    weightKg: 9.2,
    petId: "pet_123",
    bio: "Energetic morning walker",
    locale: "en",
  });

  const otherPet = normalizeWalkGoalRequest(
    {
      species: "other",
      speciesOther: "  Rabbit ",
      locale: "unknown-locale",
    },
    now,
  );
  assert.equal(otherPet.speciesOther, "Rabbit");
  assert.equal(otherPet.locale, "zh-TW");

  assert.throws(
    () => normalizeWalkGoalRequest({ species: "dragon" }, now),
    (err) => err.code === "invalid-argument",
  );
  assert.throws(
    () => normalizeWalkGoalRequest({ species: "dog", weightKg: 0 }, now),
    (err) => err.code === "invalid-argument",
  );
  assert.throws(
    () => normalizeWalkGoalRequest({ species: "dog", weightKg: 200 }, now),
    (err) => err.code === "invalid-argument",
  );
  assert.throws(
    () => normalizeWalkGoalRequest({ species: "dog", birthday: "2027-01-01" }, now),
    (err) => err.code === "invalid-argument",
  );
  assert.throws(
    () => normalizeWalkGoalRequest({ species: "dog", birthday: "2024-02-31" }, now),
    (err) => err.code === "invalid-argument",
  );
  assert.throws(
    () => normalizeWalkGoalRequest({ species: "dog", petId: "bad/id" }, now),
    (err) => err.code === "invalid-argument",
  );
  assert.throws(
    () => normalizeWalkGoalRequest({ species: "dog", bio: "a".repeat(301) }, now),
    (err) => err.code === "invalid-argument",
  );
});

test("buildWalkGoalSystemInstruction and buildWalkGoalPrompt include locale and recent walk baseline", () => {
  const now = new Date("2026-11-19T00:00:00Z");
  const zhInstruction = buildWalkGoalSystemInstruction("zh-TW");
  assert.match(zhInstruction, /繁體中文/);
  const enInstruction = buildWalkGoalSystemInstruction("en");
  assert.match(enInstruction, /English/);

  const promptWithBaseline = buildWalkGoalPrompt(
    {
      species: "dog",
      breed: "Corgi",
      birthday: "2023-11-19",
      gender: "female",
      weightKg: 11.5,
      bio: "Loves river park trails",
      locale: "zh-TW",
    },
    { walkCount: 6, avgDurationMin: 35, avgDistanceKm: 2.1 },
    now,
  );
  assert.match(promptWithBaseline, /Species: dog/);
  assert.match(promptWithBaseline, /Breed: Corgi/);
  assert.match(promptWithBaseline, /Age: 3 years/);
  assert.match(promptWithBaseline, /Weight: 11.5 kg/);
  assert.match(promptWithBaseline, /6 walks, avg 35 min\/walk, avg 2.1 km\/walk/);
});

test("parseWalkGoalResponse parses fenced JSON, clamps fields, and rejects malformed responses", () => {
  const parsed = parseWalkGoalResponse(
    "```json\n" +
      JSON.stringify({
        minutes: 47,
        sessionsPerDay: 9,
        rationale: "  適合中型成犬的每日運動量。  ",
        tips: [" 早晚各一次 ", " ", "避開正午高溫", "第三點", "第四點"],
      }) +
      "\n```",
  );
  assert.deepEqual(parsed, {
    minutes: 45,
    sessionsPerDay: 4,
    rationale: "適合中型成犬的每日運動量。",
    tips: ["早晚各一次", "避開正午高溫", "第三點"],
  });

  assert.throws(
    () => parseWalkGoalResponse("{not-json"),
    (err) => err.code === "internal",
  );
  assert.throws(
    () =>
      parseWalkGoalResponse(
        JSON.stringify({ minutes: 30, sessionsPerDay: 2, rationale: "", tips: ["ok"] }),
      ),
    (err) => err.code === "internal",
  );
  assert.throws(
    () =>
      parseWalkGoalResponse(
        JSON.stringify({ minutes: 30, sessionsPerDay: 2, rationale: "ok", tips: [] }),
      ),
    (err) => err.code === "internal",
  );
});

test("generateWalkGoalRecommendation invokes Interactions API with gemini-4-hydrogen and store: false", async () => {
  let capturedParams = null;
  const result = await generateWalkGoalRecommendation(
    {
      species: "dog",
      breed: "Golden Retriever",
      gender: "male",
      weightKg: 28,
      locale: "en",
    },
    {
      recentWalkSummary: { walkCount: 4, avgDurationMin: 40, avgDistanceKm: 2.6 },
      createInteraction: async (params) => {
        capturedParams = params;
        return {
          output_text: JSON.stringify({
            minutes: 62,
            sessionsPerDay: 2,
            rationale: "A healthy adult Golden Retriever thrives on around an hour of daily brisk walks.",
            tips: [
              "Split into morning and evening walks.",
              "Bring water on warm days.",
            ],
          }),
        };
      },
    },
  );

  assert.equal(capturedParams.model, WALK_GOAL_AI_MODEL);
  assert.equal(WALK_GOAL_AI_MODEL, "gemini-4-hydrogen");
  assert.equal(capturedParams.store, false);
  assert.deepEqual(capturedParams.generation_config, { thinking_level: "low" });
  assert.deepEqual(capturedParams.response_format, {
    type: "text",
    mime_type: "application/json",
    schema: WALK_GOAL_RESPONSE_SCHEMA,
  });
  assert.match(capturedParams.input, /Golden Retriever/);
  assert.match(capturedParams.input, /4 walks, avg 40 min\/walk/);

  assert.deepEqual(result, {
    minutes: 60,
    sessionsPerDay: 2,
    rationale: "A healthy adult Golden Retriever thrives on around an hour of daily brisk walks.",
    tips: [
      "Split into morning and evening walks.",
      "Bring water on warm days.",
    ],
    model: WALK_GOAL_AI_MODEL,
  });
});

function createMockDb(initialDocs) {
  const store = new Map(Object.entries(initialDocs));
  const makeSnap = (val) => ({
    exists: val !== undefined,
    data: () => val,
  });
  const doc = (docPath) => ({
    path: docPath,
    async get() {
      return makeSnap(store.get(docPath));
    },
  });
  return {
    store,
    doc,
    collection(name) {
      return {
        where(field, _op, value) {
          return {
            limit(n) {
              return {
                async get() {
                  const docs = [];
                  for (const [docPath, val] of store.entries()) {
                    if (docPath.startsWith(`${name}/`) && val[field] === value) {
                      docs.push({ data: () => val });
                      if (docs.length >= n) break;
                    }
                  }
                  return { docs };
                },
              };
            },
          };
        },
      };
    },
    async runTransaction(fn) {
      const tx = {
        async get(ref) {
          return makeSnap(store.get(ref.path));
        },
        set(ref, data, opts) {
          if (opts?.merge && store.has(ref.path)) {
            store.set(ref.path, { ...store.get(ref.path), ...data });
          } else {
            store.set(ref.path, { ...data });
          }
        },
      };
      return fn(tx);
    },
  };
}

test("enforceWalkGoalRateLimit caps 20 requests/hour and resets after window expires", async () => {
  const db = createMockDb({});
  const t0 = 1_700_000_000_000;

  for (let i = 0; i < WALK_GOAL_RATE_LIMIT_MAX; i++) {
    await enforceWalkGoalRateLimit(db, "user-1", t0 + i * 1000);
  }

  await assert.rejects(
    enforceWalkGoalRateLimit(db, "user-1", t0 + 30_000),
    (err) => err.code === "resource-exhausted",
  );

  await enforceWalkGoalRateLimit(
    db,
    "user-1",
    t0 + WALK_GOAL_RATE_LIMIT_WINDOW_MS + 1,
  );
  assert.equal(db.store.get("aiRateLimits/walkGoal_user-1").count, 1);
});

test("loadRecentPetWalkSummary checks authorization and summarizes only the last 14 days", async () => {
  const now = new Date("2026-11-19T12:00:00Z");
  const within3Days = new Date("2026-11-16T12:00:00Z");
  const within10Days = new Date("2026-11-09T12:00:00Z");
  const oldWalk20Days = new Date("2026-10-30T12:00:00Z");

  const db = createMockDb({
    "pets/personal-pet": { familyId: null, ownerUid: "owner-1" },
    "pets/family-pet": { familyId: "fam-1", ownerUid: "owner-1" },
    "families/fam-1": { memberUids: ["owner-1", "member-2"] },
    "walks/w1": { petId: "personal-pet", startedAt: within3Days, durationMin: 40, distanceKm: 2.5 },
    "walks/w2": { petId: "personal-pet", startedAt: within10Days, durationMin: 20, distanceKm: 1.5 },
    "walks/w3": { petId: "personal-pet", startedAt: oldWalk20Days, durationMin: 120, distanceKm: 9 },
    "walks/w4": { petId: "family-pet", startedAt: within3Days, durationMin: 30, distanceKm: 2.0 },
  });

  const personalSummary = await loadRecentPetWalkSummary(db, "owner-1", "personal-pet", now);
  assert.deepEqual(personalSummary, {
    walkCount: 2,
    avgDurationMin: 30,
    avgDistanceKm: 2,
  });

  const familyMemberSummary = await loadRecentPetWalkSummary(db, "member-2", "family-pet", now);
  assert.deepEqual(familyMemberSummary, {
    walkCount: 1,
    avgDurationMin: 30,
    avgDistanceKm: 2,
  });

  const unauthorizedSummary = await loadRecentPetWalkSummary(db, "stranger", "personal-pet", now);
  assert.equal(unauthorizedSummary, undefined);

  const strangerFamilySummary = await loadRecentPetWalkSummary(db, "stranger", "family-pet", now);
  assert.equal(strangerFamilySummary, undefined);
});
