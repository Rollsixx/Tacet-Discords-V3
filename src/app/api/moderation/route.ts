import { authorize, failure, json, readJson } from "@/lib/server/http";
import { HttpError, record } from "@/lib/server/validation";
import { listAdminPlayers, adminPlayerBuilds, setUidVerification, listBuilds, moderate, setPlayerVerification, adminOverview, listAdminAudit, deleteBuild, correctEchoSubstat } from "@/lib/server/store";
export async function GET(request: Request) {
  try {
    authorize(request);
    const params=new URL(request.url).searchParams;
    const page=Number(params.get("page"))||1;
    const search=params.get("search")||"";
    if(params.get('view')==='players')return json({...await listAdminPlayers({page,search,character:params.get('character')||''}),overview:await adminOverview()});
    if(params.get('view')==='player'){
      const uid=params.get('uid')||'';if(!/^\d{8,12}$/.test(uid))throw new HttpError(400,'Valid player UID required.');
      return json(await adminPlayerBuilds(uid,page));
    }
    if(params.get("view")==="audit")return json(await listAdminAudit(page,search));
    const [builds,overview,activity]=await Promise.all([
      listBuilds({ pending:params.get("status")!=="approved",search,page,character:params.get("character")||"" }),
      adminOverview(),listAdminAudit(1)
    ]);
    return json({...builds,overview,activity:activity.events.slice(0,6)});
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
    await moderate(input.id, input.action as "approved" | "rejected", input.reviewer.trim(), input.note, input.identityVerified, undefined, input.allowUnranked===true);
    return json({ ok: true });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
 try {
  authorize(request);const input=await readJson(request,4096);
  if(!record(input)||typeof input.identityVerified!=="boolean"||typeof input.reviewer!=="string"||input.reviewer.trim().length<2||input.reviewer.length>64||typeof input.note!=="string"||input.note.length>500)throw new HttpError(400,"Valid player verification, reviewer and note required.");
  if(typeof input.uid==='string'&&/^\d{8,12}$/.test(input.uid))return json({ok:true,...await setUidVerification(input.uid,input.identityVerified,input.reviewer.trim(),input.note)});
  if(typeof input.id!=='string'||!/^[a-f0-9-]{36}$/.test(input.id))throw new HttpError(400,'Valid player UID or approved build ID required.');
  return json({ok:true,...await setPlayerVerification(input.id,input.identityVerified,input.reviewer.trim(),input.note)});
 }catch(error){return failure(error);}
}

export async function DELETE(request: Request) {
 try {
  authorize(request);const input=await readJson(request,4096);
  if(!record(input)||typeof input.id!=="string"||!/^[a-f0-9-]{36}$/.test(input.id)||input.confirm!==true||typeof input.reviewer!=="string"||input.reviewer.trim().length<2||input.reviewer.length>64||typeof input.note!=="string"||input.note.length>500)throw new HttpError(400,"Confirm deletion and provide a reviewer name and note.");
  return json({ok:true,...await deleteBuild(input.id,input.reviewer.trim(),input.note)});
 }catch(error){return failure(error);}
}

export async function PUT(request:Request){
 try{
  authorize(request);const input=await readJson(request,4096);
  if(!record(input)||typeof input.id!=='string'||!/^[a-f0-9-]{36}$/.test(input.id)||typeof input.slot!=='number'||typeof input.position!=='number'||typeof input.expected!=='string'||typeof input.replacement!=='string'||typeof input.reviewer!=='string'||typeof input.note!=='string')throw new HttpError(400,'Invalid Echo substat correction.');
  return json({ok:true,...await correctEchoSubstat(input.id,input.slot,input.position,input.expected,input.replacement,input.reviewer,input.note)});
 }catch(error){return failure(error);}
}
