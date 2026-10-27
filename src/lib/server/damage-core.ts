// Independently implemented numeric core. This is not a character/weapon catalog
// or an official ranking engine. Fraction units are used throughout (10% = 0.1).
export const DAMAGE_CORE_VERSION = "tacet-hit-core/0.1.0";
export type HitInput = {
  characterLevel: number; enemyLevel: number; attack: number; coefficient: number;
  damageBonus: number; amplify: number; specialMultiplier: number;
  totalDamageBonus: number; endgameDamageBonus: number;
  defenseIgnore: number; defenseReduction: number;
  enemyResistance: number; resistanceReduction: number; resistanceIgnore: number;
  critRate: number; critDamage: number;
};
export function evaluateHit(input: HitInput) {
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Invalid numeric input: ${key}`);
  }
  const keys: (keyof HitInput)[] = ["characterLevel", "enemyLevel", "attack", "coefficient", "damageBonus", "amplify", "specialMultiplier", "totalDamageBonus", "endgameDamageBonus", "defenseIgnore", "defenseReduction", "enemyResistance", "resistanceReduction", "resistanceIgnore", "critRate", "critDamage"];
  if (keys.some(key => typeof input[key] !== "number")) throw new Error("Complete hit inputs required; no inferred defaults.");
  if (input.characterLevel < 1 || input.characterLevel > 100 || input.enemyLevel < 1 || input.enemyLevel > 200 ||
    input.attack < 0 || input.coefficient < 0 || input.critRate < 0 || input.critRate > 1 || input.critDamage < 1 ||
    input.defenseIgnore < 0 || input.defenseIgnore > 1 || input.defenseReduction < 0 || input.defenseReduction > 1 ||
    input.resistanceReduction < 0 || input.resistanceIgnore < 0 ||
    [input.damageBonus, input.amplify, input.specialMultiplier, input.totalDamageBonus, input.endgameDamageBonus].some(x => x < -1)) throw new Error("Hit input outside supported range.");
  const attackerDefenseFactor = 800 + 8 * input.characterLevel;
  const effectiveEnemyDefense = (792 + 8 * input.enemyLevel) * (1 - input.defenseIgnore) * (1 - input.defenseReduction);
  const defense = attackerDefenseFactor / (attackerDefenseFactor + effectiveEnemyDefense);
  // Compatibility behavior is pinned to the reference formula, not assumed to
  // independently establish every in-game mechanic outside the reference cases.
  const reduction = input.resistanceReduction + input.resistanceIgnore;
  let resistance = 1 - input.enemyResistance;
  if (reduction > 0) {
    resistance = input.enemyResistance <= 0
      ? 1 - input.enemyResistance + reduction / 2
      : reduction <= input.enemyResistance ? 1 - input.enemyResistance + reduction : 1 + (reduction - input.enemyResistance) / 2;
  }
  const normal = input.attack * input.coefficient *
    (1 + input.damageBonus) * (1 + input.amplify) * (1 + input.specialMultiplier) *
    (1 + input.totalDamageBonus) * (1 + input.endgameDamageBonus) * defense * resistance;
  const critical = normal * input.critDamage;
  if (!Number.isFinite(critical) || normal < 0) throw new Error("Unsupported or nonfinite damage result.");
  return { normal, critical, expected: normal * (1 + input.critRate * (input.critDamage - 1)), defense, resistance, version: DAMAGE_CORE_VERSION };
}
export function evaluateRotation(hits: { count: number; input: HitInput }[], durationSeconds: number) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || !hits.length || hits.length > 1000) throw new Error("Bounded rotation and positive duration required.");
  let total = 0;
  for (const hit of hits) {
    if (!Number.isInteger(hit.count) || hit.count < 1 || hit.count > 1000) throw new Error("Invalid hit count.");
    total += evaluateHit(hit.input).expected * hit.count;
  }
  if (!Number.isFinite(total)) throw new Error("Nonfinite rotation result.");
  return { totalExpectedDamage: total, expectedDps: total / durationSeconds, version: DAMAGE_CORE_VERSION };
}
