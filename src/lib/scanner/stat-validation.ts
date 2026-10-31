import rollTable from "../game-data/substat-rolls.json" with {type:"json"};
import type { RecognizedSlot } from "./build-card-ocr";

export type StatIssue = {
  code: string;
  message: string;
};

const STAT_NAMES: Record<string, string> = {
  atk: "ATK",
  def: "DEF",
  hp: "HP",
  "crit rate": "Crit. Rate",
  "crit dmg": "Crit. DMG",
  "energy regen": "Energy Regen",
  "basic attack dmg bonus": "Basic Attack DMG Bonus",
  "heavy attack dmg bonus": "Heavy Attack DMG Bonus",
  "resonance skill dmg bonus": "Resonance Skill DMG Bonus",
  "resonance liberation dmg bonus": "Resonance Liberation DMG Bonus",
  // Build cards wrap these labels across two lines. A single-line OCR region
  // can omit the suffix; these exact aliases are unambiguous in a substat field.
  "basic attack dmg": "Basic Attack DMG Bonus",
  "heavy attack dmg": "Heavy Attack DMG Bonus",
  "resonance skill dmg": "Resonance Skill DMG Bonus",
  "resonance liberation dmg": "Resonance Liberation DMG Bonus",
  "resonance liberation": "Resonance Liberation DMG Bonus",
};

