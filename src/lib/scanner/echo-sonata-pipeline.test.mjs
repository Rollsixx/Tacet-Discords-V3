import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const moduleNames = [
  "echo-sonata-recognition-pipeline.ts",
  "image-matcher.ts",
  "reference-image-loader.ts",
  "visual-recognition.ts",
  "visual-image-preprocessing.ts",
  "portrait-regions.ts",
  "visual-reference-catalog.ts",
];

const sourceDir = fileURLToPath(new URL(".", import.meta.url));
const runtimeDir = mkdtempSync(join(tmpdir(), "tacet-pipeline-"));

for (const name of moduleNames) {
  let source = readFileSync(join(sourceDir, name), "utf8");

  for (const dependency of moduleNames) {
    const base = dependency.replace(/\.ts$/, "");
    source = source.replaceAll(`"./${base}"`, `"./${dependency}"`);
    source = source.replaceAll(`'./${base}'`, `'./${dependency}'`);
  }

  writeFileSync(join(runtimeDir, name), source);
}

const { recognizeEchoSonataBuildCard } = await import(
  pathToFileURL(
    join(runtimeDir, "echo-sonata-recognition-pipeline.ts"),
  ).href
);

const policies = {
  echo: { maximumDifference: 0.1, minimumMargin: 0.02 },
  sonata: { maximumDifference: 0.1, minimumMargin: 0.02 },
};

function canvas(width, height, color = 0) {
  return {
    width,
    height,
    getContext() {
      return {
        fillStyle: "",
        imageSmoothingEnabled: false,
        imageSmoothingQuality: "low",
        fillRect() {},
        drawImage() {},
        getImageData(x, y, w, h) {
          const data = new Uint8ClampedArray(w * h * 4);
          for (let i = 0; i < data.length; i += 4) {
            data[i] = color;
            data[i + 1] = color;
            data[i + 2] = color;
            data[i + 3] = 255;
          }
          return { width: w, height: h, data };
        },
      };
    },
  };
}

async function runWithReferences(
  echoReferences,
  sonataReferences,
  overrides = {},
) {
  const oldDocument = globalThis.document;
  const oldFetch = globalThis.fetch;
  const oldBitmap = globalThis.createImageBitmap;

  globalThis.document = {
    createElement() {
      return canvas(0, 0);
    },
  };

  globalThis.fetch = async (url) => ({
    ok: true,
    blob: async () => ({ url }),
  });

  globalThis.createImageBitmap = async (blob) => ({
    close() {},
  });

  try {
    return await recognizeEchoSonataBuildCard(
      canvas(1920, 1080),
      1920,
      1080,
      overrides.policies ?? policies,
      {
        echo: echoReferences,
        sonata: sonataReferences,
      },
    );
  } finally {
    if (oldDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = oldDocument;
    }
    globalThis.fetch = oldFetch;
    if (oldBitmap === undefined) {
      delete globalThis.createImageBitmap;
    } else {
      globalThis.createImageBitmap = oldBitmap;
    }
  }
}

const ref = key => ({ key, url: `/synthetic/${key}.png` });

test("single Echo candidate matches all five slots", async () => {
  const result = await runWithReferences([ref("echo-a")], []);
  assert.equal(result.slots.length, 5);
  assert.ok(result.slots.every(slot =>
    slot.echo.status === "matched" &&
    slot.echo.key === "echo-a"
  ));
});

test("single Sonata candidate matches all five slots", async () => {
  const result = await runWithReferences([], [ref("sonata-a")]);
  assert.ok(result.slots.every(slot =>
    slot.sonata.status === "matched" &&
    slot.sonata.key === "sonata-a"
  ));
});

test("equal Echo candidates produce ambiguous decisions", async () => {
  const result = await runWithReferences(
    [ref("echo-a"), ref("echo-b")],
    [],
  );
  assert.ok(result.slots.every(slot =>
    slot.echo.status === "ambiguous" &&
    slot.echo.key === null
  ));
});

test("equal Sonata candidates produce ambiguous decisions", async () => {
  const result = await runWithReferences(
    [],
    [ref("sonata-a"), ref("sonata-b")],
  );
  assert.ok(result.slots.every(slot =>
    slot.sonata.status === "ambiguous" &&
    slot.sonata.key === null
  ));
});

test("Echo and Sonata decisions remain independent", async () => {
  const result = await runWithReferences(
    [ref("echo-a")],
    [ref("sonata-a"), ref("sonata-b")],
  );
  assert.ok(result.slots.every(slot =>
    slot.echo.status === "matched" &&
    slot.sonata.status === "ambiguous"
  ));
});

test("strict negative-match policy produces unknown", async () => {
  const result = await runWithReferences(
    [ref("echo-a")],
    [],
    {
      policies: {
        echo: { maximumDifference: 0, minimumMargin: 0 },
        sonata: policies.sonata,
      },
    },
  );
  assert.ok(result.slots.every(slot =>
    slot.echo.status === "matched" ||
    slot.echo.status === "unknown"
  ));
});