import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const catalog = JSON.parse(
  readFileSync(
    new URL("./echo-catalog-research.json", import.meta.url),
    "utf8",
  ),
);

test("catalog contains 228 identities", () => {
  assert.equal(catalog.records.length, 228);
});

test("catalog is explicitly research-only", () => {
  assert.equal(catalog.researchOnly, true);
  assert.equal(catalog.productionReady, false);
  assert.equal(catalog.officialScoringEligible, false);
  assert.equal(catalog.identityVerified, false);
});

test("all records have valid identity fields", () => {
  for (const record of catalog.records) {
    assert.equal(typeof record.id, "string");
    assert.ok(record.id.trim());
    assert.equal(typeof record.name, "string");
    assert.ok(record.name.trim());
    assert.ok([1, 3, 4].includes(record.cost));
  }
});

test("Echo IDs are unique", () => {
  const ids = catalog.records.map((record) => record.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("research catalog excludes combat mechanics", () => {
  for (const record of catalog.records) {
    assert.deepEqual(
      Object.keys(record).sort(),
      ["cost", "id", "name"],
    );
  }
});
