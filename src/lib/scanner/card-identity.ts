import {featuredResonators} from "../resonators.ts";

import {parseCardUid} from "./card-layout.ts";

export type CardIdentity = { character: string; ign: string; uid: string };

// Read the labelled header only; never borrow digits from levels or Echo stats.
export function parseCardIdentity(character: string, player: string, uidLine: string): CardIdentity {
  const uid = parseCardUid(uidLine);
  const canonical = featuredResonators.map(r=>r.name).find(name => new RegExp("\\b" + name + "\\b", "i").test(character.replace(/\bSouming\b/gi,"Suoming").replace(/\bSuisuli\b/gi,"Suisui")));
  return {
    character: canonical || character.split(/\bL\s*V\s*\.?\s*\d/i)[0].replace(/[^\p{L}\p{N}\s'’()-]/gu, "").trim(),
    ign: player.replace(/^\s*Player\s*I[Dd]\s*[:：.]?\s*/i, "").trim().slice(0, 32),
    uid: /^\d{8,12}$/.test(uid) ? uid : "",
  };
}
