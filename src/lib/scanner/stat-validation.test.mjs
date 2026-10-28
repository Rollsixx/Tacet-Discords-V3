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
  require(name) {
    if(name==="../game-data/substat-rolls.json")return {default:JSON.parse(readFileSync(new URL("../game-data/substat-rolls.json",import.meta.url),"utf8"))};
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

test("wrapped damage-label aliases retain the recognized numeric value", () => {
  for (const [label, canonical] of [
    ["Resonance Skill DMG", "Resonance Skill DMG Bonus"],
    ["Resonance Liberation", "Resonance Liberation DMG Bonus"],
    ["Resonance Liberation DMG", "Resonance Liberation DMG Bonus"],
    ["Heavy Attack DMG", "Heavy Attack DMG Bonus"],
  ]) {
    const parsed = parseSubstat(label + " 8.6%");
    assert.equal(parsed.name, canonical);
    assert.equal(parsed.amount, 8.6);
    assert.equal(parsed.percent, true);
  }
  assert.equal(parseSubstat("Resonance 8.6%"), null);
  assert.equal(parseSubstat("Skill 8.6%"), null);
});

test("Hiyuki screenshot transcription leaves only the genuinely missing fifth cost", () => {
  // Manually transcribed browser screenshots, not an original-image OCR fixture.
  const builds = [
    slot("4", "Crit. DMG", ["Resonance Skill DMG 8.6%", "Crit. DMG 21%", "Crit. Rate 10.5%", "Resonance Liberation 9.4%", "HP 10.1%"]),
    slot("3", "Glacio DMG Bonus", ["Crit. DMG 19.8%", "DEF 60", "Resonance Liberation 6.4%", "ATK 9.4%", "Crit. Rate 6.3%"]),
    slot("3", "Glacio DMG Bonus", ["Energy Regen 10%", "ATK 8.6%", "Crit. DMG 21%", "Resonance Skill DMG 8.6%", "Resonance Liberation 6.4%"]),
    slot("1", "ATK", ["Crit. Rate 10.5%", "ATK 40", "Energy Regen 9.2%", "Crit. DMG 13.8%", "Resonance Liberation 10.1%"]),
    slot("", "ATK", ["Resonance Liberation 8.6%", "Crit. Rate 10.5%", "Crit. DMG 21%", "HP 9.4%", "ATK 11.6%"]),
  ];
  const issues = builds.flatMap(validateEchoSlot);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "INVALID_COST");
  builds[4].cost.value = "1"; // Explicit screenshot-confirmed user correction.
  assert.equal(builds.flatMap(validateEchoSlot).length, 0);
});


test("illegal DEF 11.9 percent is blocked without changing the recognized value",()=>{
 const input=slot("1","ATK",["DEF 11.9%","Crit. Rate 6.3%","Crit. DMG 18.6%","ATK 9.4%","Resonance Skill DMG 7.9%"]);const before=JSON.stringify(input);const issues=validateEchoSlot(input);assert.ok(issues.some(i=>i.code==='UNSUPPORTED_ROLL'&&i.message.includes('DEF 11.9%')));assert.equal(JSON.stringify(input),before);input.substats[0]={raw:'DEF 11.8%',value:'DEF 11.8%'};assert.equal(validateEchoSlot(input).length,0);
});
