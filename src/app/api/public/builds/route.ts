import { failure, json } from "@/lib/server/http";
import { listBuilds } from "@/lib/server/queries";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try {
    return Response.json(await listBuilds({
      search: params.get("search") || "", character: params.get("character") || "",
      id: params.get("id") || "", page: Number(params.get("page")) || 1,
    }),{headers:{"Cache-Control":"public, s-maxage=45, stale-while-revalidate=60","Vercel-CDN-Cache-Control":"public, s-maxage=45, stale-while-revalidate=60","X-Content-Type-Options":"nosniff"}});
  } catch (error) { return failure(error); }
}
