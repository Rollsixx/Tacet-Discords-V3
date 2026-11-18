import type { Client } from "@libsql/client";
import { leaderboardCharacterKey, leaderboardCharacterMembers, leaderboardResonators } from "../resonators.ts";
import { HttpError } from "./validation.ts";

const keyPrefix = "medal-eligibility:";

export async function eligibleMedalCharacters(db: Client): Promise<string[]> {
  const { rows } = await db.execute({
    sql: "SELECT key,value FROM app_settings WHERE key LIKE ?",
    args: [keyPrefix + "%"],
  });
  const settings = new Map(rows.map(row => [String(row.key).slice(keyPrefix.length), String(row.value)]));
  return leaderboardResonators.map(character => character.name).filter(key => {
    const saved = settings.get(key);
    if (saved !== undefined) return saved !== "false";
    return leaderboardCharacterMembers(key).every(member => settings.get(member) !== "false");
  });
}

export async function listMedalEligibility(db: Client) {
  const eligible = new Set(await eligibleMedalCharacters(db));
  return leaderboardResonators.map(character => ({
    name: character.name,
    label: character.displayName || character.name,
    patchVersion: character.patchVersion,
    eligible: eligible.has(character.name),
  }));
}

export async function setMedalEligibility(db: Client, character: unknown, eligible: unknown) {
  const key = typeof character === "string" ? leaderboardCharacterKey(character) : "";
  if (!leaderboardResonators.some(character => character.name === key)) {
    throw new HttpError(400, "Choose a supported Resonator.");
  }
  if (typeof eligible !== "boolean") throw new HttpError(400, "Choose whether this Resonator counts toward medals.");
  await db.execute({
    sql: `INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?)
          ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at
          WHERE app_settings.value<>excluded.value`,
    args: [keyPrefix + key, String(eligible), new Date().toISOString()],
  });
  return { character: key, eligible };
}
