import { failure, json } from "@/lib/server/http";
import { findPlayers, listBuilds } from "@/lib/server/queries";
export async function GET(request: Request) {
 const params=new URL(request.url).searchParams;
 try {
  const uid=params.get('uid'),patchMajor=params.get('patch')||"";
  if(uid&&!/^\d{8,12}$/.test(uid))return json({error:'Enter a valid 8–12 digit UID.'},400);
  if(patchMajor&&!/^\d{1,2}$/.test(patchMajor))return json({error:'Choose a valid character version.'},400);
  return json(uid?await listBuilds({uid,page:Number(params.get('page'))||1,patchMajor}):await findPlayers(params.get('search')||''));
 }catch(error){return failure(error);}
}
