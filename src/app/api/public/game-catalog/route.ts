import { database, migrateOnce } from '@/lib/server/database';
import { failure, json } from '@/lib/server/http';

export async function GET() {
  try {
    await migrateOnce();
    const result = await database().execute("SELECT kind,source_key,name,image_url,details,imported_at FROM game_data_catalog WHERE state='published' ORDER BY kind,name LIMIT 250");
    return json({ items: result.rows.map(row => ({ kind: row.kind, key: row.source_key, name: row.name, image: row.image_url, details: JSON.parse(String(row.details)), importedAt: row.imported_at, rankingReady: false })) });
  } catch (error) { return failure(error); }
}
