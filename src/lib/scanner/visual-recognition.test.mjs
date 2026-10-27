import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("./visual-recognition.ts", import.meta.url),
  "utf8",
);

const match = source.match(
  /export function validateRecognitionPolicy\([\s\S]*?(?=export function recognizeFromCandidates\()/,
);

assert.ok(match, "Recognition decision functions must exist");

const executable = match[0]
  .replace(/export /g, "")
  .replace(/:\s*RecognitionPolicy/g, "")
  .replace(/:\s*RecognitionDecision/g, "")
  .replace(/:\s*RankedImageMatch\[\]/g, "")
  .replace(/:\s*void/g, "");

const functions = new Function(
  `${executable}
   return { validateRecognitionPolicy, decideImageMatch };`,
)();

const {
  validateRecognitionPolicy,
  decideImageMatch,
} = functions;

const policy = {
  maximumDifference: 0.2,
  minimumMargin: 0.01,
};

test("empty candidates return unknown", () => {
  const result = decideImageMatch([], policy);
  assert.equal(result.status, "unknown");
  assert.equal(result.key, null);
});

test("exact match is accepted", () => {
  const result = decideImageMatch(
    [
      { key: "red", difference: 0 },
      { key: "blue", difference: 0.4 },
    ],
    policy,
  );

  assert.equal(result.status, "matched");
  assert.equal(result.key, "red");
});

test("distant candidates remain unknown", () => {
  const result = decideImageMatch(
    [{ key: "wrong", difference: 0.9 }],
    policy,
  );

  assert.equal(result.status, "unknown");
});

test("close candidates are ambiguous", () => {
  const result = decideImageMatch(
    [
      { key: "a", difference: 0.1 },
      { key: "b", difference: 0.105 },
    ],
    policy,
  );

  assert.equal(result.status, "ambiguous");
});

test("clear winning margin is accepted", () => {
  const result = decideImageMatch(
    [
      { key: "a", difference: 0.1 },
      { key: "b", difference: 0.2 },
    ],
    policy,
  );

  assert.equal(result.status, "matched");
});

test("threshold boundary is inclusive", () => {
  const result = decideImageMatch(
    [{ key: "a", difference: 0.2 }],
    policy,
  );

  assert.equal(result.status, "matched");
});

test("negative threshold is rejected", () => {
  assert.throws(() =>
    validateRecognitionPolicy({
      maximumDifference: -1,
      minimumMargin: 0,
    }),
  );
});

test("NaN threshold is rejected", () => {
  assert.throws(() =>
    validateRecognitionPolicy({
      maximumDifference: Number.NaN,
      minimumMargin: 0,
    }),
  );
});

test("oversized margin is rejected", () => {
  assert.throws(() =>
    validateRecognitionPolicy({
      maximumDifference: 0.2,
      minimumMargin: 2,
    }),
  );
});

test("ranking is preserved", () => {
  const ranked = [
    { key: "red", difference: 0 },
    { key: "blue", difference: 0.4 },
  ];

  const result = decideImageMatch(ranked, policy);

  assert.deepEqual(result.ranked, ranked);
});

test("nonfinite score remains unknown", () => {
  const result = decideImageMatch(
    [{ key: "invalid", difference: Number.NaN }],
    policy,
  );

  assert.equal(result.status, "unknown");
});