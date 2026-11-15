import { failure, json, readJson } from "@/lib/server/http";
import { validateSubmission } from "@/lib/server/validation";
import {rateLimit} from "@/lib/server/rate-limit";
import {after} from "next/server";
import {completeProfileDetails,submit} from "@/lib/server/submission-store";
export async function POST(request: Request) {
  try {
    await rateLimit("submission-global", 30);
    const input = validateSubmission(await readJson(request));
    await rateLimit("uid:" + input.uid, 10);
    const result=await submit(input, undefined, true);
    if(input.sourceImage)after(async()=>{
      try{await completeProfileDetails(result.id,input.sourceImage!);}
      catch(error){console.error("Deferred profile details extraction failed",error instanceof Error?error.message:"unknown error");}
    });
    return json(result, 201);
  } catch (error) { return failure(error); }
}
