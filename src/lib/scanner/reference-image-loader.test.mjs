import assert from "node:assert/strict";
import { test } from "node:test";
import {
  validateReferenceDimensions,
  validateReferenceSources,
  loadReferenceCandidates,
  decodeReferenceImage,
} from "./reference-image-loader.ts";

test("valid reference dimensions are accepted", () => {
  assert.doesNotThrow(() =>
    validateReferenceDimensions(192, 182),
  );
});

test("zero-sized dimensions are rejected", () => {
  assert.throws(() =>
    validateReferenceDimensions(0, 182),
  );
});

test("negative dimensions are rejected", () => {
  assert.throws(() =>
    validateReferenceDimensions(-1, 182),
  );
});

test("fractional dimensions are rejected", () => {
  assert.throws(() =>
    validateReferenceDimensions(192.5, 182),
  );
});

test("oversized dimensions are rejected", () => {
  assert.throws(() =>
    validateReferenceDimensions(5000, 182),
  );
});

test("local reference paths are accepted", () => {
  assert.doesNotThrow(() =>
    validateReferenceSources([
      { key: "sample", url: "/references/sample.png" },
    ]),
  );
});

test("image data URLs are accepted", () => {
  assert.doesNotThrow(() =>
    validateReferenceSources([
      {
        key: "sample",
        url: "data:image/png;base64,AA==",
      },
    ]),
  );
});

test("remote reference URLs are rejected", () => {
  assert.throws(() =>
    validateReferenceSources([
      {
        key: "sample",
        url: "https://example.com/sample.png",
      },
    ]),
  );
});

test("protocol-relative URLs are rejected", () => {
  assert.throws(() =>
    validateReferenceSources([
      {
        key: "sample",
        url: "//example.com/sample.png",
      },
    ]),
  );
});

test("duplicate keys are rejected", () => {
  assert.throws(() =>
    validateReferenceSources([
      { key: "same", url: "/a.png" },
      { key: "same", url: "/b.png" },
    ]),
  );
});

test("empty keys are rejected", () => {
  assert.throws(() =>
    validateReferenceSources([
      { key: " ", url: "/a.png" },
    ]),
  );
});

test("empty reference list returns no candidates", async () => {
  const result = await loadReferenceCandidates(
    [],
    192,
    182,
  );

  assert.deepEqual(result, {
    candidates: [],
    failures: [],
  });
});

test("decoded reference pixels are reused across scans and concurrent loads", async () => {
  const originalFetch = globalThis.fetch;
  const originalBitmap = globalThis.createImageBitmap;
  const originalDocument = globalThis.document;
  let fetches = 0;
  let decodes = 0;
  globalThis.fetch = async (_url, options) => {
    fetches += 1;
    assert.equal(options.cache, "force-cache");
    return { ok: true, blob: async () => ({}) };
  };
  globalThis.createImageBitmap = async () => {
    decodes += 1;
    return { close() {} };
  };
  globalThis.document = { createElement: () => ({
    getContext: () => ({
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "",
      drawImage() {},
      getImageData: () => ({ width: 2, height: 2, data: new Uint8ClampedArray(16) }),
    }),
  }) };
  try {
    const source = { key: "cache-test", url: "/cache-test-reference.png" };
    const [first, concurrent] = await Promise.all([
      decodeReferenceImage(source, 2, 2),
      decodeReferenceImage(source, 2, 2),
    ]);
    const repeated = await decodeReferenceImage(source, 2, 2);
    assert.equal(fetches, 1);
    assert.equal(decodes, 1);
    assert.strictEqual(first, concurrent);
    assert.strictEqual(first, repeated);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.createImageBitmap = originalBitmap;
    globalThis.document = originalDocument;
  }
});
