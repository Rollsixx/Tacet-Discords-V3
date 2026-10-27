import { authorize, failure, json, readJson } from "@/lib/server/http";
import { HttpError, record } from "@/lib/server/validation";
import { listBuilds, moderate, setPlayerVerification } from "@/lib/server/store";
export async function GET(request: Request) {
  try {
    authorize(request);
    return json(await listBuilds({ pending: new URL(request.url).searchParams.get("status") !== "approved", search: new URL(request.url).searchParams.get("search") || "", page: Number(new URL(request.url).searchParams.get("page")) || 1 }));
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

export async function PATCH(request: Request) {
 try {
  authorize(request);const input=await readJson(request,4096);
  if(!record(input)||typeof input.id!=="string"||!/^[a-f0-9-]{36}$/.test(input.id)||typeof input.identityVerified!=="boolean"||typeof input.reviewer!=="string"||input.reviewer.trim().length<2||input.reviewer.length>64||typeof input.note!=="string"||input.note.length>500)throw new HttpError(400,"Valid player verification, reviewer and note required.");
  return json({ok:true,...await setPlayerVerification(input.id,input.identityVerified,input.reviewer.trim(),input.note)});
 }catch(error){return failure(error);}
}
