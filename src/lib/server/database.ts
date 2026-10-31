import { createClient, type Client } from "@libsql/client";
import { migrations } from "./schema.ts";

let client: Client | undefined;
const migrationRuns = new WeakMap<Client,Promise<void>>();
export function database() {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url && process.env.NODE_ENV === "production") {
      throw new Error("TURSO_DATABASE_URL is required in production");
    }
    if (process.env.NODE_ENV === "production" && url?.startsWith("file:") && process.env.ALLOW_LOCAL_DATABASE !== "true") {
      throw new Error("Production file database requires an explicit persistent-volume opt-in");
    }
    client = createClient({
      url: url || "file:tacet-dev.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
      timeout: 5000,
    });
  }
  return client;
}

export async function migrate(db: Client = database()) {
  await db.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
  for (const migration of migrations) {
    const tx = await db.transaction("write");
    try {
      const found = await tx.execute({ sql: "SELECT version FROM schema_migrations WHERE version=?", args: [migration.version] });
      if (!found.rows.length) {
        for (const sql of migration.statements) await tx.execute(sql);
        await tx.execute({ sql: "INSERT INTO schema_migrations VALUES (?,?)", args: [migration.version, new Date().toISOString()] });
      }
      await tx.commit();
    } finally { tx.close(); }
  }
}

// Apply additive migrations once per warm runtime and database client. This
// keeps the public Home request from repeating the full migration scan.
export function migrateOnce(db:Client=database()) {
  const ready=migrationRuns.get(db);
  if(ready)return ready;
  const pending=migrate(db).catch(error=>{migrationRuns.delete(db);throw error;});
  migrationRuns.set(db,pending);
  return pending;
}
