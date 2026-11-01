import { failure, json } from "@/lib/server/http";
import { findPlayers, listBuilds, medalStandings } from "@/lib/server/queries";
export async function GET(request: Request) {
 const params=new URL(request.url).searchParams;
 try {
  const uid=params.get('uid'),patchMajor=params.get('patch')||"";
  if(uid&&!/^\d{8,12}$/.test(uid))return json({error:'Enter a valid 8–12 digit UID.'},400);
  if(patchMajor&&!/^\d{1,2}$/.test(patchMajor))return json({error:'Choose a valid character version.'},400);
  const search=params.get('search')||''; const data=uid?await listBuilds({uid,page:Number(params.get('page'))||1,patchMajor}):await findPlayers(search); if(!uid&&!search.trim())return Response.json({...data,topPlayers:(await medalStandings()).players},{headers:{"Cache-Control":"public, s-maxage=45, stale-while-revalidate=60","X-Content-Type-Options":"nosniff"}}); return Response.json(data,{headers:{"Cache-Control":"public, s-maxage=45, stale-while-revalidate=60","X-Content-Type-Options":"nosniff"}});
 }catch(error){return failure(error);}
}
