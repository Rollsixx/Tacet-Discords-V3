import { homeRankings } from "@/lib/server/queries";
import { migrateOnce } from "@/lib/server/database";
import { json, failure } from "@/lib/server/http";
export async function GET(){try{await migrateOnce();return json(await homeRankings());}catch(error){return failure(error);}}
