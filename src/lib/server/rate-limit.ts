import type {Client} from '@libsql/client';
import {database} from './database.ts';
import {HttpError} from './validation.ts';
export async function rateLimit(key: string, max: number, db: Client = database()) {
  const window = Math.floor(Date.now() / 60000);
  const result = await db.execute({
    sql: `INSERT INTO rate_limits(key,window,count) VALUES (?,?,1)
      ON CONFLICT(key) DO UPDATE SET
      count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,
      window=excluded.window RETURNING count`,
    args: [key, window],
  });
  // Global endpoint buckets provide a bounded cleanup opportunity even when
  // no build submissions are made. This also prunes per-UID buckets created
  // by endpoints such as profile avatar updates.
  if (key.endsWith("-global") && Number(result.rows[0].count) === 1) {
    await db.execute({ sql: "DELETE FROM rate_limits WHERE window<?", args: [window - 10] });
  }
  if (Number(result.rows[0].count) > max) throw new HttpError(429, "Too many requests. Wait one minute.");
}
