export type CardIdentity = { character: string; ign: string; uid: string };

// Read the labelled header only; never borrow digits from levels or Echo stats.
export function parseCardIdentity(character: string, player: string, uidLine: string): CardIdentity {
  const uid = uidLine.replace(/^.*?U[Iil1]D\s*[:：.]?\s*/i, "").replace(/\s/g, "");
  const canonical = ["Carlotta", "Cartethyia", "Aemeath", "Hiyuki", "Chisa"].find(name => new RegExp("\\b" + name + "\\b", "i").test(character));
  return {
    character: canonical || character.split(/\bL\s*V\s*\.?\s*\d/i)[0].replace(/[^\p{L}\p{N}\s'’()-]/gu, "").trim(),
    ign: player.replace(/^\s*Player\s*I[Dd]\s*[:：.]?\s*/i, "").trim().slice(0, 32),
    uid: /^\d{8,12}$/.test(uid) ? uid : "",
  };
}
