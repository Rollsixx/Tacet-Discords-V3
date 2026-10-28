import { homeRankings } from "@/lib/server/store";
import { json, failure } from "@/lib/server/http";
export async function GET(){try{return json(await homeRankings());}catch(error){return failure(error);}}
