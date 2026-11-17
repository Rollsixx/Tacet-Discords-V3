import {featuredResonators} from "../resonators.ts";

import {parseCardUid} from "./card-layout.ts";

export type CardIdentity = { character: string; ign: string; uid: string };

// Read the labelled header only; never borrow digits from levels or Echo stats.
function normalizeCharacterOcr(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[l1]/g, "i").replace(/[^a-z0-9]/g, "");
}

function withinOneOcrEdit(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length === b.length) { i++; j++; }
    else if (a.length > b.length) i++;
    else j++;
  }
  return edits + Number(i < a.length || j < b.length) <= 1;
}

export function parseCardIdentity(character: string, player: string, uidLine: string): CardIdentity {
  const uid = parseCardUid(uidLine);
  const header = character
    .replace(/\bSouming\b/gi, "Suoming")
    .replace(/\bSuisuli\b/gi, "Suisui")
    .split(/\bL\s*V\s*\.?\s*\d/i)[0]
    .trim();
  // The card's LV badge can leak `mw` into OCR after the character name.
  const identityHeader = header.replace(/\s+mw$/i, "").trim();
  const normalizedHeader = normalizeCharacterOcr(identityHeader);
  const rawNormalizedHeader = normalizeCharacterOcr(header);
  // Restrict corrections to known roster names and observed OCR variants. Matching
  // a full normalized roster name inside the header tolerates OCR noise after LV.
  const ocrAliases: Record<string, string> = {
    zanmw: "Zani",
  };
  const aliasMatch = Object.entries(ocrAliases).find(([alias]) => rawNormalizedHeader.includes(alias));
  const rosterMatches = featuredResonators.flatMap(resonator =>
    [resonator.name, resonator.displayName].filter((value): value is string => Boolean(value))
      .map(normalizeCharacterOcr).filter(alias => normalizedHeader.includes(alias))
      .map(alias => ({ name: resonator.name, alias })));
  // Base names can also be prefixes of a variant name, such as Yangyang.
  const distinctMatches = rosterMatches.filter(match => !rosterMatches.some(other =>
    other.name !== match.name && other.alias.length > match.alias.length && other.alias.includes(match.alias)));
  const uniqueMatches = [...new Set(distinctMatches.map(match => match.name))];
  const fuzzyMatches = normalizedHeader.length >= 5
    ? featuredResonators.filter(resonator => {
        const aliases = [resonator.name, resonator.displayName].filter((value): value is string => Boolean(value));
        return aliases.some(alias => withinOneOcrEdit(normalizedHeader, normalizeCharacterOcr(alias)));
      })
    : [];
  const uniqueFuzzyMatches = [...new Map(fuzzyMatches.map(resonator => [resonator.name, resonator])).values()];
  const resolved = aliasMatch
    ? aliasMatch[1]
    : uniqueMatches.length === 1
      ? uniqueMatches[0]
      : uniqueMatches.length === 0 && uniqueFuzzyMatches.length === 1
        ? uniqueFuzzyMatches[0].name
        : null;
  return {
    character: resolved || header.replace(/[^\p{L}\p{N}\s'’()-]/gu, "").trim(),
    ign: player.replace(/^\s*Player\s*I[Dd]\s*[:：.]?\s*/i, "").trim().slice(0, 32),
    uid: /^\d{8,12}$/.test(uid) ? uid : "",
  };
}
