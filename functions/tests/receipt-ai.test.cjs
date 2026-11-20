const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  RECEIPT_AI_MODEL,
  RECEIPT_RATE_LIMIT_MAX,
  RECEIPT_RATE_LIMIT_WINDOW_MS,
  MAX_RECEIPT_IMAGE_BYTES,
  MAX_RECEIPT_BASE64_LENGTH,
  RECEIPT_RESPONSE_SCHEMA,
  normalizeReceiptRequest,
  coerceReceiptCategory,
  parseValidIsoDate,
  parseReceiptResponse,
  enforceReceiptRateLimit,
  extractReceiptWithGemini,
} = require("../lib/receipt-ai.js");

const SAMPLE_BASE64 = Buffer.from("fake-receipt-jpeg-bytes").toString("base64");

test("normalizeReceiptRequest accepts allowed image MIME types, normalizes data URLs/whitespace, and rejects invalid inputs", () => {
  for (const mime of [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ]) {
    const res = normalizeReceiptRequest({
      imageBase64: SAMPLE_BASE64,
      mimeType: mime,
    });
    assert.deepEqual(res, { imageBase64: SAMPLE_BASE64, mimeType: mime });
  }

  const normalizedAliasAndFormatting = normalizeReceiptRequest({
    imageBase64: `  data:image/jpeg;base64,${SAMPLE_BASE64.slice(0, 8)}\n  ${SAMPLE_BASE64.slice(8)}  `,
    mimeType: " IMAGE/JPG ; charset=utf-8 ",
  });
  assert.deepEqual(normalizedAliasAndFormatting, {
    imageBase64: SAMPLE_BASE64,
    mimeType: "image/jpeg",
  });

  for (const invalidPayload of [null, undefined, [], "string", 123]) {
    assert.throws(
      () => normalizeReceiptRequest(invalidPayload),
      (err) => err.code === "invalid-argument",
    );
  }

  for (const badMime of ["application/pdf", "image/gif", "text/plain", ""]) {
    assert.throws(
      () =>
        normalizeReceiptRequest({
          imageBase64: SAMPLE_BASE64,
          mimeType: badMime,
        }),
      (err) => err.code === "invalid-argument",
    );
  }

  for (const badBase64 of [
    "",
    "   ",
    "data:image/jpeg;base64,   ",
    "abc",
    "ab=c",
    "abc$def=",
  ]) {
    assert.throws(
      () =>
        normalizeReceiptRequest({
          imageBase64: badBase64,
          mimeType: "image/jpeg",
        }),
      (err) => err.code === "invalid-argument",
    );
  }

  const oversizedBase64 = "A".repeat(MAX_RECEIPT_BASE64_LENGTH + 4);
  assert.throws(
    () =>
      normalizeReceiptRequest({
        imageBase64: oversizedBase64,
        mimeType: "image/jpeg",
      }),
    (err) => err.code === "invalid-argument",
  );

  // Exact decoded limit should pass; +1 byte (still within base64 char boundary if not padded) is checked too.
  const exactMaxBytesBase64 = Buffer.alloc(MAX_RECEIPT_IMAGE_BYTES, 1).toString(
    "base64",
  );
  assert.equal(exactMaxBytesBase64.length, MAX_RECEIPT_BASE64_LENGTH);
  const exactRes = normalizeReceiptRequest({
    imageBase64: exactMaxBytesBase64,
    mimeType: "image/png",
  });
  assert.equal(exactRes.mimeType, "image/png");
});

