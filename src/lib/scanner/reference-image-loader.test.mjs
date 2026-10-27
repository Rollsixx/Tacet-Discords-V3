import assert from "node:assert/strict";
import { test } from "node:test";
import {
  validateReferenceDimensions,
  validateReferenceSources,
  loadReferenceCandidates,
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