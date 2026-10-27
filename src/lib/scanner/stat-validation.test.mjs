import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const filename = new URL("./stat-validation.ts", import.meta.url);
const source = readFileSync(filename, "utf8");

const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const context = {
  exports: {},
  require() {
    throw new Error("Unexpected runtime dependency");
  },
};

vm.runInNewContext(compiled, context);

const { parseSubstat, validateEchoSlot } = context.exports;

function slot(cost, main, stats) {
  return {
    slot: 1,
    cost: { raw: cost, value: cost },
    mainStat: { raw: main, value: main },
    substats: stats.map(value => ({ raw: value, value })),
  };
}

const valid = [
  "Crit. DMG 21%",
  "Crit. Rate 10.5%",
  "ATK 9.4%",
  "HP 10.1%",
  "Resonance Skill DMG Bonus 8.6%",
];

test("parses percentage stats", () => {
  const result = parseSubstat("Crit. Rate 10.5%");
  assert.equal(result.name, "Crit. Rate");
  assert.equal(result.amount, 10.5);
  assert.equal(result.percent, true);
});

test("parses flat stats", () => {
  const result = parseSubstat("DEF 60");
  assert.equal(result.name, "DEF");
  assert.equal(result.percent, false);
});

test("rejects malformed OCR", () => {
  assert.equal(parseSubstat("ATE 5.6%"), null);
  assert.equal(parseSubstat("crit. DMG a"), null);
});

test("accepts structurally valid cost-four Echo", () => {
  assert.equal(
    validateEchoSlot(slot("4", "Crit. DMG", valid)).length,
    0,
  );
});

test("rejects missing cost", () => {
  const issues = validateEchoSlot(slot("", "Crit. DMG", valid));
  assert.ok(issues.some(issue => issue.code === "INVALID_COST"));
});

test("detects duplicate substats", () => {
  const duplicate = [...valid];
  duplicate[4] = "Crit. Rate 6.3%";

  const issues = validateEchoSlot(
    slot("4", "Crit. DMG", duplicate),
  );

  assert.ok(
    issues.some(issue => issue.code === "DUPLICATE_SUBSTAT"),
  );
});

test("detects invalid main stat", () => {
  const issues = validateEchoSlot(slot("1", "NK", valid));
  assert.ok(issues.some(issue => issue.code === "INVALID_MAIN"));
});

test("flags suspicious crit values", () => {
  const stats = [...valid];
  stats[1] = "Crit. Rate 105%";

  const issues = validateEchoSlot(
    slot("4", "Crit. DMG", stats),
  );

  assert.ok(issues.some(issue => issue.code === "SUSPICIOUS_CRIT"));
});

test("flat ATK and ATK percentage are distinct substats on real cards", () => {
  const stats = ["ATK 9.4%", "ATK 40", "Crit. DMG 15%", "HP 7.9%", "Crit. Rate 6.3%"];
  assert.equal(validateEchoSlot(slot("1", "ATK", stats)).length, 0);
});

test("flat DEF and DEF percentage are distinct substats", () => {
  const stats = ["DEF 10%", "ATK 10.9%", "DEF 60", "Crit. DMG 15%", "Crit. Rate 6.3%"];
  assert.equal(validateEchoSlot(slot("4", "Crit. DMG", stats)).length, 0);
});

test("empty-slot flag remains a blocker even if text is entered", () => {
  const input = slot("4", "Crit. DMG", valid);
  input.presence = "empty";
  assert.equal(validateEchoSlot(input)[0].code, "EMPTY_SLOT");
});
