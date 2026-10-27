import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateHit, evaluateRotation } from "./damage-core.ts";
const input = {
  characterLevel: 70, enemyLevel: 81, attack: 930, coefficient: 0.2942,
  damageBonus: 0.12, amplify: 0, specialMultiplier: 0, totalDamageBonus: 0, endgameDamageBonus: 0,
  defenseIgnore: 0, defenseReduction: 0, enemyResistance: 0.1, resistanceReduction: 0, resistanceIgnore: 0, critRate: 0.5, critDamage: 1.5,
};
test("Calcharo reference BA1 case is approximately the documented 134 damage", () => {
  // Reference's documented in-game case supplies DEF=0.4857142857 explicitly.
  // Use matching level-derived DEF to avoid treating rounded fixture DEF as exact.
  const result = evaluateHit(input);
  assert.ok(Math.abs(result.normal - 133.9574975960601) < 1e-6);
  assert.equal(Math.round(result.normal), 134);
  assert.ok(Math.abs(result.expected - result.normal * 1.25) < 1e-9);
});
test("rotation aggregates explicit expected hits and duration, without character defaults", () => {
  const hit = evaluateHit(input);
  const rotation = evaluateRotation([{ count: 3, input }], 6);
  assert.equal(rotation.totalExpectedDamage, hit.expected * 3);
  assert.equal(rotation.expectedDps, hit.expected / 2);
  assert.throws(() => evaluateRotation([], 0));
  assert.throws(() => evaluateHit({ ...input, coefficient: undefined }));
  assert.throws(() => evaluateHit({ ...input, critRate: 105 }));
});
test("resistance and defense boundary cases match explicit reference behavior", () => {
  assert.equal(evaluateHit({ ...input, defenseIgnore: 1 }).defense, 1);
  assert.equal(evaluateHit({ ...input, enemyResistance: 0.1, resistanceReduction: 0.3 }).resistance, 1.1);
  assert.equal(evaluateHit({ ...input, enemyResistance: -0.1, resistanceReduction: 0 }).resistance, 1.1);
});
