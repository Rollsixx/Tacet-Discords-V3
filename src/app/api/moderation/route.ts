import {catalogCompleteness} from "@/lib/server/catalog-completeness.mjs";
import {verifyHistoricalCorrections} from "@/lib/server/correction-workflow.mjs";
import { failure, json, readJson } from "@/lib/server/http";
import { authorizeWorkspace } from "@/lib/server/workspace-auth";
import { HttpError, record } from "@/lib/server/validation";
import { listAdminPlayers, adminPlayerBuilds, setUidVerification, listBuilds, moderate, setPlayerVerification, adminOverview, listAdminAudit, deleteBuild, correctEchoSubstat } from "@/lib/server/store";
import {listLeaderboardRankChanges,leaderboardConsistencyReport,refreshLeaderboardRankHistory} from "@/lib/server/queries";
import {database} from "@/lib/server/database";
export async function GET(request: Request) {
  try {
    const actor=await authorizeWorkspace(request);
    const params=new URL(request.url).searchParams;
    const requestedView=params.get("view")||"";
    if(actor.title==="consultant"){
      if(requestedView==="summary")return json({builds:[],overview:await adminOverview(),activity:[],hasMore:false,page:1});
      if(requestedView==="players")return json({...await listAdminPlayers({page:Number(params.get("page"))||1,search:params.get("search")||"",character:params.get("character")||""}),overview:await adminOverview()});
      if(requestedView==="player"){const uid=params.get("uid")||"";if(!/^\\d{8,12}$/.test(uid))throw new HttpError(400,"Valid player UID required.");return json(await adminPlayerBuilds(uid,Number(params.get("page"))||1));}
      throw new HttpError(403,"Consultant access is read-only and limited to overview and player builds.");
    }
    if(actor.title==="bloom_bearer"&&["catalog","consistency","audit","rank-changes"].includes(requestedView))throw new HttpError(403,"Bloom Bearer access is limited to dashboard, submissions, and player builds.");
    if(params.get("view")==="catalog")return json(await catalogCompleteness());
    if(params.get("view")==="consistency")return json(await leaderboardConsistencyReport());
    const page=Number(params.get("page"))||1;
    const search=params.get("search")||"";
    if(params.get('view')==='players')return json({...await listAdminPlayers({page,search,character:params.get('character')||''}),overview:await adminOverview()});
    if(params.get('view')==='player'){
      const uid=params.get('uid')||'';if(!/^\d{8,12}$/.test(uid))throw new HttpError(400,'Valid player UID required.');
      return json(await adminPlayerBuilds(uid,page));
    }
    if(params.get("view")==="audit")return json(await listAdminAudit(page,search,undefined,params.get("reviewer")||"",params.get("action")||""));
    if(params.get("view")==="rank-changes")return json(await listLeaderboardRankChanges(Number(params.get("limit"))||100,undefined,{character:params.get("character")||"",player:params.get("player")||"",from:params.get("from")||"",to:params.get("to")||""}));
    const [builds,overview,activity]=await Promise.all([
      listBuilds({ pending:params.get("status")!=="approved",search,page,character:params.get("character")||"" }),
      adminOverview(),listAdminAudit(1)
    ]);
    return json({...builds,overview,activity:activity.events.slice(0,6)});
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const actor=await authorizeWorkspace(request);if(actor.title==="consultant")throw new HttpError(403,"Consultant access is read-only.");
    const input = await readJson(request, 4096);
    if(record(input)){if(input.note===undefined)input.note="";input.reviewer=actor.label;}
    if (!record(input) || typeof input.id !== "string" || !/^[a-f0-9-]{36}$/.test(input.id) ||
      !["approved", "rejected"].includes(String(input.action)) || typeof input.reviewer !== "string" ||
      input.reviewer.trim().length < 2 || input.reviewer.length > 64 ||
      typeof input.note !== "string" || input.note.length > 500 || typeof input.identityVerified !== "boolean") {
      throw new HttpError(400, "Valid review action and moderator name required; note is optional.");
    }
    if(input.action==="rejected"&&!(["incomplete","mismatch","unsupported","other"] as unknown[]).includes(input.reasonCode))throw new HttpError(400,"Choose a rejection reason before rejecting this submission.");
    await moderate(input.id, input.action as "approved" | "rejected", input.reviewer.trim(), input.note, input.identityVerified, undefined, input.allowUnranked===true);
    await refreshLeaderboardRankHistory(database());
    return json({ ok: true });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
 try {
  const actor=await authorizeWorkspace(request);if(actor.title==="consultant")throw new HttpError(403,"Consultant access is read-only.");const input=await readJson(request,4096);if(record(input)){if(input.note===undefined)input.note="";input.reviewer=actor.label;}
  if(!record(input)||typeof input.identityVerified!=="boolean"||typeof input.reviewer!=="string"||input.reviewer.trim().length<2||input.reviewer.length>64||typeof input.note!=="string"||input.note.length>500)throw new HttpError(400,"Valid player verification and moderator name required; note is optional.");
  if(typeof input.uid==='string'&&/^\d{8,12}$/.test(input.uid)){const result=await setUidVerification(input.uid,input.identityVerified,input.reviewer.trim(),input.note);await refreshLeaderboardRankHistory(database());return json({ok:true,...result});}
  if(typeof input.id!=='string'||!/^[a-f0-9-]{36}$/.test(input.id))throw new HttpError(400,'Valid player UID or approved build ID required.');
  const result=await setPlayerVerification(input.id,input.identityVerified,input.reviewer.trim(),input.note);await refreshLeaderboardRankHistory(database());return json({ok:true,...result});
 }catch(error){return failure(error);}
}

export async function DELETE(request: Request) {
 try {
  const actor=await authorizeWorkspace(request);if(actor.title==="consultant")throw new HttpError(403,"Consultant access is read-only.");const input=await readJson(request,4096);if(record(input)){if(input.note===undefined)input.note="";input.reviewer=actor.label;}
  if(!record(input)||typeof input.id!=="string"||!/^[a-f0-9-]{36}$/.test(input.id)||input.confirm!==true||typeof input.reviewer!=="string"||input.reviewer.trim().length<2||input.reviewer.length>64||typeof input.note!=="string"||input.note.length>500)throw new HttpError(400,"Confirm deletion and provide a reviewer name and note.");
  const result=await deleteBuild(input.id,input.reviewer.trim(),input.note);await refreshLeaderboardRankHistory(database());return json({ok:true,...result});
 }catch(error){return failure(error);}
}

export async function PUT(request:Request){
 try{
  const actor=await authorizeWorkspace(request);if(actor.title==="consultant")throw new HttpError(403,"Consultant access is read-only.");const input=await readJson(request,65536);if(record(input)){if(input.note===undefined)input.note="";input.reviewer=actor.label;}
  if(record(input)&&input.action==='verify-corrections'){
   if(typeof input.id!=='string'||!/^[a-f0-9-]{36}$/.test(input.id)||!Array.isArray(input.expectedCorrections)||typeof input.reviewer!=='string'||typeof input.note!=='string')throw new HttpError(400,'Invalid correction verification.');
   const result=await verifyHistoricalCorrections(input.id,input.expectedCorrections,input.reviewer,input.verified,input.note);await refreshLeaderboardRankHistory(database());return json({ok:true,...result});
  }
  if(!record(input)||typeof input.id!=='string'||!/^[a-f0-9-]{36}$/.test(input.id)||typeof input.slot!=='number'||typeof input.position!=='number'||typeof input.expected!=='string'||typeof input.replacement!=='string'||typeof input.reviewer!=='string'||typeof input.note!=='string')throw new HttpError(400,'Invalid Echo substat correction.');
  const result=await correctEchoSubstat(input.id,input.slot,input.position,input.expected,input.replacement,input.reviewer,input.note);await refreshLeaderboardRankHistory(database());return json({ok:true,...result});
 }catch(error){return failure(error);}
}
