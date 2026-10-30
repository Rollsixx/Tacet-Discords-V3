import { failure, json, readJson } from "@/lib/server/http";
import { validateSubmission } from "@/lib/server/validation";
import {rateLimit} from "@/lib/server/rate-limit";
import {submit} from "@/lib/server/submission-store";
export async function POST(request: Request) {
  try {
    await rateLimit("submission-global", 30);
    const input = validateSubmission(await readJson(request));
    await rateLimit("uid:" + input.uid, 10);
    return json(await submit(input, undefined, true), 201);
  } catch (error) { return failure(error); }
}
