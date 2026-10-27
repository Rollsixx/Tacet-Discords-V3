import assert from "node:assert/strict";
import { test } from "node:test";

import {
  preprocessVisualCanvas,
} from "./visual-image-preprocessing.ts";

function createMockCanvas(width, height) {
  const calls = [];

  const context = {
    fillStyle: "",
    imageSmoothingEnabled: false,
    imageSmoothingQuality: "low",

    fillRect(...args) {
      calls.push({ method: "fillRect", args });
    },

    drawImage(...args) {
      calls.push({ method: "drawImage", args });
    },
  };

  const canvas = {
    width,
    height,
    calls,
    context,

    getContext(type) {
      return type === "2d" ? context : null;
    },
  };

  return canvas;
}

function withMockDocument(callback) {
  const original = globalThis.document;

  const outputs = [];

  globalThis.document = {
    createElement(name) {
      assert.equal(name, "canvas");

      const canvas = createMockCanvas(0, 0);

      outputs.push(canvas);

      return canvas;
    },
  };

  try {
    return callback(outputs);
  } finally {
    if (original === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = original;
    }
  }
}

test("Echo preprocessing creates 80x80 canvas", () => {
  withMockDocument(() => {
    const source = createMockCanvas(192, 182);

    const result = preprocessVisualCanvas(
      source,
      "echo",
    );

    assert.equal(result.width, 80);
    assert.equal(result.height, 80);
  });
});

test("Sonata preprocessing creates 32x32 canvas", () => {
  withMockDocument(() => {
    const source = createMockCanvas(56, 56);

    const result = preprocessVisualCanvas(
      source,
      "sonata",
    );

    assert.equal(result.width, 32);
    assert.equal(result.height, 32);
  });
});

test("Sonata background is filled correctly", () => {
  withMockDocument(() => {
    const source = createMockCanvas(56, 56);

    const result = preprocessVisualCanvas(
      source,
      "sonata",
    );

    assert.equal(
      result.context.fillStyle,
      "rgb(40, 40, 40)",
    );

    assert.deepEqual(
      result.calls[0],
      {
        method: "fillRect",
        args: [0, 0, 32, 32],
      },
    );
  });
});

test("Echo background is black", () => {
  withMockDocument(() => {
    const source = createMockCanvas(192, 182);

    const result = preprocessVisualCanvas(
      source,
      "echo",
    );

    assert.equal(
      result.context.fillStyle,
      "rgb(0, 0, 0)",
    );
  });
});

test("source image is drawn after background", () => {
  withMockDocument(() => {
    const source = createMockCanvas(56, 56);

    const result = preprocessVisualCanvas(
      source,
      "sonata",
    );

    assert.deepEqual(
      result.calls.map((call) => call.method),
      ["fillRect", "drawImage"],
    );
  });
});

test("drawImage receives correct dimensions", () => {
  withMockDocument(() => {
    const source = createMockCanvas(192, 182);

    const result = preprocessVisualCanvas(
      source,
      "echo",
    );

    const draw = result.calls.find(
      (call) => call.method === "drawImage",
    );

    assert.deepEqual(
      draw.args.slice(1),
      [0, 0, 192, 182, 0, 0, 80, 80],
    );
  });
});

test("image smoothing is enabled", () => {
  withMockDocument(() => {
    const source = createMockCanvas(56, 56);

    const result = preprocessVisualCanvas(
      source,
      "sonata",
    );

    assert.equal(
      result.context.imageSmoothingEnabled,
      true,
    );

    assert.equal(
      result.context.imageSmoothingQuality,
      "high",
    );
  });
});

test("empty source is rejected", () => {
  withMockDocument(() => {
    const source = createMockCanvas(0, 0);

    assert.throws(() =>
      preprocessVisualCanvas(source, "echo"),
    );
  });
});