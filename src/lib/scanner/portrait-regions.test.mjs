import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BUILD_CARD_SIZE,
  ECHO_SLOT_COUNT,
  getEchoVisualRegions,
  isRegionInsideCard,
  isSupportedBuildCard,
} from "./portrait-regions.ts";

test("build card dimensions are fixed", () => {
  assert.deepEqual(BUILD_CARD_SIZE, {
    width: 1920,
    height: 1080,
  });
});

test("exactly five Echo slots exist", () => {
  assert.equal(ECHO_SLOT_COUNT, 5);
  assert.equal(getEchoVisualRegions().length, 5);
});

test("slot numbering is sequential", () => {
  assert.deepEqual(
    getEchoVisualRegions().map((entry) => entry.slot),
    [1, 2, 3, 4, 5],
  );
});

test("portrait coordinates match expected geometry", () => {
  const regions = getEchoVisualRegions();

  for (let index = 0; index < 5; index++) {
    assert.deepEqual(regions[index].portrait, {
      x: 22 + index * 374,
      y: 650,
      width: 192,
      height: 182,
    });
  }
});

test("Sonata coordinates match expected geometry", () => {
  const regions = getEchoVisualRegions();

  for (let index = 0; index < 5; index++) {
    assert.deepEqual(regions[index].sonata, {
      x: 264 + index * 374,
      y: 660,
      width: 56,
      height: 56,
    });
  }
});

test("all ten visual regions remain inside the card", () => {
  for (const entry of getEchoVisualRegions()) {
    assert.equal(isRegionInsideCard(entry.portrait), true);
    assert.equal(isRegionInsideCard(entry.sonata), true);
  }
});

test("unsupported screenshot dimensions are rejected", () => {
  assert.equal(isSupportedBuildCard(1920, 1080), true);
  assert.equal(isSupportedBuildCard(1280, 720), false);
  assert.equal(isSupportedBuildCard(1920, 1079), false);
});

test("out-of-bounds regions are rejected", () => {
  assert.equal(
    isRegionInsideCard({
      x: 1900,
      y: 1000,
      width: 100,
      height: 100,
    }),
    false,
  );
});

test("noninteger region coordinates are rejected", () => {
  assert.equal(
    isRegionInsideCard({
      x: 1.5,
      y: 650,
      width: 192,
      height: 182,
    }),
    false,
  );
});