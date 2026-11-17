import { database, migrateOnce } from "@/lib/server/database";
import { authorize, failure, json, readJson } from "@/lib/server/http";
import { listMedalEligibility, setMedalEligibility } from "@/lib/server/medal-eligibility";
import { HttpError } from "@/lib/server/validation";

export async function GET(request: Request) {
  try {
    authorize(request);
    await migrateOnce();
    return json({ characters: await listMedalEligibility(database()) });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    authorize(request);
    const body = await readJson(request, 1024);
    if (!body || typeof body !== "object" || !("character" in body) || !("eligible" in body)) {
      throw new HttpError(400, "Choose a Resonator and its medal eligibility.");
    }
    await migrateOnce();
    return json(await setMedalEligibility(database(), body.character, body.eligible));
  } catch (error) {
    return failure(error);
  }
}
