import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const sourceDir = fileURLToPath(new URL(".", import.meta.url));
const runtimeDir = mkdtempSync(join(tmpdir(), "tacet-pixels-"));

for (const name of [
  "image-matcher.ts",
  "visual-recognition.ts",
  "reference-image-loader.ts",
]) {
  let content = readFileSync(join(sourceDir, name), "utf8");

  content = content
    .replaceAll(
      '"./image-matcher"',
      '"./image-matcher.ts"',
    )
    .replaceAll(
      '"./reference-image-loader"',
      '"./reference-image-loader.ts"',
    );

  writeFileSync(join(runtimeDir, name), content);
}

const matcher = await import(
  pathToFileURL(join(runtimeDir, "image-matcher.ts")).href
);

const recognition = await import(
  pathToFileURL(join(runtimeDir, "visual-recognition.ts")).href
);

function solid(value, width = 8, height = 8) {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < data.length; i += 4) {
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }

  return { width, height, data };
}

const candidate = (key, value) => ({
  key,
  image: solid(value),
});

test("clearly closer candidate wins", () => {
  const result = recognition.recognizeFromCandidates(
    solid(20),
    [
      candidate("distant", 240),
      candidate("correct", 20),
    ],
    {
      maximumDifference: 0.1,
      minimumMargin: 0.02,
    },
  );

  assert.equal(result.status, "matched");
  assert.equal(result.key, "correct");
  assert.equal(result.ranked[0].key, "correct");
});

test("distant image is rejected", () => {
  const result = recognition.recognizeFromCandidates(
    solid(0),
    [candidate("distant", 255)],
    {
      maximumDifference: 0.01,
      minimumMargin: 0,
    },
  );

  assert.equal(result.status, "unknown");
  assert.equal(result.key, null);
});

test("identical competing candidates are ambiguous", () => {
  const result = recognition.recognizeFromCandidates(
    solid(60),
    [
      candidate("first", 60),
      candidate("second", 60),
    ],
    {
      maximumDifference: 0.1,
      minimumMargin: 0.02,
    },
  );

  assert.equal(result.status, "ambiguous");
  assert.equal(result.key, null);
});

test("Echo and Sonata can yield different decisions", () => {
  const echo = recognition.recognizeFromCandidates(
    solid(30),
    [candidate("echo", 30)],
    {
      maximumDifference: 0.1,
      minimumMargin: 0.02,
    },
  );

  const sonata = recognition.recognizeFromCandidates(
    solid(30),
    [candidate("wrong-sonata", 255)],
    {
      maximumDifference: 0.01,
      minimumMargin: 0.02,
    },
  );

  assert.equal(echo.status, "matched");
  assert.equal(sonata.status, "unknown");
});

test("duplicate candidate keys are rejected", () => {
  assert.throws(
    () => matcher.rankImageCandidates(
      solid(10),
      [
        candidate("duplicate", 10),
        candidate("duplicate", 20),
      ],
    ),
    /unique and nonempty/,
  );
});

test("matching does not mutate source pixels", () => {
  const source = solid(70);
  const before = Uint8ClampedArray.from(source.data);

  recognition.recognizeFromCandidates(
    source,
    [
      candidate("a", 70),
      candidate("b", 120),
    ],
    {
      maximumDifference: 0.1,
      minimumMargin: 0.02,
    },
  );

  assert.deepEqual(source.data, before);
});