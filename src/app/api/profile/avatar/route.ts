import { failure, json, readJson } from "@/lib/server/http";
import { HttpError, validateSubmission } from "@/lib/server/validation";
import { rateLimit } from "@/lib/server/rate-limit";
import { assessSource } from "@/lib/server/source-evidence.mjs";
import { database } from "@/lib/server/database";

export async function POST(request:Request) {
 try {
  await rateLimit("profile-avatar-global",30);
  const input=validateSubmission(await readJson(request));
  await rateLimit("profile-avatar-uid:"+input.uid,10);
  const evidence=await assessSource(input);
  if(evidence.sourceUid!==input.uid)throw new HttpError(400,"The original screenshot UID could not be verified. Avatar was not changed.");
  const result=await database().execute({sql:"UPDATE players SET avatar_character=? WHERE uid=?",args:[input.avatarCharacter,input.uid]});
  if(!Number(result.rowsAffected))throw new HttpError(404,"Import a build for this UID before changing its profile avatar.");
  return json({ok:true,avatarCharacter:input.avatarCharacter});
 }catch(error){return failure(error);}
}
