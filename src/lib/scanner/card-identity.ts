import {featuredResonators} from "../resonators.ts";

import {parseCardUid} from "./card-layout.ts";

export type CardIdentity = { character: string; ign: string; uid: string };

// Read the labelled header only; never borrow digits from levels or Echo stats.
function normalizeCharacterOcr(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[l1]/g, "i").replace(/[^a-z0-9]/g, "");
}

export function parseCardIdentity(character: string, player: string, uidLine: string): CardIdentity {
  const uid = parseCardUid(uidLine);
  const header = character
    .replace(/\bSouming\b/gi, "Suoming")
    .replace(/\bSuisuli\b/gi, "Suisui")
    .split(/\bL\s*V\s*\.?\s*\d/i)[0]
    .trim();
  const canonical = featuredResonators.map(r => r.name).find(name => new RegExp("\\b" + name + "\\b", "i").test(header));
  const normalizedHeader = normalizeCharacterOcr(header);
  const equivalentNames = featuredResonators.filter(r => normalizeCharacterOcr(r.name) === normalizedHeader);
  const resolved = canonical || (equivalentNames.length === 1 ? equivalentNames[0].name : null);
  return {
    character: resolved || header.replace(/[^\p{L}\p{N}\s'’()-]/gu, "").trim(),
    ign: player.replace(/^\s*Player\s*I[Dd]\s*[:：.]?\s*/i, "").trim().slice(0, 32),
    uid: /^\d{8,12}$/.test(uid) ? uid : "",
  };
}