test("parseReceiptResponse parses plain and fenced JSON, normalizes fields, and rejects malformed output", () => {
  const longVendor = `  ${"毛孩寵物醫院".repeat(30)}  `;
  const manyItems = Array.from({ length: 60 }, (_, idx) => `  品項${idx + 1}  `);
  manyItems.splice(2, 0, "   ", 42);

  const parsedFenced = parseReceiptResponse(
    "```json\n" +
      JSON.stringify({
        amount: 1234.567,
        vendor: longVendor,
        spentAt: "2026-11-20",
        category: "medical",
        items: manyItems,
      }) +
      "\n```",
  );
  assert.equal(parsedFenced.amount, 1234.57);
  assert.equal(parsedFenced.vendor.length, 120);
  assert.equal(parsedFenced.spentAt, "2026-11-20");
  assert.equal(parsedFenced.category, "medical");
  assert.equal(parsedFenced.items.length, 50);
  assert.equal(parsedFenced.items[0], "品項1");

  const parsedFallback = parseReceiptResponse(
    JSON.stringify({
      amount: 0,
      vendor: "   ",
      spentAt: "2026-02-31",
      category: "unknown-cat",
      items: [],
    }),
  );
  assert.deepEqual(parsedFallback, {
    amount: undefined,
    vendor: undefined,
    spentAt: undefined,
    category: "other",
    items: [],
  });

  const parsedRocAndNeg = parseReceiptResponse(
    JSON.stringify({
      amount: -50,
      vendor: "Happy Pets",
      spentAt: "115/11/20",
      category: "food",
      items: ["飼料"],
    }),
  );
  assert.deepEqual(parsedRocAndNeg, {
    amount: undefined,
    vendor: "Happy Pets",
    spentAt: undefined,
    category: "food",
    items: ["飼料"],
  });

  const parsedNaNAndBool = parseReceiptResponse(
    JSON.stringify({
      amount: true,
      vendor: "Pet Spa",
      spentAt: "1999-01-01",
      category: "grooming",
      items: ["洗澡"],
    }),
  );
  assert.deepEqual(parsedNaNAndBool, {
    amount: undefined,
    vendor: "Pet Spa",
    spentAt: undefined,
    category: "grooming",
    items: ["洗澡"],
  });

  assert.equal(coerceReceiptCategory("insurance"), "insurance");
  assert.equal(coerceReceiptCategory("invalid"), "other");
  assert.equal(parseValidIsoDate("2024-02-29"), "2024-02-29");
  assert.equal(parseValidIsoDate("2025-02-29"), undefined);

  for (const badText of [undefined, "", "   ", "{bad-json", "[1, 2, 3]"]) {
    assert.throws(
      () => parseReceiptResponse(badText),
      (err) => err.code === "internal",
    );
  }
});

test("extractReceiptWithGemini calls Interactions API with gemini-4-hydrogen, high image resolution, and no deprecated sampling params", async () => {
  let capturedParams = null;
  const result = await extractReceiptWithGemini(
    {
      imageBase64: SAMPLE_BASE64,
      mimeType: "image/jpeg",
    },
    {
      createInteraction: async (params) => {
        capturedParams = params;
        return {
          output_text: JSON.stringify({
            amount: 880,
            vendor: "旺旺動物醫院",
            spentAt: "2026-11-18",
            category: "medical",
            items: ["基礎門診費", "驅蟲藥"],
          }),
        };
      },
    },
  );

  assert.equal(capturedParams.model, RECEIPT_AI_MODEL);
  assert.equal(capturedParams.model, "gemini-4-hydrogen");
  assert.equal(capturedParams.store, false);
  assert.deepEqual(capturedParams.generation_config, {
    thinking_level: "low",
  });
  assert.equal("temperature" in capturedParams.generation_config, false);
  assert.equal("top_p" in capturedParams.generation_config, false);
  assert.equal("top_k" in capturedParams.generation_config, false);
  assert.deepEqual(capturedParams.response_format, {
    type: "text",
    mime_type: "application/json",
    schema: RECEIPT_RESPONSE_SCHEMA,
  });
  assert.equal(capturedParams.input[0].type, "text");
  assert.deepEqual(capturedParams.input[1], {
    type: "image",
    data: SAMPLE_BASE64,
    mime_type: "image/jpeg",
    resolution: "high",
  });

  assert.deepEqual(result, {
    amount: 880,
    vendor: "旺旺動物醫院",
    spentAt: "2026-11-18",
    category: "medical",
    items: ["基礎門診費", "驅蟲藥"],
  });

  await assert.rejects(
    extractReceiptWithGemini({
      imageBase64: SAMPLE_BASE64,
      mimeType: "image/jpeg",
    }),
    (err) => err.code === "failed-precondition",
  );
});

function createMockDb(initialDocs = {}) {
  const store = new Map(Object.entries(initialDocs));
  const makeSnap = (val) => ({
    exists: val !== undefined,
    data: () => val,
  });
  return {
    store,
    doc(docPath) {
      return { path: docPath };
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

test("enforceReceiptRateLimit caps 30 requests/hour, resets after window expires, and rejects invalid uid", async () => {
  const db = createMockDb();
  const t0 = 1_700_000_000_000;

  await assert.rejects(
    enforceReceiptRateLimit(db, "bad/uid", t0),
    (err) => err.code === "invalid-argument",
  );

  for (let i = 0; i < RECEIPT_RATE_LIMIT_MAX; i++) {
    await enforceReceiptRateLimit(db, "user-1", t0 + i * 1000);
  }
  assert.equal(db.store.get("aiRateLimits/receipt_user-1").count, 30);

  await assert.rejects(
    enforceReceiptRateLimit(db, "user-1", t0 + 60_000),
    (err) => err.code === "resource-exhausted",
  );

  await enforceReceiptRateLimit(
    db,
    "user-1",
    t0 + RECEIPT_RATE_LIMIT_WINDOW_MS + 1,
  );
  assert.equal(db.store.get("aiRateLimits/receipt_user-1").count, 1);
});
