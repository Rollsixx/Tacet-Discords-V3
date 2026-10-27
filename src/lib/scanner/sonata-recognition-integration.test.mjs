import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import path from "node:path";
import os from "node:os";

const require = createRequire(import.meta.url);

const runtime = path.join(
  os.tmpdir(),
  "tacet-v3-step3i12g",
  "runtime",
);

const decoder = require(
  path.join(runtime, "sonata-rgb-decoder.ts"),
);

const matcher = require(
  path.join(runtime, "image-matcher.ts"),
);

function syntheticRgb(r, g, b) {
  const bytes = Buffer.alloc(32 * 32 * 3);

  for (let i = 0; i < bytes.length; i += 3) {
    bytes[i] = r;
    bytes[i + 1] = g;
    bytes[i + 2] = b;
  }

  return bytes.toString("base64");
}

function image(r, g, b) {
  return decoder.decodeSonataReference(
    syntheticRgb(r, g, b),
  );
}

test("decoded Sonata uses matcher pixel structure", () => {
  const result = image(40, 40, 40);

  assert.equal(result.width, 32);
  assert.equal(result.height, 32);
  assert.equal(result.data.length, 4096);
});

test("identical decoded images have zero difference", () => {
  const a = image(200, 30, 40);
  const b = image(200, 30, 40);

  const score = matcher.comparePixelImages(a, b);

  assert.equal(score, 0);
});

test("different colors produce positive difference", () => {
  const a = image(255, 0, 0);
  const b = image(0, 0, 255);

  const score = matcher.comparePixelImages(a, b);

  assert.ok(score > 0);
});

test("exact candidate ranks ahead of different color", () => {
  const target = image(10, 200, 30);

  const candidates = [
    { key: "wrong", image: image(200, 10, 30) },
    { key: "correct", image: image(10, 200, 30) },
  ];

  const ranked = matcher.rankImageCandidates(
    target,
    candidates,
  );

  assert.equal(ranked[0].key, "correct");
  assert.equal(ranked[0].difference, 0);
});

test("ranking is deterministic for same input", () => {
  const target = image(50, 100, 150);

  const candidates = [
    { key: "a", image: image(50, 100, 150) },
    { key: "b", image: image(150, 100, 50) },
  ];

  const first = matcher.rankImageCandidates(
    target,
    candidates,
  );

  const second = matcher.rankImageCandidates(
    target,
    candidates,
  );

  assert.deepEqual(first, second);
});

test("32x32 decoded reference retains opaque alpha", () => {
  const result = image(40, 40, 40);

  for (let i = 3; i < result.data.length; i += 4) {
    assert.equal(result.data[i], 255);
  }
});