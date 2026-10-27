import { failure, json } from "@/lib/server/http";
import { listBuilds } from "@/lib/server/store";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try {
    return json(await listBuilds({
      search: params.get("search") || "", character: params.get("character") || "",
      id: params.get("id") || "", page: Number(params.get("page")) || 1,
    }));
  } catch (error) { return failure(error); }
}
