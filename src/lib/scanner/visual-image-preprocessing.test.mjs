import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ECHO_PREPROCESSING,
  SONATA_PREPROCESSING,
  getPreprocessingConfig,
  validatePreprocessingConfig,
} from "./visual-image-preprocessing.ts";

test("Echo output uses 80x80", () => {
  const config = getPreprocessingConfig("echo");

  assert.equal(config.width, 80);
  assert.equal(config.height, 80);
});

test("Sonata output uses 32x32", () => {
  const config = getPreprocessingConfig("sonata");

  assert.equal(config.width, 32);
  assert.equal(config.height, 32);
});

test("Echo background is black", () => {
  assert.deepEqual(
    ECHO_PREPROCESSING.background,
    [0, 0, 0],
  );
});

test("Sonata background matches reference", () => {
  assert.deepEqual(
    SONATA_PREPROCESSING.background,
    [40, 40, 40],
  );
});

test("valid configuration passes", () => {
  assert.doesNotThrow(() =>
    validatePreprocessingConfig(SONATA_PREPROCESSING),
  );
});

test("zero dimensions are rejected", () => {
  assert.throws(() =>
    validatePreprocessingConfig({
      width: 0,
      height: 32,
      background: [40, 40, 40],
    }),
  );
});

test("oversized dimensions are rejected", () => {
  assert.throws(() =>
    validatePreprocessingConfig({
      width: 4097,
      height: 32,
      background: [40, 40, 40],
    }),
  );
});

test("invalid background is rejected", () => {
  assert.throws(() =>
    validatePreprocessingConfig({
      width: 32,
      height: 32,
      background: [40, -1, 40],
    }),
  );
});