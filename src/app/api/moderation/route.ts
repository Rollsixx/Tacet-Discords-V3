import { authorize, failure, json, readJson } from "@/lib/server/http";
import { HttpError, record } from "@/lib/server/validation";
import { listBuilds, moderate } from "@/lib/server/store";
export async function GET(request: Request) {
  try {
    authorize(request);
    return json(await listBuilds({ pending: true, page: Number(new URL(request.url).searchParams.get("page")) || 1 }));
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    authorize(request);
    const input = await readJson(request, 4096);
    if (!record(input) || typeof input.id !== "string" || !/^[a-f0-9-]{36}$/.test(input.id) ||
      !["approved", "rejected"].includes(String(input.action)) || typeof input.reviewer !== "string" ||
      input.reviewer.trim().length < 2 || input.reviewer.length > 64 ||
      typeof input.note !== "string" || input.note.length > 500 || typeof input.identityVerified !== "boolean") {
      throw new HttpError(400, "Valid review action, reviewer and note required.");
    }
    await moderate(input.id, input.action as "approved" | "rejected", input.reviewer.trim(), input.note, input.identityVerified);
    return json({ ok: true });
  } catch (error) { return failure(error); }
}
