import { homeRankings } from "@/lib/server/queries";
import { migrateOnce } from "@/lib/server/database";
import { json, failure } from "@/lib/server/http";
export async function GET(){try{await migrateOnce();return Response.json(await homeRankings(),{headers:{"Cache-Control":"public, s-maxage=45, stale-while-revalidate=60","Vercel-CDN-Cache-Control":"public, s-maxage=45, stale-while-revalidate=60","X-Content-Type-Options":"nosniff"}});}catch(error){return failure(error);}}
