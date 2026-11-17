import type { Client } from "@libsql/client";
import { featuredResonators } from "../resonators.ts";
import { SUPPORTED } from "./scoring-versions.mjs";
import { HttpError } from "./validation.ts";

const keyPrefix = "medal-eligibility:";

export async function eligibleMedalCharacters(db: Client): Promise<string[]> {
  const { rows } = await db.execute({
    sql: "SELECT key FROM app_settings WHERE key LIKE ? AND value='false'",
    args: [keyPrefix + "%"],
  });
  const excluded = new Set(rows.map(row => String(row.key).slice(keyPrefix.length)));
  return SUPPORTED.filter(character => !excluded.has(character));
}

export async function listMedalEligibility(db: Client) {
  const eligible = new Set(await eligibleMedalCharacters(db));
  return featuredResonators.filter(character => SUPPORTED.includes(character.name)).map(character => ({
    name: character.name,
    label: character.displayName || character.name,
    patchVersion: character.patchVersion,
    eligible: eligible.has(character.name),
  }));
}

export async function setMedalEligibility(db: Client, character: unknown, eligible: unknown) {
  if (typeof character !== "string" || !SUPPORTED.includes(character)) {
    throw new HttpError(400, "Choose a supported Resonator.");
  }
  if (typeof eligible !== "boolean") throw new HttpError(400, "Choose whether this Resonator counts toward medals.");
  await db.execute({
    sql: `INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?)
          ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at
          WHERE app_settings.value<>excluded.value`,
    args: [keyPrefix + character, String(eligible), new Date().toISOString()],
  });
  return { character, eligible };
}
