import { failure, json } from "@/lib/server/http";
import { findPlayers, listBuilds } from "@/lib/server/store";
export async function GET(request: Request) {
 const params=new URL(request.url).searchParams;
 try {
  const uid=params.get('uid');
  if(uid&&!/^\d{8,12}$/.test(uid))return json({error:'Enter a valid 8–12 digit UID.'},400);
  return json(uid?await listBuilds({uid,page:Number(params.get('page'))||1}):await findPlayers(params.get('search')||''));
 }catch(error){return failure(error);}
}
