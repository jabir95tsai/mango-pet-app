const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  OBJECTIONABLE_TERMS_ZH,
  OBJECTIONABLE_TERMS_EN,
  findObjectionableTerm,
  hasObjectionableContent,
  autoModerateCreatedContent,
} = require("../lib/moderation-helpers.js");

test("shared-business and functions moderation term lists stay aligned", () => {
  const sharedSource = fs.readFileSync(
    path.resolve(__dirname, "../../packages/shared-business/src/moderation.ts"),
    "utf8",
  );
  for (const term of OBJECTIONABLE_TERMS_ZH) {
    assert.equal(
      sharedSource.includes(JSON.stringify(term)),
      true,
      `Missing ZH term in @mango/shared-business: ${term}`,
    );
  }
  for (const term of OBJECTIONABLE_TERMS_EN) {
    assert.equal(
      sharedSource.includes(JSON.stringify(term)),
      true,
      `Missing EN term in @mango/shared-business: ${term}`,
    );
  }
});

test("detects explicit ZH and EN objectionable content including simple obfuscation", () => {
  const blockedSamples = [
    ["幹你娘", "幹你娘"],
    ["幹*你*娘", "幹你娘"],
    ["去 死 吧 你這傢伙", "去死吧"],
    ["What the fuck is this", "fuck"],
    ["ＦＵＣＫ that", "fuck"],
    ["f.u.c.k off", "fuck"],
    ["you should kill yourself", "kill yourself"],
    ["這是約炮文", "約炮"],
  ];

  for (const [text, expected] of blockedSamples) {
    assert.equal(hasObjectionableContent(text), true, `Expected blocked: ${text}`);
    assert.equal(findObjectionableTerm(text), expected);
  }
});

test("does not false-positive on normal pet-care and everyday vocabulary", () => {
  const safeSamples = [
    "",
    "   ",
    "今天帶芒果去河濱公園散步 30 分鐘！",
    "我家公狗跟母狗今天去結紮，恢復得很順利",
    "狗狗發情期散步要注意什麼？",
    "剛才散步大便跟尿尿都很正常",
    "Cute cockapoo and shih tzu in training class today",
    "Passed the grassy park with classic Shiba smile",
    "買了一個 pizza片 分享給朋友",
    "今天跟朋友聊天的時候幹嘛不帶狗狗一起來",
  ];

  for (const text of safeSamples) {
    assert.equal(hasObjectionableContent(text), false, `False positive on: ${text}`);
    assert.equal(findObjectionableTerm(text), null);
  }
});

function createMockDb(initialDocs) {
  const store = new Map(Object.entries(initialDocs));
  const doc = (docPath) => ({
    path: docPath,
  });
  return {
    store,
    doc,
    async runTransaction(fn) {
      const tx = {
        async get(ref) {
          const val = store.get(ref.path);
          return {
            exists: val !== undefined,
            data: () => val,
          };
        },
        update(ref, patch) {
          const current = store.get(ref.path);
          if (!current) throw new Error(`Missing doc ${ref.path}`);
          store.set(ref.path, { ...current, ...patch });
        },
        create(ref, data) {
          if (store.has(ref.path)) throw new Error(`Doc already exists ${ref.path}`);
          store.set(ref.path, { ...data });
        },
      };
      return fn(tx);
    },
  };
}

test("autoModerateCreatedContent hides objectionable posts and records audit once", async () => {
  const db = createMockDb({
    "posts/post-bad": { authorUid: "u1", text: "Hello bitch" },
  });

  const first = await autoModerateCreatedContent(db, {
    targetType: "post",
    targetId: "post-bad",
    authorUid: "u1",
    text: "Hello bitch",
  });
  assert.deepEqual(first, { hidden: true, matchedTerm: "bitch" });
  assert.equal(db.store.get("posts/post-bad").hidden, true);
  assert.equal(db.store.get("posts/post-bad").autoHiddenReason, "objectionable_text");

  const auditEntries = Array.from(db.store.entries()).filter(([k]) =>
    k.startsWith("moderationAudit/auto-"),
  );
  assert.equal(auditEntries.length, 1);
  assert.equal(auditEntries[0][1].action, "auto_hide_keyword");
  assert.equal(auditEntries[0][1].matchedTerm, "bitch");

  // Replaying should stay idempotent without throwing
  const second = await autoModerateCreatedContent(db, {
    targetType: "post",
    targetId: "post-bad",
    authorUid: "u1",
    text: "Hello bitch",
  });
  assert.deepEqual(second, { hidden: true, matchedTerm: "bitch" });
});

test("autoModerateCreatedContent hides objectionable comments and skips clean text", async () => {
  const db = createMockDb({
    "posts/p1/comments/c-clean": { authorUid: "u1", text: "好可愛的柴犬" },
    "posts/p1/comments/c-bad": { authorUid: "u2", text: "幹你娘" },
  });

  const clean = await autoModerateCreatedContent(db, {
    targetType: "comment",
    targetId: "c-clean",
    postId: "p1",
    authorUid: "u1",
    text: "好可愛的柴犬",
  });
  assert.deepEqual(clean, { hidden: false, matchedTerm: null });
  assert.equal(db.store.get("posts/p1/comments/c-clean").hidden, undefined);

  const bad = await autoModerateCreatedContent(db, {
    targetType: "comment",
    targetId: "c-bad",
    postId: "p1",
    authorUid: "u2",
    text: "幹你娘",
  });
  assert.deepEqual(bad, { hidden: true, matchedTerm: "幹你娘" });
  assert.equal(db.store.get("posts/p1/comments/c-bad").hidden, true);
});
