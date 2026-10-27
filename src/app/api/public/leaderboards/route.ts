import { listLeaderboard } from "@/lib/server/store";
import { json, failure } from "@/lib/server/http";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try { return json(await listLeaderboard({character:params.get("character")||undefined,search:params.get("search")||"",page:Number(params.get("page"))||1})); }
  catch(error) {return failure(error);}
}
