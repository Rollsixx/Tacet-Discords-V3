// Optional developer comparison; upstream code is read locally, never bundled.
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { evaluateHit } from "../src/lib/server/damage-core.ts";
const source = process.env.REFERENCE_FORMULAS_PATH;
if (!source) throw new Error("Set REFERENCE_FORMULAS_PATH to the pinned reference packages/formulas/src/index.ts.");
const upstream = await import(pathToFileURL(resolve(source)).href);
let cases = 0;
for (const characterLevel of [1, 70, 90]) for (const enemyLevel of [1, 80, 100]) {
  for (const enemyResistance of [-0.1, 0, 0.1, 0.5]) for (const resistanceReduction of [0, 0.05, 0.3]) {
    for (const defenseIgnore of [0, 0.2, 1]) {
      const input = { characterLevel, enemyLevel, attack: 930, coefficient: 0.2942, damageBonus: 0.12, amplify: 0.15, specialMultiplier: 0.2, totalDamageBonus: 0.1, endgameDamageBonus: 0.1, defenseIgnore, defenseReduction: 0.1, enemyResistance, resistanceReduction, resistanceIgnore: 0.05, critRate: 0.5, critDamage: 1.5 };
      const expected = upstream.calcHitDamage(String(characterLevel), enemyLevel, enemyResistance, input.coefficient, input.attack, defenseIgnore, 0, 0, input.damageBonus, input.amplify, resistanceReduction, input.specialMultiplier, input.defenseReduction, input.resistanceIgnore, input.totalDamageBonus, input.endgameDamageBonus);
      assert.ok(Math.abs(evaluateHit(input).normal - expected) <= 1e-9 * Math.max(1, Math.abs(expected)));
      cases++;
    }
  }
}
console.log(`${cases} reference-formula compatibility cases passed. This does not verify character data, rotations, OCR identity or ranking eligibility.`);