const PERCENT_ONLY = new Set([
  "Crit. Rate",
  "Crit. DMG",
  "Energy Regen",
  "Basic Attack DMG Bonus",
  "Heavy Attack DMG Bonus",
  "Resonance Skill DMG Bonus",
  "Resonance Liberation DMG Bonus",
]);

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseSubstat(value: string): {
  name: string;
  amount: number;
  percent: boolean;
} | null {
  const text = value.trim();

  // Tesseract sometimes appends a short icon artifact to the label (for
  // example, "Crit. DMG PAR 21%"). Keep the numeric tail strict, then resolve
  // the label against the known game stat aliases below.
  const match = text.match(/^(.+?)\s+([+]?\d+(?:\.\d+)?)\s*(%)?\s*$/);

  if (!match) return null;

  const label = normalizeName(match[1]);
  const name = resolveStatName(label);
  if (!name) return null;

  const amount = Number(match[2]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return {
    name,
    amount,
    percent: Boolean(match[3]),
  };
}

function editDistance(left: string, right: string): number {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const above = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[right.length];
}

function resolveStatName(label: string): string | undefined {
  const aliases = Object.entries(STAT_NAMES).sort(([a], [b]) => b.length - a.length);
  const exact = STAT_NAMES[label];
  if (exact) return exact;

  // Remove only short OCR debris following a complete known label. Longer or
  // competing stat names are not guessed.
  const prefixMatches = aliases.filter(([alias]) => {
    if (!label.startsWith(alias + " ")) return false;
    const tail = label.slice(alias.length + 1).trim();
    return tail.length <= 5 && /^[a-z]{1,5}$/.test(tail);
  });
  const prefixNames = [...new Set(prefixMatches.map(([, name]) => name))];
  if (prefixNames.length === 1) return prefixNames[0];

  // Recover a single-character label OCR slip only when one stat alias is the
  // unique nearest match. This path is shared by every Resonator.
  const compact = label.replace(/[^a-z]/g, "");
  const candidates = compact.length >= 5 ? aliases
    .map(([alias, name]) => ({ alias, name, distance: editDistance(compact, alias.replace(/[^a-z]/g, "")) }))
    .filter(candidate => candidate.distance <= (compact.length >= 15 ? 2 : 1)) : [];
  const best = Math.min(...candidates.map(candidate => candidate.distance));
  const names = [...new Set(candidates.filter(candidate => candidate.distance === best).map(candidate => candidate.name))];
  return names.length === 1 ? names[0] : undefined;
}

export function validateEchoSlot(
  slot: RecognizedSlot,
): StatIssue[] {
  const issues: StatIssue[] = [];
  if (slot.presence === "empty") return [{ code: "EMPTY_SLOT", message: "No equipped Echo detected. Upload a card with all five Echoes; missing data must not be invented." }];
  const cost = Number(slot.cost.value.trim());

  if (
    !/^[134]$/.test(slot.cost.value.trim()) ||
    ![1, 3, 4].includes(cost)
  ) {
    issues.push({
      code: "INVALID_COST",
      message: "Echo cost must be 1, 3 or 4.",
    });
  }

  const main = normalizeName(slot.mainStat.value);

  const commonMain = ["atk", "def", "hp"];
  const costFourMain = [
    "crit rate",
    "crit dmg",
    "healing bonus",
  ];
  const costThreeMain = [
    "aero dmg bonus",
    "electro dmg bonus",
    "fusion dmg bonus",
    "glacio dmg bonus",
    "havoc dmg bonus",
    "spectro dmg bonus",
    "energy regen",
  ];

  const allowed =
    cost === 4
      ? [...commonMain, ...costFourMain]
      : cost === 3
        ? [...commonMain, ...costThreeMain]
        : cost === 1
          ? commonMain
          : [];

  const knownMain = [...commonMain, ...costFourMain, ...costThreeMain];
  const costKnown = [1, 3, 4].includes(cost);
  if (!main || !knownMain.includes(main) || (costKnown && !allowed.includes(main))) {
    issues.push({
      code: "INVALID_MAIN",
      message:
        "Main-stat label is missing, unrecognized or incompatible with the Echo cost.",
    });
  }

  if (slot.substats.length !== 5) {
    issues.push({
      code: "SUBSTAT_COUNT",
      message: "Expected five substat fields.",
    });
  }

  const seen = new Set<string>();

  slot.substats.forEach((field, index) => {
    const parsed = parseSubstat(field.value);
    const position = index + 1;

    if (!parsed) {
      issues.push({
        code: "INVALID_SUBSTAT",
        message:
          `Substat ${position} is missing or could not be parsed.`,
      });
      return;
    }

    if ((parsed.percent && parsed.amount > 100) || parsed.amount > 100000) {
      issues.push({
        code: "NUMERIC_RANGE",
        message: `Substat ${position}: value is outside the accepted numeric range; check the screenshot for a missing decimal.`,
      });
    }

    const statKey = parsed.name + (parsed.percent ? ":percent" : ":flat");
    const allowedRolls=(rollTable.values as Record<string,number[]>)[statKey];
    if(!allowedRolls?.some(v=>Math.abs(v-parsed.amount)<1e-6))issues.push({code:"UNSUPPORTED_ROLL",message:`Substat ${position}: ${field.value} does not match the pinned optimizer’s five-star Echo roll table. Compare it with the original card. If the card shows this exact value, it needs source-data review; rescanning will not resolve a catalog mismatch. Stats stay locked.`});
    if (seen.has(statKey)) {
      issues.push({
        code: "DUPLICATE_SUBSTAT",
        message:
          `Substat ${position} duplicates ${parsed.name}.`,
      });
    }

    seen.add(statKey);

    if (
      PERCENT_ONLY.has(parsed.name) &&
      !parsed.percent
    ) {
      issues.push({
        code: "PERCENT_REQUIRED",
        message:
          `Substat ${position}: ${parsed.name} requires %.`,
      });
    }

    if (
      parsed.percent &&
      ["ATK", "DEF", "HP"].includes(parsed.name) &&
      parsed.amount > 100
    ) {
      issues.push({
        code: "SUSPICIOUS_VALUE",
        message:
          `Substat ${position}: percentage exceeds 100%.`,
      });
    }

    if (
      parsed.name === "Crit. Rate" &&
      parsed.amount > 20
    ) {
      issues.push({
        code: "SUSPICIOUS_CRIT",
        message:
          `Substat ${position}: Crit. Rate value requires review.`,
      });
    }

    if (
      parsed.name === "Crit. DMG" &&
      parsed.amount > 50
    ) {
      issues.push({
        code: "SUSPICIOUS_CRIT",
        message:
          `Substat ${position}: Crit. DMG value requires review.`,
      });
    }

    if (
      ["ATK", "DEF", "HP"].includes(parsed.name) &&
      !parsed.percent &&
      !Number.isInteger(parsed.amount)
    ) {
      issues.push({
        code: "FLAT_STAT_DECIMAL",
        message:
          `Substat ${position}: flat stat should be an integer.`,
      });
    }
  });

  return issues;
}

