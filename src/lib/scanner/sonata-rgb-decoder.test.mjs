import assert from "node:assert/strict";
import { test } from "node:test";

import {
  decodeBase64Rgb,
  decodeSonataReference,
  validateRgbDimensions,
} from "./sonata-rgb-decoder.ts";

function encode(bytes) {
  return Buffer.from(bytes).toString("base64");
}

test("decodes one RGB pixel", () => {
  const image = decodeBase64Rgb(
    encode([10, 20, 30]),
    1,
    1,
  );

  assert.equal(image.width, 1);
  assert.equal(image.height, 1);
  assert.deepEqual(
    Array.from(image.data),
    [10, 20, 30, 255],
  );
});

test("decodes multiple pixels in order", () => {
  const image = decodeBase64Rgb(
    encode([255, 0, 0, 0, 255, 0]),
    2,
    1,
  );

  assert.deepEqual(
    Array.from(image.data),
    [255, 0, 0, 255, 0, 255, 0, 255],
  );
});

test("preserves zero-valued channels", () => {
  const image = decodeBase64Rgb(
    encode([0, 0, 0]),
    1,
    1,
  );

  assert.deepEqual(
    Array.from(image.data),
    [0, 0, 0, 255],
  );
});

test("preserves maximum channel values", () => {
  const image = decodeBase64Rgb(
    encode([255, 255, 255]),
    1,
    1,
  );

  assert.deepEqual(
    Array.from(image.data),
    [255, 255, 255, 255],
  );
});

test("decodes a synthetic 32x32 Sonata image", () => {
  const rgb = Buffer.alloc(32 * 32 * 3, 40);
  const image = decodeSonataReference(encode(rgb));

  assert.equal(image.width, 32);
  assert.equal(image.height, 32);
  assert.equal(image.data.length, 4096);
  assert.deepEqual(
    Array.from(image.data.slice(0, 4)),
    [40, 40, 40, 255],
  );
});

test("rejects truncated Base64", () => {
  assert.throws(() =>
    decodeBase64Rgb("AAAA", 2, 2),
  );
});

test("rejects invalid Base64 characters", () => {
  assert.throws(() =>
    decodeBase64Rgb("!!==", 1, 1),
  );
});

test("rejects empty payload", () => {
  assert.throws(() =>
    decodeBase64Rgb("", 1, 1),
  );
});

test("rejects invalid dimensions", () => {
  assert.throws(() =>
    validateRgbDimensions(0, 32),
  );

  assert.throws(() =>
    validateRgbDimensions(32, -1),
  );

  assert.throws(() =>
    validateRgbDimensions(1.5, 32),
  );
});

test("rejects oversized dimensions", () => {
  assert.throws(() =>
    validateRgbDimensions(4097, 32),
  );
});

test("rejects mismatched decoded data", () => {
  assert.throws(() =>
    decodeBase64Rgb(
      encode([1, 2, 3]),
      2,
      1,
    ),
  );
});

test("returns matcher-compatible pixel structure", () => {
  const image = decodeBase64Rgb(
    encode([5, 10, 15]),
    1,
    1,
  );

  assert.ok(image.data instanceof Uint8ClampedArray);
  assert.equal(image.data.length, image.width * image.height * 4);
});