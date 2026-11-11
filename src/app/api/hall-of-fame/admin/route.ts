import {technicalRoleFor,type WorkspaceTitle} from "@/lib/server/workspace-auth";
import {createHash,randomBytes,randomInt,timingSafeEqual,randomUUID} from "node:crypto";
import {database,migrateOnce} from "@/lib/server/database";
import {failure,json,readJson} from "@/lib/server/http";
import {HttpError} from "@/lib/server/validation";
import {featuredResonators} from "@/lib/resonators";

const statuses=["draft","announced","registration_open","registration_closed","bracket_prepared","bracket_revealed","in_progress","results_pending","finalized","archived","suspended","cancelled"];
const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
type Actor={id:string;role:"owner"|"hall_of_fame_admin"|"organizer"|"referee";title:WorkspaceTitle;label:string};
function text(value:unknown,name:string,max=300){if(typeof value!=="string"||!value.trim()||value.trim().length>max)throw new HttpError(400,name+" is required.");return value.trim();}
function tokenDigest(value:string){return createHash("sha256").update(value).digest();}
async function actorFor(request:Request,db:any):Promise<Actor>{
 const supplied=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(!supplied)throw new HttpError(401,"Moderator authorization required.");
 const ownerToken=process.env.MODERATOR_TOKEN;
 if(ownerToken&&ownerToken.length>=32&&timingSafeEqual(tokenDigest(supplied),tokenDigest(ownerToken)))return {id:"owner",role:"owner",title:"arbiter",label:"Arbiter"};
 const result=await db.execute({sql:"SELECT id,label,role,title,revoked_at FROM hof_staff WHERE token_hash=?",args:[tokenDigest(supplied).toString("hex")]});
 const row=result.rows[0];if(!row||row.revoked_at)throw new HttpError(401,"Moderator authorization required.");
 return {id:String(row.id),role:String(row.role) as Actor["role"],title:String(row.title) as WorkspaceTitle,label:String(row.label)};
}
async function can(actor:Actor,capability:string,slug:string|null,matchId:string|null,db:any){
 if(actor.role==="owner"||actor.role==="hall_of_fame_admin")return true;
 if(!slug)return false;
 const rows=await db.execute({sql:"SELECT 1 FROM hof_staff_assignments WHERE staff_id=? AND tournament_slug=? AND (match_id IS NULL OR match_id=?) LIMIT 1",args:[actor.id,slug,matchId]});
 const assigned=rows.rows.length>0;
 if(actor.role==="organizer"&&assigned&&["manage_event","publish_result"].includes(capability))return true;
 if(actor.role==="referee"&&assigned&&matchId&&capability==="draft_result")return true;
 return false;
}
async function requireCan(actor:Actor,capability:string,slug:string|null,matchId:string|null,db:any){
 if(!(await can(actor,capability,slug,matchId,db)))throw new HttpError(403,"Your Hall of Fame role does not allow this action.");
}
async function audit(db:any,actor:Actor,action:string,slug:string|null,before:unknown,after:unknown,reason=""){
 await db.execute({sql:"INSERT INTO hof_audit_events(id,tournament_slug,actor_id,actor_role,action,reason,before_state,after_state,outcome,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",args:[randomUUID(),slug,actor.id,actor.title,action,reason,JSON.stringify(before||{}),JSON.stringify(after||{}),"success",new Date().toISOString()]});
}
async function addMatch(tx:any,slug:string,round:number,label:string,order:number,side:string,left:any,right:any,now:string){
 const leftId=left?.kind==="player"?left.id:null,rightId=right?.kind==="player"?right.id:null;
 const state=leftId&&rightId?"ready":"awaiting_competitors",id=randomUUID();
 await tx.execute({sql:"INSERT INTO hof_matches(id,tournament_slug,round_number,round_label,match_order,bracket_side,participant_a,participant_b,state,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)",args:[id,slug,round,label,order,side,leftId,rightId,state,now]});
 if(left?.kind==="match")await tx.execute({sql:"INSERT INTO hof_match_dependencies(match_id,depends_on_match_id,dependency_type) VALUES(?,?,'winner')",args:[id,left.id]});
 if(right?.kind==="match")await tx.execute({sql:"INSERT INTO hof_match_dependencies(match_id,depends_on_match_id,dependency_type) VALUES(?,?,'winner')",args:[id,right.id]});
 return {kind:"match",id,round,order,left,right};
}
function shuffled<T>(items:T[]){const out=[...items];for(let i=out.length-1;i>0;i--){const j=randomInt(i+1);[out[i],out[j]]=[out[j],out[i]];}return out;}
async function prepareSingleElimination(db:any,slug:string,actor:Actor,now:string){
 const tx=await db.transaction("write");
 try{
  const eventResult=await tx.execute({sql:"SELECT status,format,capacity_min FROM hof_tournaments WHERE slug=?",args:[slug]});
  const event=eventResult.rows[0];if(!event)throw new HttpError(404,"Tournament not found.");
  await requireCan(actor,"manage_event",slug,null,db);
  if(event.format!=="single_elimination")throw new HttpError(409,"Bracket preparation currently supports single elimination only.");
  if(event.status!=="registration_closed")throw new HttpError(409,"Close registration before preparing a bracket.");
  const existing=await tx.execute({sql:"SELECT COUNT(*) total FROM hof_matches WHERE tournament_slug=?",args:[slug]});
  if(Number(existing.rows[0]?.total||0)>0)throw new HttpError(409,"A bracket already exists. Use an audited correction workflow instead of reshuffling.");
  const roster=await tx.execute({sql:"SELECT p.id FROM hof_roster r JOIN hof_participants p ON p.id=r.participant_id WHERE r.tournament_slug=? AND r.state='confirmed' AND r.published=1 ORDER BY r.seed_position,p.display_name COLLATE NOCASE,p.id",args:[slug]});
  const entrants=shuffled(roster.rows.map((row:any)=>String(row.id)));
  if(entrants.length<4)throw new HttpError(409,"At least four confirmed entrants are needed for a third-place medal bracket.");
  if(entrants.length<Number(event.capacity_min))throw new HttpError(409,"The confirmed roster is below this event's minimum capacity.");
  let size=1;while(size<entrants.length)size*=2;
  const byeCount=size-entrants.length;
  let nodes:any[]=[];
  for(let i=0;i<byeCount;i++)nodes.push({kind:"player",id:entrants[i]});
  const remaining=entrants.slice(byeCount);
  for(let i=0;i<remaining.length;i+=2){
   const left={kind:"player",id:remaining[i]},right=remaining[i+1]?{kind:"player",id:remaining[i+1]}:null;
   nodes.push(await addMatch(tx,slug,1,"Round 1",Math.floor(i/2)+1,"main",left,right,now));
  }
  const height=Math.log2(size);let round=2,order=0;
  while(nodes.length>1){
   const next:any[]=[];order=0;
   for(let i=0;i<nodes.length;i+=2){
    const left=nodes[i]||null,right=nodes[i+1]||null;
    if(!left||!right){next.push(left||right);continue}
    const label=round===height?"Final":"Round "+round;
    next.push(await addMatch(tx,slug,round,label,++order,"main",left,right,now));
   }
   nodes=next;round++;
  }
  const final=nodes[0],bronzeMatchIds:string[]=[];
  if(entrants.length>=4&&final?.kind==="match"&&final.left?.kind==="match"&&final.right?.kind==="match"){
   const bronzeId=randomUUID();
   await tx.execute({sql:"INSERT INTO hof_matches(id,tournament_slug,round_number,round_label,match_order,bracket_side,participant_a,participant_b,state,updated_at) VALUES(?,?,?,?,?,'third_place',NULL,NULL,'awaiting_competitors',?)",args:[bronzeId,slug,height,"Third-place match",1,now]});
   await tx.execute({sql:"INSERT INTO hof_match_dependencies(match_id,depends_on_match_id,dependency_type) VALUES(?,?,'loser')",args:[bronzeId,final.left.id]});
   await tx.execute({sql:"INSERT INTO hof_match_dependencies(match_id,depends_on_match_id,dependency_type) VALUES(?,?,'loser')",args:[bronzeId,final.right.id]});
   bronzeMatchIds.push(bronzeId);
  }
  await tx.execute({sql:"UPDATE hof_tournaments SET status='bracket_prepared',bracket_published=0,updated_at=?,version=version+1 WHERE slug=?",args:[now,slug]});
  await audit(tx,actor,"prepare_bracket",slug,{}, {format:"single_elimination",entrants:entrants.length,byes:byeCount,finalMatchId:final?.id||null,thirdPlaceMatchIds:bronzeMatchIds});
  await tx.commit();return {ok:true,entrants:entrants.length,byes:byeCount};
 }catch(error){await tx.rollback();throw error}
}
async function prepareDoubleElimination(db:any,slug:string,actor:Actor,now:string){
 const tx=await db.transaction("write");
 try{
  const event=(await tx.execute({sql:"SELECT status,format,capacity_min FROM hof_tournaments WHERE slug=?",args:[slug]})).rows[0];
  if(!event)throw new HttpError(404,"Tournament not found.");
  await requireCan(actor,"manage_event",slug,null,db);
  if(event.format!=="double_elimination")throw new HttpError(409,"This tournament is not configured for double elimination.");
  if(event.status!=="registration_closed")throw new HttpError(409,"Close registration before preparing a bracket.");
  const existing=await tx.execute({sql:"SELECT COUNT(*) total FROM hof_matches WHERE tournament_slug=?",args:[slug]});
  if(Number(existing.rows[0]?.total||0))throw new HttpError(409,"A bracket already exists. Use an audited correction workflow instead of reshuffling.");
  const roster=await tx.execute({sql:"SELECT p.id FROM hof_roster r JOIN hof_participants p ON p.id=r.participant_id WHERE r.tournament_slug=? AND r.state='confirmed' AND r.published=1 ORDER BY r.seed_position,p.display_name COLLATE NOCASE,p.id",args:[slug]});
  const entrants:string[]=shuffled<string>((roster.rows as any[]).map((row:any)=>String(row.id))),n=entrants.length;
  if(n<4||n>128||(n&(n-1))!==0)throw new HttpError(409,"Double elimination currently needs 4, 8, 16, 32, 64, or 128 confirmed entrants. Adjust the roster or choose single elimination.");
  if(n<Number(event.capacity_min))throw new HttpError(409,"The confirmed roster is below this event's minimum capacity.");
  const rounds=Math.log2(n),upper:any[][]=[];let nodes:any[]=entrants.map((id:string)=>({kind:"player",id}));
  for(let r=1;r<=rounds;r++){
   const next:any[]=[];for(let i=0;i<nodes.length;i+=2){const match=await addMatch(tx,slug,r,r===rounds?"Upper Bracket Final":"Upper Bracket Round "+r,i/2+1,"upper",nodes[i],nodes[i+1],now);next.push(match);}
   upper.push(next);nodes=next;
  }
  let lower:any[]=[],lowerRound=2;
  if(rounds>1){
   let order=0;for(let i=0;i<upper[0].length;i+=2){
    const id=randomUUID();order++;
    await tx.execute({sql:"INSERT INTO hof_matches(id,tournament_slug,round_number,round_label,match_order,bracket_side,participant_a,participant_b,state,updated_at) VALUES(?,?,?,'Lower Bracket Round 1',?,'lower',NULL,NULL,'awaiting_competitors',?)",args:[id,slug,1,order,now]});
    await tx.execute({sql:"INSERT INTO hof_match_dependencies(match_id,depends_on_match_id,dependency_type,target_slot) VALUES(?,?,'loser','participant_a'),(?,?,'loser','participant_b')",args:[id,upper[0][i].id,id,upper[0][i+1].id]});
    lower.push({kind:"match",id,round:1,order});
   }
   lowerRound=2;
   for(let r=2;r<=rounds;r++){
    const current:any[]=[];
    for(let i=0;i<upper[r-1].length;i++){
     const id=randomUUID(),side=r===rounds?"lower":"lower",label=r===rounds?"Lower Bracket Final":"Lower Bracket Round "+lowerRound,order=i+1;
     await tx.execute({sql:"INSERT INTO hof_matches(id,tournament_slug,round_number,round_label,match_order,bracket_side,participant_a,participant_b,state,updated_at) VALUES(?,?,?,?,? ,?,NULL,NULL,'awaiting_competitors',?)",args:[id,slug,lowerRound,label,order,side,now]});
     const prior=lower[Math.min(i,lower.length-1)];
     await tx.execute({sql:"INSERT INTO hof_match_dependencies(match_id,depends_on_match_id,dependency_type,target_slot) VALUES(?,?,'winner','participant_a'),(?,?,'loser','participant_b')",args:[id,prior.id,id,upper[r-1][i].id]});
     current.push({kind:"match",id,round:lowerRound,order});
    }
    lower=current;lowerRound++;
    if(r<rounds&&lower.length>1){
     const compact:any[]=[];for(let i=0;i<lower.length;i+=2){
      const id=randomUUID(),order=compact.length+1;
      await tx.execute({sql:"INSERT INTO hof_matches(id,tournament_slug,round_number,round_label,match_order,bracket_side,participant_a,participant_b,state,updated_at) VALUES(?,?,?,'Lower Bracket Round',?,'lower',NULL,NULL,'awaiting_competitors',?)",args:[id,slug,lowerRound,order,now]});
      await tx.execute({sql:"INSERT INTO hof_match_dependencies(match_id,depends_on_match_id,dependency_type,target_slot) VALUES(?,?,'winner','participant_a'),(?,?,'winner','participant_b')",args:[id,lower[i].id,id,lower[i+1].id]});
      compact.push({kind:"match",id,round:lowerRound,order});
     }lower=compact;lowerRound++;
    }
   }
  }
  const upperFinal=upper[rounds-1][0],lowerFinal=lower[0],grandId=randomUUID();
  await tx.execute({sql:"INSERT INTO hof_matches(id,tournament_slug,round_number,round_label,match_order,bracket_side,participant_a,participant_b,state,updated_at) VALUES(?,?,?,'Grand Final',1,'grand_final',NULL,NULL,'awaiting_competitors',?)",args:[grandId,slug,rounds+lowerRound,now]});
  await tx.execute({sql:"INSERT INTO hof_match_dependencies(match_id,depends_on_match_id,dependency_type,target_slot) VALUES(?,?,'winner','participant_a'),(?,?,'winner','participant_b')",args:[grandId,upperFinal.id,grandId,lowerFinal.id]});
  await tx.execute({sql:"UPDATE hof_tournaments SET status='bracket_prepared',bracket_published=0,updated_at=?,version=version+1 WHERE slug=?",args:[now,slug]});
  await audit(tx,actor,"prepare_bracket",slug,{}, {format:"double_elimination",entrants:n,upperRounds:rounds,thirdPlace:"loser of Lower Bracket Final",grandFinalId:grandId});
  await tx.commit();return {ok:true,entrants:n,format:"double_elimination"};
 }catch(error){await tx.rollback();throw error}
}
export async function GET(request:Request){
 try{
  await migrateOnce();const db=database(),actor=await actorFor(request,db),url=new URL(request.url);
  const artworkSlug=url.searchParams.get("artwork");
  if(artworkSlug){await requireCan(actor,"manage_event",artworkSlug,null,db);const row=await db.execute({sql:"SELECT artwork_data_url FROM hof_tournaments WHERE slug=?",args:[artworkSlug]});return json({artworkDataUrl:String(row.rows[0]?.artwork_data_url||"")});}
const slug=url.searchParams.get("slug");
  let eventSql="SELECT slug,title,boss,status,format,event_date,capacity_min,capacity_max,roster_published,bracket_published,medals_published,CASE WHEN artwork_data_url='' THEN 0 ELSE 1 END has_artwork,tournament_kind,bracket_mode FROM hof_tournaments ORDER BY updated_at DESC",eventArgs:any[]=[];
  if(actor.role==="organizer"||actor.role==="referee"){eventSql="SELECT DISTINCT t.slug,t.title,t.boss,t.status,t.format,t.event_date,t.capacity_min,t.capacity_max,t.roster_published,t.bracket_published,t.medals_published,CASE WHEN t.artwork_data_url='' THEN 0 ELSE 1 END has_artwork,t.tournament_kind,t.bracket_mode FROM hof_tournaments t JOIN hof_staff_assignments a ON a.tournament_slug=t.slug WHERE a.staff_id=? ORDER BY t.updated_at DESC";eventArgs=[actor.id]}
  const events=await db.execute({sql:eventSql,args:eventArgs});
  const people=await db.execute("SELECT id,display_name,resonator_icon FROM hof_participants ORDER BY display_name COLLATE NOCASE LIMIT 300");
  const auditRows=await db.execute({sql:"SELECT action,actor_role,reason,outcome,created_at,tournament_slug FROM hof_audit_events "+((actor.role==="owner"||actor.role==="hall_of_fame_admin")?"":"WHERE tournament_slug IN (SELECT tournament_slug FROM hof_staff_assignments WHERE staff_id=?) ")+"ORDER BY created_at DESC LIMIT 30",args:(actor.role==="owner"||actor.role==="hall_of_fame_admin")?[]:[actor.id]});
  let matches:any[]=[];
  if(slug){
   const mayManage=await can(actor,"manage_event",slug,null,db);
   if(mayManage){
    const result=await db.execute({sql:"SELECT m.id,m.round_number,m.round_label,m.match_order,m.bracket_side,m.state,m.participant_a,m.participant_b,m.winner_id,m.outcome,m.version,a.display_name name_a,b.display_name name_b FROM hof_matches m LEFT JOIN hof_participants a ON a.id=m.participant_a LEFT JOIN hof_participants b ON b.id=m.participant_b WHERE m.tournament_slug=? ORDER BY m.round_number,m.match_order,m.bracket_side",args:[slug]});
    matches=result.rows;
   }else if(actor.role==="referee"){
    const assigned=await db.execute({sql:"SELECT match_id FROM hof_staff_assignments WHERE staff_id=? AND tournament_slug=? AND match_id IS NOT NULL",args:[actor.id,slug]});
    const allowed=new Set(assigned.rows.map((row:any)=>String(row.match_id)));
    const result=await db.execute({sql:"SELECT m.id,m.round_number,m.round_label,m.match_order,m.bracket_side,m.state,m.participant_a,m.participant_b,m.winner_id,m.outcome,m.version,a.display_name name_a,b.display_name name_b FROM hof_matches m LEFT JOIN hof_participants a ON a.id=m.participant_a LEFT JOIN hof_participants b ON b.id=m.participant_b WHERE m.tournament_slug=? ORDER BY m.round_number,m.match_order,m.bracket_side",args:[slug]});
    matches=result.rows.filter((row:any)=>allowed.has(String(row.id)));
   }
  }
  let staff:any[]=[];
  if(actor.role==="owner"||actor.role==="hall_of_fame_admin"){
   const rows=await db.execute({sql:"SELECT s.id,s.label,s.role,s.title,s.created_at,s.revoked_at,a.tournament_slug,a.match_id,t.title event_title,m.round_label,m.match_order FROM hof_staff s LEFT JOIN hof_staff_assignments a ON a.staff_id=s.id LEFT JOIN hof_tournaments t ON t.slug=a.tournament_slug LEFT JOIN hof_matches m ON m.id=a.match_id ORDER BY s.created_at DESC,t.title,m.round_number,m.match_order",args:[]});
   const grouped=new Map<string,any>();
   for(const row of rows.rows){const id=String(row.id);if(!grouped.has(id))grouped.set(id,{id,label:String(row.label),role:String(row.role),title:String(row.title),created_at:String(row.created_at),revoked_at:row.revoked_at?String(row.revoked_at):null,assignments:[]});if(row.tournament_slug)grouped.get(id).assignments.push({tournament_slug:String(row.tournament_slug),match_id:row.match_id?String(row.match_id):null,event_title:row.event_title?String(row.event_title):String(row.tournament_slug),round_label:row.round_label?String(row.round_label):null,match_order:row.match_order==null?null:Number(row.match_order)});}
   staff=[...grouped.values()];
  }
  let reserves:any[]=[];if(slug){const r=await db.execute({sql:"SELECT p.id,p.display_name,p.resonator_icon FROM hof_roster r JOIN hof_participants p ON p.id=r.participant_id WHERE r.tournament_slug=? AND r.state='reserve' ORDER BY r.reserve_order,p.display_name COLLATE NOCASE",args:[slug]});reserves=r.rows;}
  return json({actor:{id:actor.id,role:actor.role,title:actor.title,label:actor.label},events:events.rows,participants:people.rows,audit:auditRows.rows,matches,reserves,staff});
 }catch(e){return failure(e);}
}
export async function POST(request:Request){
 let tx:any;
 try{
  await migrateOnce();const db=database(),actor=await actorFor(request,db),body:any=await readJson(request,2400000);
  if(!body||typeof body!=="object")throw new HttpError(400,"Invalid request.");
  const action=text(body.action,"Action",60),now=new Date().toISOString(),slug=body.slug?text(body.slug,"Tournament",80):null,matchId=body.matchId?text(body.matchId,"Match",80):null;
  if(action==="create_staff"){
   if(actor.role!=="owner"&&actor.role!=="hall_of_fame_admin")throw new HttpError(403,"Only full-access Black Shores titles can issue staff credentials.");
   const label=text(body.label,"Staff name",64),title=text(body.title,"Staff title",32) as WorkspaceTitle;
   if(!["chief_steward","astral_modulator","bloom_bearer","consultant"].includes(title))throw new HttpError(400,"Choose a supported Black Shores title.");
   const role=technicalRoleFor(title as Exclude<WorkspaceTitle,"arbiter">);
   const id=randomUUID(),plain=randomBytes(32).toString("base64url"),hash=tokenDigest(plain).toString("hex");
   await db.execute({sql:"INSERT INTO hof_staff(id,label,role,title,token_hash,created_by,created_at) VALUES(?,?,?,?,?,?,?)",args:[id,label,role,title,hash,actor.id,now]});
   await audit(db,actor,"create_staff",null,{}, {id,label,title});return json({ok:true,id,token:plain,oneTime:true});
  }
  if(action==="remove_staff_assignment"){
   if(actor.role!=="owner"&&actor.role!=="hall_of_fame_admin")throw new HttpError(403,"Only full-access Black Shores titles can change staff assignments.");
   const staffId=text(body.staffId,"Staff",80),eventSlug=text(body.slug,"Tournament",80),targetMatch=body.matchId?text(body.matchId,"Match",80):null;
   const result=targetMatch
    ?await db.execute({sql:"DELETE FROM hof_staff_assignments WHERE staff_id=? AND tournament_slug=? AND match_id=?",args:[staffId,eventSlug,targetMatch]})
    :await db.execute({sql:"DELETE FROM hof_staff_assignments WHERE staff_id=? AND tournament_slug=? AND match_id IS NULL",args:[staffId,eventSlug]});
   if(!result.rowsAffected)throw new HttpError(404,"Staff assignment not found.");
   await audit(db,actor,action,eventSlug,{staffId,matchId:targetMatch},{removed:true});return json({ok:true});
  }
  if(action==="revoke_staff"){
   if(actor.role!=="owner"&&actor.role!=="hall_of_fame_admin")throw new HttpError(403,"Only full-access Black Shores titles can revoke staff credentials.");
   const id=text(body.staffId,"Staff",80);const before=await db.execute({sql:"SELECT id,label,role,revoked_at FROM hof_staff WHERE id=?",args:[id]});
   if(!before.rows.length)throw new HttpError(404,"Staff member not found.");
   await db.execute({sql:"UPDATE hof_staff SET revoked_at=?,revoked_by=? WHERE id=? AND revoked_at IS NULL",args:[now,actor.id,id]});
   await audit(db,actor,"revoke_staff",null,before.rows[0],{revoked:true});return json({ok:true});
  }
  if(action==="assign_staff"){
   if(actor.role!=="owner"&&actor.role!=="hall_of_fame_admin")throw new HttpError(403,"Only full-access Black Shores titles can assign staff.");
   const staffId=text(body.staffId,"Staff",80),eventSlug=text(body.slug,"Tournament",80),targetMatch=body.matchId?text(body.matchId,"Match",80):null;
   const staffRow=await db.execute({sql:"SELECT role,revoked_at FROM hof_staff WHERE id=?",args:[staffId]});if(!staffRow.rows[0]||staffRow.rows[0].revoked_at)throw new HttpError(404,"Active staff member not found.");
   const role=String(staffRow.rows[0].role);if(role==="hall_of_fame_admin")throw new HttpError(400,"Global administrators do not need event assignments.");
   if(targetMatch){const m=await db.execute({sql:"SELECT 1 FROM hof_matches WHERE id=? AND tournament_slug=?",args:[targetMatch,eventSlug]});if(!m.rows.length)throw new HttpError(404,"Match not found for this event.");if(role!=="referee")throw new HttpError(400,"Match-specific assignment is for referees.");}
   await db.execute({sql:"INSERT OR IGNORE INTO hof_staff_assignments(staff_id,tournament_slug,match_id,created_by,created_at) VALUES(?,?,?,?,?)",args:[staffId,eventSlug,targetMatch,actor.id,now]});
   await audit(db,actor,"assign_staff",eventSlug,{}, {staffId,matchId:targetMatch});return json({ok:true});
  }
  if(action==="prepare_bracket"){
   if(!slug)throw new HttpError(400,"Tournament is required.");
   const format=await db.execute({sql:"SELECT format FROM hof_tournaments WHERE slug=?",args:[slug]});const result=String(format.rows[0]?.format)==="double_elimination"?await prepareDoubleElimination(db,slug,actor,now):await prepareSingleElimination(db,slug,actor,now);return json(result);
  }
  if(action==="reveal_bracket"){
   if(!slug)throw new HttpError(400,"Tournament is required.");await requireCan(actor,"manage_event",slug,null,db);
   const event=await db.execute({sql:"SELECT status FROM hof_tournaments WHERE slug=?",args:[slug]});if(!event.rows.length)throw new HttpError(404,"Tournament not found.");
   if(event.rows[0].status!=="bracket_prepared")throw new HttpError(409,"Prepare and review the bracket before revealing it.");
   const count=await db.execute({sql:"SELECT COUNT(*) total FROM hof_matches WHERE tournament_slug=?",args:[slug]});if(!Number(count.rows[0]?.total||0))throw new HttpError(409,"No prepared bracket exists.");
   await db.execute({sql:"UPDATE hof_tournaments SET status='bracket_revealed',bracket_published=1,updated_at=?,version=version+1 WHERE slug=?",args:[now,slug]});
   await audit(db,actor,action,slug,event.rows[0],{status:"bracket_revealed",bracketPublished:true});return json({ok:true});
  }
  if(action==="record_match_result"){
   if(!matchId)throw new HttpError(400,"Match is required.");const m=await db.execute({sql:"SELECT tournament_slug,state,participant_a,participant_b,version FROM hof_matches WHERE id=?",args:[matchId]});if(!m.rows.length)throw new HttpError(404,"Match not found.");
   const eventSlug=String(m.rows[0].tournament_slug);await requireCan(actor,"draft_result",eventSlug,matchId,db);
   if(!["ready","scheduled","in_progress"].includes(String(m.rows[0].state)))throw new HttpError(409,"This match is not ready for a result.");
   const winner=text(body.winnerId,"Winner",80),outcome=text(body.outcome,"Outcome summary",500),expected=Number(body.version);
   if(winner!==m.rows[0].participant_a&&winner!==m.rows[0].participant_b)throw new HttpError(400,"Winner must be one of the two match participants.");
   const write=await db.execute({sql:"UPDATE hof_matches SET winner_id=?,outcome=?,state='pending_publication',version=version+1,updated_at=? WHERE id=? AND version=? AND state IN ('ready','scheduled','in_progress')",args:[winner,outcome,now,matchId,expected]});
   if(!write.rowsAffected)throw new HttpError(409,"Match changed while this result was being entered. Refresh and retry.");
   await audit(db,actor,"record_match_result",eventSlug,m.rows[0],{winnerId:winner,outcome,state:"pending_publication"});return json({ok:true});
  }
  if(action==="publish_match_result"){
   if(!matchId)throw new HttpError(400,"Match is required.");
   const current=await db.execute({sql:"SELECT * FROM hof_matches WHERE id=?",args:[matchId]});
   if(!current.rows.length)throw new HttpError(404,"Match not found.");
   const eventSlug=String(current.rows[0].tournament_slug);await requireCan(actor,"publish_result",eventSlug,matchId,db);
   tx=await db.transaction("write");
   const locked=await tx.execute({sql:"SELECT * FROM hof_matches WHERE id=?",args:[matchId]});
   const match=locked.rows[0];
   if(!match||match.state!=="pending_publication"||!match.winner_id)throw new HttpError(409,"Only a recorded result can be published.");
   const dispute=await tx.execute({sql:"SELECT 1 FROM hof_disputes WHERE match_id=? AND state='open' LIMIT 1",args:[matchId]});
   if(dispute.rows.length)throw new HttpError(409,"Resolve the open dispute before publication.");
   const deps=await tx.execute({sql:"SELECT d.match_id,d.dependency_type,d.target_slot,target.participant_a,target.participant_b,source.match_order source_order FROM hof_match_dependencies d JOIN hof_matches target ON target.id=d.match_id JOIN hof_matches source ON source.id=d.depends_on_match_id WHERE d.depends_on_match_id=? ORDER BY d.match_id",args:[matchId]});
   for(const dep of deps.rows){
    const advancing=dep.dependency_type==="loser"?(match.winner_id===match.participant_a?match.participant_b:match.participant_a):match.winner_id;
    if(!advancing)throw new HttpError(409,"The advancing participant is missing.");
    const slot=dep.target_slot==="participant_a"||dep.target_slot==="participant_b"?String(dep.target_slot):Number(dep.source_order)%2===1?"participant_a":"participant_b";
    const occupied=dep[slot];
    if(occupied&&occupied!==advancing)throw new HttpError(409,"The next match slot is already occupied by another participant.");
    const other=slot==="participant_a"?dep.participant_b:dep.participant_a;
    const nextState=other?"ready":"awaiting_competitors";
    await tx.execute({sql:"UPDATE hof_matches SET "+slot+"=?,state=?,version=version+1,updated_at=? WHERE id=?",args:[advancing,nextState,now,dep.match_id]});
   }
   const published=await tx.execute({sql:"UPDATE hof_matches SET state='published',outcome_published=1,version=version+1,updated_at=? WHERE id=? AND version=? AND state='pending_publication'",args:[now,matchId,match.version]});
   if(!published.rowsAffected)throw new HttpError(409,"Match changed during publication. Refresh and retry.");
   const incomplete=await tx.execute({sql:"SELECT COUNT(*) total FROM hof_matches WHERE tournament_slug=? AND state NOT IN ('published','no_result','cancelled')",args:[eventSlug]});
   const newStatus=Number(incomplete.rows[0]?.total||0)===0?"results_pending":"in_progress";
   await tx.execute({sql:"UPDATE hof_tournaments SET status=?,updated_at=?,version=version+1 WHERE slug=?",args:[newStatus,now,eventSlug]});
   await audit(tx,actor,action,eventSlug,current.rows[0],{state:"published",outcomePublished:true});
   await tx.commit();tx=null;return json({ok:true});
  }
  if(action==="open_dispute"){
   if(!matchId)throw new HttpError(400,"Match is required.");const m=await db.execute({sql:"SELECT tournament_slug,state FROM hof_matches WHERE id=?",args:[matchId]});if(!m.rows.length)throw new HttpError(404,"Match not found.");
   const eventSlug=String(m.rows[0].tournament_slug);await requireCan(actor,"manage_event",eventSlug,matchId,db);if(["published","cancelled"].includes(String(m.rows[0].state)))throw new HttpError(409,"A published match needs an administrator correction workflow.");
   const reason=text(body.reason,"Dispute reason",1500),id=randomUUID();
   await db.execute({sql:"INSERT INTO hof_disputes(id,match_id,opened_by,reason,created_at) VALUES(?,?,?,?,?)",args:[id,matchId,actor.id,reason,now]});
   await db.execute({sql:"UPDATE hof_matches SET state='disputed',version=version+1,updated_at=? WHERE id=?",args:[now,matchId]});await audit(db,actor,action,eventSlug,{}, {matchId,disputeId:id,state:"disputed"});return json({ok:true});
  }
  if(action==="resolve_dispute"){
   if(!matchId)throw new HttpError(400,"Match is required.");if(actor.role!=="owner"&&actor.role!=="hall_of_fame_admin")throw new HttpError(403,"Only an Administrator can resolve a dispute.");
   const rationale=text(body.reason,"Resolution rationale",1500),d=await db.execute({sql:"SELECT id FROM hof_disputes WHERE match_id=? AND state='open'",args:[matchId]});if(!d.rows.length)throw new HttpError(404,"Open dispute not found.");
   const m=await db.execute({sql:"SELECT tournament_slug,winner_id,outcome FROM hof_matches WHERE id=?",args:[matchId]});if(!m.rows.length)throw new HttpError(404,"Match not found.");
   const state=m.rows[0].winner_id?"pending_publication":"ready";
   await db.execute({sql:"UPDATE hof_disputes SET state='resolved',resolution=?,resolved_by=?,resolved_at=? WHERE match_id=? AND state='open'",args:[rationale,actor.id,now,matchId]});
   await db.execute({sql:"UPDATE hof_matches SET state=?,version=version+1,updated_at=? WHERE id=?",args:[state,now,matchId]});
   await audit(db,actor,action,String(m.rows[0].tournament_slug),{}, {state:"resolved",resolution:rationale});return json({ok:true});
  }
  if(action==="archive"){
   if(!slug)throw new HttpError(400,"Tournament is required.");if(actor.role!=="owner"&&actor.role!=="hall_of_fame_admin")throw new HttpError(403,"Only an Administrator can archive events.");
   const event=await db.execute({sql:"SELECT status,medals_published FROM hof_tournaments WHERE slug=?",args:[slug]});if(!event.rows.length)throw new HttpError(404,"Tournament not found.");
   if(event.rows[0].status!=="finalized"||!event.rows[0].medals_published)throw new HttpError(409,"Publish final medals before archiving.");
   await db.execute({sql:"UPDATE hof_tournaments SET status='archived',updated_at=?,version=version+1 WHERE slug=?",args:[now,slug]});await audit(db,actor,action,slug,event.rows[0],{status:"archived"},text(body.reason,"Archive reason",500));return json({ok:true});
  }
  if(action==="import_historical_tournament"){
   await requireCan(actor,"global_admin",null,null,db);
   const eventSlug=(String(body.slug||"archive-"+randomUUID().slice(0,8))).toLowerCase();
   if(!slugPattern.test(eventSlug))throw new HttpError(400,"Generated event identifier is invalid.");
   const title=text(body.title,"Title",120),boss=text(body.boss,"Hologram boss",80),rules=String(body.rules||"").slice(0,10000),notice=String(body.publicNotice||"").slice(0,2000);
   const eventDate=body.eventDate?text(body.eventDate,"Event date",50):null,artwork=String(body.artworkDataUrl||"");
   if(!/^data:image\/(png|jpeg|webp);base64,/.test(artwork)||artwork.length>2100000)throw new HttpError(400,"Upload a tournament image under 1.5 MB (PNG, JPG, or WebP).");
   if(eventDate&&Number.isNaN(Date.parse(eventDate)))throw new HttpError(400,"Enter a valid historical event date.");
   if(!Array.isArray(body.participants)||body.participants.length<3||body.participants.length>256)throw new HttpError(400,"Add at least three archived participants from the directory.");
   const entrants=[] as any[],ids=new Set<string>(),medals=new Set<string>();
   for(const [index,entry] of body.participants.entries()){
    const participantId=text(entry?.participantId,"Participant "+(index+1),80),medal=String(entry?.medal||"").toLowerCase();
    if(medal&&!["gold","silver","bronze"].includes(medal))throw new HttpError(400,"Use Champion, 2nd place, or 3rd place.");
    if(medal&&medals.has(medal))throw new HttpError(400,"Each podium place can be assigned once.");
    const row=await db.execute({sql:"SELECT id FROM hof_participants WHERE id=?",args:[participantId]});
    if(!row.rows.length)throw new HttpError(404,"A selected participant no longer exists.");
    if(ids.has(participantId))throw new HttpError(400,"A participant can only be listed once.");
    ids.add(participantId);if(medal)medals.add(medal);entrants.push({participantId,medal});
   }
   if(medals.size!==3)throw new HttpError(400,"Assign Champion, 2nd place, and 3rd place before importing.");
   const capacityMax=Math.max(2,entrants.length);tx=await db.transaction("write");
   await tx.execute({sql:"INSERT INTO hof_tournaments(slug,title,boss,format,status,capacity_min,capacity_max,registration_deadline,timezone,rules,public_notice,event_date,roster_published,bracket_published,medals_published,artwork_data_url,tournament_kind,bracket_mode,created_at,updated_at) VALUES(?,?,?,'single_elimination','archived',2,?,NULL,'UTC',?,?,?,1,0,1,?,'hologram','single_elimination',?,?)",args:[eventSlug,title,boss,capacityMax,rules,notice,eventDate,artwork,now,now]});
   for(const entrant of entrants){await tx.execute({sql:"INSERT INTO hof_roster(tournament_slug,participant_id,state,published,updated_at) VALUES(?,?,'confirmed',1,?)",args:[eventSlug,entrant.participantId,now]});if(entrant.medal)await tx.execute({sql:"INSERT INTO hof_medals(tournament_slug,medal,participant_id,published,published_by,published_at) VALUES(?,?,?,1,?,?)",args:[eventSlug,entrant.medal,entrant.participantId,actor.id,now]});}
   await audit(tx,actor,action,eventSlug,{}, {status:"archived",historical:true,participants:entrants.length,medals:medals.size});await tx.commit();tx=null;return json({ok:true,participants:entrants.length,medals:medals.size,slug:eventSlug});
  }
  if(action==="create_tournament"){
   await requireCan(actor,"global_admin",null,null,db);
   const title=text(body.title,"Title",120),boss=text(body.boss,"Hologram boss",80),format=body.format==="double_elimination"?"double_elimination":"single_elimination";
   const base=title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,54)||"hologram-event",eventSlug=base+"-"+randomUUID().slice(0,8);
   const min=Math.max(2,Math.min(256,Number(body.capacityMin)||2)),max=Math.max(min,Math.min(256,Number(body.capacityMax)||32)),rules=String(body.rules||"").slice(0,10000),notice=String(body.publicNotice||"").slice(0,2000),eventDate=body.eventDate?text(body.eventDate,"Event date",50):null,artwork=String(body.artworkDataUrl||"");
   if(!/^data:image\/(png|jpeg|webp);base64,/.test(artwork)||artwork.length>2100000)throw new HttpError(400,"Upload a tournament image under 1.5 MB (PNG, JPG, or WebP).");
   if(eventDate&&Number.isNaN(Date.parse(eventDate)))throw new HttpError(400,"Enter a valid event date.");
   await db.execute({sql:"INSERT INTO hof_tournaments(slug,title,boss,format,status,capacity_min,capacity_max,registration_deadline,timezone,rules,public_notice,event_date,artwork_data_url,tournament_kind,bracket_mode,created_at,updated_at) VALUES(?,?,?,?,'draft',?,?,NULL,'UTC',?,?,?,?, 'hologram',?,?,?)",args:[eventSlug,title,boss,format,min,max,rules,notice,eventDate,artwork,format,now,now]});
   await audit(db,actor,action,eventSlug,{}, {title,boss,format,status:"draft"});return json({ok:true,slug:eventSlug});
  }
  if(action==="set_status"){
   if(!slug)throw new HttpError(400,"Tournament is required.");await requireCan(actor,"manage_event",slug,null,db);
   const status=text(body.status,"Status",40);if(!statuses.includes(status))throw new HttpError(400,"Unsupported tournament status.");
   if(["suspended","cancelled","archived","finalized"].includes(status)&&actor.role!=="owner"&&actor.role!=="hall_of_fame_admin")throw new HttpError(403,"Only an Administrator may use this lifecycle state.");
   const old=await db.execute({sql:"SELECT status FROM hof_tournaments WHERE slug=?",args:[slug]});if(!old.rows.length)throw new HttpError(404,"Tournament not found.");
   const allowed:Record<string,string[]>={draft:["announced","cancelled"],announced:["registration_open","cancelled","suspended"],registration_open:["registration_closed","cancelled","suspended"],registration_closed:["registration_open","bracket_prepared","cancelled","suspended"],bracket_prepared:["bracket_revealed","registration_closed","cancelled","suspended"],bracket_revealed:["in_progress","cancelled","suspended"],in_progress:["results_pending","cancelled","suspended"],results_pending:["in_progress","finalized","suspended"],finalized:["archived"],archived:[],suspended:["announced","registration_open","registration_closed","bracket_revealed","in_progress","results_pending","cancelled"],cancelled:[]};
   if(!allowed[String(old.rows[0].status)]?.includes(status))throw new HttpError(409,"That lifecycle transition is not allowed.");
   await db.execute({sql:"UPDATE hof_tournaments SET status=?,updated_at=?,version=version+1 WHERE slug=?",args:[status,now,slug]});await audit(db,actor,action,slug,old.rows[0],{status},String(body.reason||"").slice(0,500));return json({ok:true});
  }
  if(action==="add_participant"){
   await requireCan(actor,"global_admin",null,null,db);
   const id=randomUUID(),name=text(body.name,"Participant display name",40),resonator=text(body.resonator,"Resonator",64);
   if(!featuredResonators.some(r=>r.name.toLowerCase()===resonator.toLowerCase()))throw new HttpError(400,"Choose a supported Resonator.");
   const icon=featuredResonators.find(r=>r.name.toLowerCase()===resonator.toLowerCase())!.name;
   await db.execute({sql:"INSERT INTO hof_participants(id,display_name,resonator_icon,created_at,updated_at) VALUES(?,?,?,?,?)",args:[id,name,icon,now,now]});await audit(db,actor,action,null,{}, {id,name,resonatorIcon:icon});return json({ok:true,id});
  }
  if(action==="substitute_reserve"){
   if(!matchId)throw new HttpError(400,"Match is required.");
   const current=await db.execute({sql:"SELECT tournament_slug,state,participant_a,participant_b FROM hof_matches WHERE id=?",args:[matchId]});
   if(!current.rows.length)throw new HttpError(404,"Match not found.");
   const eventSlug=String(current.rows[0].tournament_slug);await requireCan(actor,"manage_event",eventSlug,matchId,db);
   if(!["ready","scheduled"].includes(String(current.rows[0].state)))throw new HttpError(409,"Reserve substitutions close once a match starts.");
   const participantId=text(body.participantId,"Reserve participant",80),slot=body.slot==="b"?"participant_b":"participant_a";
   const prior=String(current.rows[0][slot]||"");if(!prior)throw new HttpError(409,"That match slot is empty.");
   const reserve=await db.execute({sql:"SELECT state FROM hof_roster WHERE tournament_slug=? AND participant_id=?",args:[eventSlug,participantId]});
   if(reserve.rows[0]?.state!=="reserve")throw new HttpError(409,"Choose someone on this tournament's reserve list.");
   await db.execute({sql:"UPDATE hof_matches SET "+slot+"=?,version=version+1,updated_at=? WHERE id=?",args:[participantId,now,matchId]});
   await db.execute({sql:"UPDATE hof_roster SET state='withdrawn',reserve_reason='Replaced from bracket slot',updated_at=? WHERE tournament_slug=? AND participant_id=?",args:[now,eventSlug,prior]});
   await db.execute({sql:"UPDATE hof_roster SET state='confirmed',published=1,updated_at=? WHERE tournament_slug=? AND participant_id=?",args:[now,eventSlug,participantId]});
   await audit(db,actor,"substitute_reserve",eventSlug,{matchId,slot,participantId:prior},{matchId,slot,participantId,priorParticipantId:prior});
   return json({ok:true});
  }
  if(action==="edit_participant"){
   await requireCan(actor,"global_admin",null,null,db);
   const id=text(body.id,"Participant ID",80),name=text(body.name,"Participant display name",40),resonator=text(body.resonator,"Resonator",64);
   if(!featuredResonators.some(r=>r.name.toLowerCase()===resonator.toLowerCase()))throw new HttpError(400,"Choose a supported Resonator.");
   const icon=featuredResonators.find(r=>r.name.toLowerCase()===resonator.toLowerCase())!.name;
   const old=await db.execute({sql:"SELECT display_name,resonator_icon FROM hof_participants WHERE id=?",args:[id]});if(!old.rows.length)throw new HttpError(404,"Participant not found.");
   await db.execute({sql:"UPDATE hof_participants SET display_name=?,resonator_icon=?,updated_at=? WHERE id=?",args:[name,icon,now,id]});
   await audit(db,actor,action,null,old.rows[0],{id,name,resonatorIcon:icon});return json({ok:true});
  }
  if(action==="add_roster"){
   if(!slug)throw new HttpError(400,"Tournament is required.");await requireCan(actor,"manage_event",slug,null,db);
   const participantId=text(body.participantId,"Participant",80),event=await db.execute({sql:"SELECT status,capacity_max FROM hof_tournaments WHERE slug=?",args:[slug]});if(!event.rows.length)throw new HttpError(404,"Tournament not found.");
   if(!["registration_open","registration_closed","draft"].includes(String(event.rows[0].status)))throw new HttpError(409,"Roster edits are closed for this event state.");
   const count=await db.execute({sql:"SELECT COUNT(*) total FROM hof_roster WHERE tournament_slug=? AND state='confirmed'",args:[slug]});if(Number(count.rows[0]?.total||0)>=Number(event.rows[0].capacity_max))throw new HttpError(409,"Tournament capacity has been reached.");
   const participant=await db.execute({sql:"SELECT id FROM hof_participants WHERE id=?",args:[participantId]});if(!participant.rows.length)throw new HttpError(404,"Participant not found.");
   await db.execute({sql:"INSERT INTO hof_roster(tournament_slug,participant_id,state,published,updated_at) VALUES(?,?,?,0,?) ON CONFLICT(tournament_slug,participant_id) DO UPDATE SET state=excluded.state,published=0,updated_at=excluded.updated_at",args:[slug,participantId,body.reserve?"reserve":"confirmed",now]});
   await db.execute({sql:"INSERT INTO hof_registrations(id,tournament_slug,participant_id,reaction_message_ref,reaction_at,verified_by,verified_at,state) VALUES(?,?,?,?,?,?,?,'confirmed') ON CONFLICT(tournament_slug,participant_id) DO UPDATE SET state='confirmed',verified_by=excluded.verified_by,verified_at=excluded.verified_at",args:[randomUUID(),slug,participantId,String(body.reactionRef||"manual-admin").slice(0,120),now,actor.id,now]});
   await audit(db,actor,action,slug,{}, {participantId,state:body.reserve?"reserve":"confirmed"});return json({ok:true});
  }
  if(action==="publish_roster"){
   if(!slug)throw new HttpError(400,"Tournament is required.");await requireCan(actor,"manage_event",slug,null,db);
   const result=await db.execute({sql:"UPDATE hof_roster SET published=1,updated_at=? WHERE tournament_slug=? AND state='confirmed'",args:[now,slug]});if(!result.rowsAffected)throw new HttpError(409,"No confirmed participants to publish.");
   await db.execute({sql:"UPDATE hof_tournaments SET roster_published=1,updated_at=?,version=version+1 WHERE slug=?",args:[now,slug]});await audit(db,actor,action,slug,{}, {published:true});return json({ok:true});
  }
  if(action==="set_medal"){
   if(!slug)throw new HttpError(400,"Tournament is required.");await requireCan(actor,"global_admin",null,null,db);
   const medal=text(body.medal,"Medal",12),participantId=text(body.participantId,"Participant",80);if(!["gold","silver","bronze"].includes(medal))throw new HttpError(400,"Unsupported medal.");
   const valid=await db.execute({sql:"SELECT 1 FROM hof_roster WHERE tournament_slug=? AND participant_id=? AND state='confirmed'",args:[slug,participantId]});if(!valid.rows.length)throw new HttpError(409,"Medal recipient must be a confirmed participant.");
   await db.execute({sql:"INSERT INTO hof_medals(tournament_slug,medal,participant_id,published,published_by,published_at) VALUES(?,?,?,0,NULL,NULL) ON CONFLICT(tournament_slug,medal) DO UPDATE SET participant_id=excluded.participant_id,published=0,published_by=NULL,published_at=NULL",args:[slug,medal,participantId]});
   await audit(db,actor,action,slug,{}, {medal,participantId,published:false});return json({ok:true});
  }
  if(action==="publish_medals"){
   if(!slug)throw new HttpError(400,"Tournament is required.");await requireCan(actor,"global_admin",null,null,db);
   const medals=await db.execute({sql:"SELECT medal,participant_id FROM hof_medals WHERE tournament_slug=?",args:[slug]});
   if(medals.rows.length!==3||new Set(medals.rows.map((r:any)=>r.medal)).size!==3||new Set(medals.rows.map((r:any)=>r.participant_id)).size!==3)throw new HttpError(409,"Exactly three different participants must be set as Gold, Silver, and Bronze.");
   const incomplete=await db.execute({sql:"SELECT COUNT(*) total FROM hof_matches WHERE tournament_slug=? AND state NOT IN ('published','no_result','cancelled')",args:[slug]});if(Number(incomplete.rows[0]?.total||0))throw new HttpError(409,"Finish or resolve all bracket matches before medal publication.");
   const disputes=await db.execute({sql:"SELECT COUNT(*) total FROM hof_disputes d JOIN hof_matches m ON m.id=d.match_id WHERE m.tournament_slug=? AND d.state='open'",args:[slug]});if(Number(disputes.rows[0]?.total||0))throw new HttpError(409,"Resolve all disputes before medal publication.");
   await db.execute({sql:"UPDATE hof_medals SET published=1,published_by=?,published_at=? WHERE tournament_slug=?",args:[actor.id,now,slug]});
   await db.execute({sql:"UPDATE hof_tournaments SET medals_published=1,status='finalized',updated_at=?,version=version+1 WHERE slug=?",args:[now,slug]});await audit(db,actor,action,slug,{}, {published:true});return json({ok:true});
  }
  if(action==="add_announcement"){
   if(!slug)throw new HttpError(400,"Tournament is required.");const category=["general","pinned","critical"].includes(body.category)?body.category:"general";
   await requireCan(actor,category==="critical"?"global_admin":"manage_event",category==="critical"?null:slug,null,db);
   if(category==="pinned"){const count=await db.execute({sql:"SELECT COUNT(*) total FROM hof_announcements WHERE tournament_slug=? AND category='pinned' AND published=1 AND retracted_at IS NULL",args:[slug]});if(Number(count.rows[0]?.total||0)>=3)throw new HttpError(409,"Only three active pinned announcements are allowed.");}
   const title=text(body.title,"Announcement title",140),message=text(body.body,"Announcement text",4000),id=randomUUID(),publish=Boolean(body.publish);
   await db.execute({sql:"INSERT INTO hof_announcements(id,tournament_slug,category,title,body,published,published_by,published_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",args:[id,slug,category,title,message,publish?1:0,publish?actor.id:null,publish?now:null,now]});await audit(db,actor,action,slug,{}, {id,title,published:publish});return json({ok:true});
  }
  throw new HttpError(400,"Unknown Hall of Fame action.");
 }catch(e){if(tx)await tx.rollback();return failure(e);}
}
