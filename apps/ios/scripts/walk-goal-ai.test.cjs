/**
 * Unit tests for the iOS AI walk-goal client + createPet walkGoal persistence.
 * Executes the TypeScript source modules directly via ts.transpileModule with
 * mocked @react-native-firebase/* boundaries (no Firestore emulator required).
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function loadTsModule(filePath, mocks = {}) {
  const cache = new Map();
  function resolveAndLoad(targetPath) {
    if (cache.has(targetPath)) return cache.get(targetPath);
    const mod = { exports: {} };
    cache.set(targetPath, mod);
    const source = fs.readFileSync(targetPath, "utf8");
    const js = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
    }).outputText;
    const customRequire = (name) => {
      if (Object.prototype.hasOwnProperty.call(mocks, name)) {
        return mocks[name];
      }
      if (name.startsWith(".")) {
        const resolved = path.resolve(path.dirname(targetPath), `${name}.ts`);
        return resolveAndLoad(resolved).exports;
      }
      return require(name);
    };
    new Function("require", "module", "exports", js)(
      customRequire,
      mod,
      mod.exports,
    );
    return mod;
  }
  return resolveAndLoad(path.resolve(filePath)).exports;
}

const corePath = path.resolve(__dirname, "../src/lib/ai-walk-goal-core.ts");
const nativePath = path.resolve(__dirname, "../src/lib/ai-walk-goal.ts");
const webPath = path.resolve(__dirname, "../src/lib/ai-walk-goal.web.ts");
const petsWritePath = path.resolve(__dirname, "../src/lib/pets-write.ts");

test("mapWalkGoalAiError recognizes prefixed and bare Firebase Functions codes", () => {
  const core = loadTsModule(corePath);
  assert.equal(
    core.mapWalkGoalAiError({ code: "functions/resource-exhausted" }),
    "rateLimit",
  );
  assert.equal(
    core.mapWalkGoalAiError({ code: "resource-exhausted" }),
    "rateLimit",
  );
  assert.equal(
    core.mapWalkGoalAiError({ code: "functions/failed-precondition" }),
    "unavailable",
  );
  assert.equal(
    core.mapWalkGoalAiError({ code: "failed-precondition" }),
    "unavailable",
  );
  assert.equal(core.mapWalkGoalAiError({ code: "functions/internal" }), "generic");
  assert.equal(core.mapWalkGoalAiError(new Error("boom")), "generic");
  assert.equal(core.mapWalkGoalAiError(null), "generic");
});

test("resolveWalkGoalSource switches to manual on override and restores computed on exact match", () => {
  const core = loadTsModule(corePath);
  assert.equal(core.resolveWalkGoalSource(30, null), "manual");
  assert.equal(core.resolveWalkGoalSource(45, 45), "computed");
  assert.equal(core.resolveWalkGoalSource(50, 45), "manual");
  assert.equal(core.resolveWalkGoalSource(45, 45), "computed");
});

test("buildWalkGoalRecommendInput normalizes comma decimals, blank fields, speciesOther, and locale", () => {
  const core = loadTsModule(corePath);
  assert.deepEqual(
    core.buildWalkGoalRecommendInput({
      species: "dog",
      speciesOther: "ignored",
      breed: "  Shiba  ",
      birthdayIso: "2024-01-15",
      gender: "female",
      weightText: " 8,5 ",
      petId: "pet-1",
      bio: "  ",
      locale: "en",
    }),
    {
      species: "dog",
      speciesOther: undefined,
      breed: "Shiba",
      birthday: "2024-01-15",
      gender: "female",
      weightKg: 8.5,
      petId: "pet-1",
      bio: undefined,
      locale: "en",
    },
  );

  assert.deepEqual(
    core.buildWalkGoalRecommendInput({
      species: "other",
      speciesOther: "  兔子 ",
      breed: "",
      gender: "unknown",
      weightText: "-3",
      bio: "愛跑跳",
      locale: "fr",
    }),
    {
      species: "other",
      speciesOther: "兔子",
      breed: undefined,
      birthday: undefined,
      gender: "unknown",
      weightKg: undefined,
      petId: undefined,
      bio: "愛跑跳",
      locale: "zh-TW",
    },
  );
});

test("recommendPetWalkGoal calls asia-east1 callable and returns recommendation data", async () => {
  const calls = [];
  const sampleRec = {
    minutes: 45,
    sessionsPerDay: 2,
    rationale: "適合幼犬循序漸進。",
    tips: ["避開正午高溫"],
    model: "gemini-test",
  };
  const mod = loadTsModule(nativePath, {
    "@react-native-firebase/functions": {
      firebase: {
        app: () => ({
          functions: (region) => {
            calls.push({ region });
            return {
              httpsCallable: (fnName) => async (payload) => {
                calls.push({ fnName, payload });
                return { data: sampleRec };
              },
            };
          },
        }),
      },
    },
  });

  const payload = { species: "dog", breed: "柴犬", locale: "zh-TW" };
  const result = await mod.recommendPetWalkGoal(payload);
  assert.deepEqual(result, sampleRec);
  assert.deepEqual(calls, [
    { region: "asia-east1" },
    { fnName: "recommendPetWalkGoal", payload },
  ]);
});

test("recommendPetWalkGoal browser preview stub rejects with functions/failed-precondition", async () => {
  const webMod = loadTsModule(webPath);
  await assert.rejects(
    webMod.recommendPetWalkGoal({ species: "dog" }),
    (err) =>
      err instanceof Error &&
      err.code === "functions/failed-precondition" &&
      webMod.mapWalkGoalAiError(err) === "unavailable",
  );
});

test("createPet persists walkGoal when provided and omits it when absent", async () => {
  const addedPayloads = [];
  const firestoreMock = () => ({
    collection: (name) => ({
      add: async (doc) => {
        addedPayloads.push({ name, doc });
        return { id: `pet-${addedPayloads.length}`, update: async () => {} };
      },
    }),
  });
  firestoreMock.FieldValue = {
    serverTimestamp: () => "__SERVER_TS__",
    delete: () => "__DELETE__",
  };
  firestoreMock.Timestamp = {
    fromDate: (d) => ({ __date: d.toISOString() }),
  };

  const petsWrite = loadTsModule(petsWritePath, {
    "@react-native-firebase/firestore": firestoreMock,
    "@react-native-firebase/storage": () => ({ ref: () => ({ delete: async () => {} }) }),
    "./photos": { uploadPetAvatar: async () => "https://example.test/a.jpg" },
  });

  await petsWrite.createPet("fam-1", "uid-1", {
    name: "Mango",
    species: "dog",
    walkGoal: { minutes: 45, source: "computed" },
  });

  await petsWrite.createPet(null, "uid-1", {
    name: "Mochi",
    species: "cat",
  });

  assert.equal(addedPayloads.length, 2);
  assert.deepEqual(addedPayloads[0].doc.walkGoal, {
    minutes: 45,
    source: "computed",
  });
  assert.equal(addedPayloads[0].doc.familyId, "fam-1");
  assert.equal("walkGoal" in addedPayloads[1].doc, false);
  assert.equal(addedPayloads[1].doc.familyId, null);
});
