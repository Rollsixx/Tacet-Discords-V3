import { failure, json, readJson } from "@/lib/server/http";
import { validateSubmission } from "@/lib/server/validation";
import { rateLimit, submit } from "@/lib/server/store";
export async function POST(request: Request) {
  try {
    await rateLimit("submission-global", 30);
    const input = validateSubmission(await readJson(request));
    await rateLimit("uid:" + input.uid, 3);
    return json(await submit(input), 201);
  } catch (error) { return failure(error); }
}
