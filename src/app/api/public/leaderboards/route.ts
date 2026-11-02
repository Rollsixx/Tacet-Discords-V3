import { listLeaderboard } from "@/lib/server/queries";
import { json, failure } from "@/lib/server/http";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try { return Response.json(await listLeaderboard({character:params.get("character")||undefined,search:params.get("search")||"",page:Number(params.get("page"))||1}),{headers:{"Cache-Control":"public, s-maxage=45, stale-while-revalidate=60","Vercel-CDN-Cache-Control":"public, s-maxage=45, stale-while-revalidate=60","X-Content-Type-Options":"nosniff"}}); }
  catch(error) {return failure(error);}
}
