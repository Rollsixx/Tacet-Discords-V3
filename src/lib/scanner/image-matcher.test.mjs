import assert from "node:assert/strict";
import { test } from "node:test";
import {
  comparePixelImages,
  rankImageCandidates,
} from "./image-matcher.ts";

function pixel(r, g, b, a = 255) {
  return {
    width: 1,
    height: 1,
    data: new Uint8ClampedArray([r, g, b, a]),
  };
}

test("identical pixels have zero difference", () => {
  assert.equal(
    comparePixelImages(pixel(10, 20, 30), pixel(10, 20, 30)),
    0,
  );
});

test("different colors produce positive difference", () => {
  assert.ok(
    comparePixelImages(pixel(255, 0, 0), pixel(0, 0, 255)) > 0,
  );
});

test("alpha differences are detected", () => {
  assert.ok(
    comparePixelImages(pixel(0, 0, 0, 0), pixel(0, 0, 0, 255)) > 0,
  );
});

test("mismatched dimensions are rejected", () => {
  assert.throws(() =>
    comparePixelImages(
      pixel(0, 0, 0),
      {
        width: 2,
        height: 1,
        data: new Uint8ClampedArray(8),
      },
    ),
  );
});

test("invalid pixel buffers are rejected", () => {
  assert.throws(() =>
    comparePixelImages(
      pixel(0, 0, 0),
      {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray(3),
      },
    ),
  );
});

test("identical candidate ranks first", () => {
  const source = pixel(200, 20, 40);

  const ranked = rankImageCandidates(source, [
    { key: "different", image: pixel(10, 200, 40) },
    { key: "identical", image: pixel(200, 20, 40) },
  ]);

  assert.equal(ranked[0].key, "identical");
  assert.equal(ranked[0].difference, 0);
});

test("candidate ties have deterministic order", () => {
  const source = pixel(0, 0, 0);

  const ranked = rankImageCandidates(source, [
    { key: "z", image: pixel(0, 0, 0) },
    { key: "a", image: pixel(0, 0, 0) },
  ]);

  assert.deepEqual(
    ranked.map(entry => entry.key),
    ["a", "z"],
  );
});

test("duplicate candidate keys are rejected", () => {
  const source = pixel(0, 0, 0);

  assert.throws(() =>
    rankImageCandidates(source, [
      { key: "same", image: source },
      { key: "same", image: source },
    ]),
  );
});

test("empty candidate collection produces no matches", () => {
  assert.deepEqual(
    rankImageCandidates(pixel(0, 0, 0), []),
    [],
  );
});

test("edge differences are detected", () => {
  const first = {
    width: 2,
    height: 1,
    data: new Uint8ClampedArray([
      0, 0, 0, 255,
      255, 255, 255, 255,
    ]),
  };

  const second = {
    width: 2,
    height: 1,
    data: new Uint8ClampedArray([
      255, 255, 255, 255,
      0, 0, 0, 255,
    ]),
  };

  assert.ok(comparePixelImages(first, second) > 0);
});