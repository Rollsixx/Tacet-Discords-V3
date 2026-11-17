import { database } from "./database.ts";

const KEY_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;

export async function isFeatureEnabled(key, db = database()) {
  if (!KEY_PATTERN.test(key)) throw new Error("Invalid feature flag key.");
  const result = await db.execute({
    sql: "SELECT value FROM app_settings WHERE key=?",
    args: [`feature:${key}`],
  });
  return String(result.rows[0]?.value || "").toLowerCase() === "true";
}

export async function setFeatureEnabled(key, enabled, db = database()) {
  if (!KEY_PATTERN.test(key)) throw new Error("Invalid feature flag key.");
  const now = new Date().toISOString();
  await db.execute({
    sql: "INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
    args: [`feature:${key}`, enabled ? "true" : "false", now],
  });
  return enabled;
}
