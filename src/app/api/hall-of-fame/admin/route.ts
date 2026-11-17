import {technicalRoleFor,type WorkspaceTitle} from "@/lib/server/workspace-auth";
import {createHash,randomBytes,randomInt,timingSafeEqual,randomUUID} from "node:crypto";
import {database,migrateOnce} from "@/lib/server/database";
import {failure,json,readJson} from "@/lib/server/http";
import {HttpError} from "@/lib/server/validation";
import {isFeatureEnabled} from "@/lib/server/feature-flags.mjs";
import {draftOrder,initialMatchPhaseState,validateDraftStep} from "@/lib/server/hof-match-foundation.mjs";
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
async function cascadeDoubleForfeitByes(tx:any,actor:Actor,slug:string,sourceMatchId:string,now:string,depth=0):Promise<void>{
 if(depth>=32)return;
 const source=(await tx.execute({sql:"SELECT state FROM hof_matches WHERE id=? AND tournament_slug=?",args:[sourceMatchId,slug]})).rows[0];if(!source)return;
 const dependents=await tx.execute({sql:"SELECT DISTINCT match_id FROM hof_match_dependencies WHERE depends_on_match_id=? AND (?<>'no_result' OR dependency_type='winner')",args:[sourceMatchId,source.state]});
 for(const edge of dependents.rows){
  const targetId=String(edge.match_id),target=(await tx.execute({sql:"SELECT participant_a,participant_b,state FROM hof_matches WHERE id=? AND tournament_slug=?",args:[targetId,slug]})).rows[0];if(!target||target.state==="published"||target.state==="no_result")continue;
  const a=target.participant_a?String(target.participant_a):"",b=target.participant_b?String(target.participant_b):"";if(Boolean(a)===Boolean(b))continue;
  const blocked=(await tx.execute({sql:"SELECT 1 FROM hof_match_dependencies d JOIN hof_matches source ON source.id=d.depends_on_match_id WHERE d.match_id=? AND ((d.dependency_type='winner' AND source.state='forfeited') OR (d.dependency_type='loser' AND source.state='forfeited')) LIMIT 1",args:[targetId]})).rows.length>0;if(!blocked)continue;
  const winner=a||b;await tx.execute({sql:"UPDATE hof_matches SET state='no_result',phase_state='complete',winner_id=?,outcome='Bye after a double forfeit',outcome_published=1,version=version+1,updated_at=? WHERE id=?",args:[winner,now,targetId]});
  await audit(tx,actor,"double_forfeit_bye",slug,{matchId:targetId,participantA:a||null,participantB:b||null},{winnerId:winner,state:"no_result",reason:"Bye after a double forfeit"});
  await cascadeDoubleForfeitByes(tx,actor,slug,targetId,now,depth+1);
 }
}
async function addMatch(tx:any,slug:string,round:number,label:string,order:number,side:string,left:any,right:any,now:string,bracketPosition=-1){
 const leftId=left?.kind==="player"?left.id:null,rightId=right?.kind==="player"?right.id:null;
 const state=leftId&&rightId?"ready":"awaiting_competitors",phaseState=initialMatchPhaseState({participantA:leftId,participantB:rightId}),id=randomUUID();
 await tx.execute({sql:"INSERT INTO hof_matches(id,tournament_slug,round_number,round_label,match_order,bracket_side,participant_a,participant_b,state,bracket_position,phase_state,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",args:[id,slug,round,label,order,side,leftId,rightId,state,bracketPosition,phaseState,now]});
 if(left?.kind==="match")await tx.execute({sql:"INSERT INTO hof_match_dependencies(match_id,depends_on_match_id,dependency_type,target_slot) VALUES(?,?,'winner','participant_a')",args:[id,left.id]});
 if(right?.kind==="match")await tx.execute({sql:"INSERT INTO hof_match_dependencies(match_id,depends_on_match_id,dependency_type,target_slot) VALUES(?,?,'winner','participant_b')",args:[id,right.id]});
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
  const byeCount=size-entrants.length,byeEntrants=entrants.slice(0,byeCount),remaining=entrants.slice(byeCount);
  const roundOneMatchCount=size/2-byeCount,roundOneGroupCount=size/4;
  let nodes:any[]=[],byeIndex=0,roundOneIndex=0;
  for(let group=0;group<roundOneGroupCount;group++){
   const leftIsBye=byeIndex<byeEntrants.length;
   let left:any;
   if(leftIsBye)left={kind:"player",id:byeEntrants[byeIndex++]};
   else{const entrantIndex=roundOneIndex*2;left=await addMatch(tx,slug,1,"Round 1",++roundOneIndex,"main",{kind:"player",id:remaining[entrantIndex]},{kind:"player",id:remaining[entrantIndex+1]},now,group*2);}
   let right:any;
   if(roundOneIndex<roundOneMatchCount){const entrantIndex=roundOneIndex*2;right=await addMatch(tx,slug,1,"Round 1",++roundOneIndex,"main",{kind:"player",id:remaining[entrantIndex]},{kind:"player",id:remaining[entrantIndex+1]},now,group*2+1);}
   else right={kind:"player",id:byeEntrants[byeIndex++]};
   nodes.push(left,right);
  }
  const height=Math.log2(size);let round=2,order=0;
  while(nodes.length>1){
   const next:any[]=[];order=0;
   for(let i=0;i<nodes.length;i+=2){
    const left=nodes[i]||null,right=nodes[i+1]||null;
    if(!left||!right){next.push(left||right);continue}
    const label=round===height?"Final":"Round "+round;
    next.push(await addMatch(tx,slug,round,label,++order,"main",left,right,now,order-1));
   }
   nodes=next;round++;
  }
  const final=nodes[0],bronzeMatchIds:string[]=[];
  if(entrants.length>=4&&final?.kind==="match"&&final.left?.kind==="match"&&final.right?.kind==="match"){
   const bronzeId=randomUUID();
   await tx.execute({sql:"INSERT INTO hof_matches(id,tournament_slug,round_number,round_label,match_order,bracket_side,participant_a,participant_b,state,bracket_position,updated_at) VALUES(?,?,?,?,?,'third_place',NULL,NULL,'awaiting_competitors',0,?)",args:[bronzeId,slug,height,"Third-place match",1,now]});
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
  let eventSql="SELECT slug,title,boss,headline_boss,bans_per_player,status,format,event_date,rules,public_notice,capacity_min,capacity_max,roster_published,bracket_published,medals_published,CASE WHEN artwork_data_url='' THEN 0 ELSE 1 END has_artwork,tournament_kind,bracket_mode FROM hof_tournaments WHERE soft_deleted_at IS NULL ORDER BY updated_at DESC",eventArgs:any[]=[];
  if(actor.role==="organizer"||actor.role==="referee"){eventSql="SELECT DISTINCT t.slug,t.title,t.boss,t.headline_boss,t.bans_per_player,t.status,t.format,t.event_date,t.rules,t.public_notice,t.capacity_min,t.capacity_max,t.roster_published,t.bracket_published,t.medals_published,CASE WHEN t.artwork_data_url='' THEN 0 ELSE 1 END has_artwork,t.tournament_kind,t.bracket_mode FROM hof_tournaments t JOIN hof_staff_assignments a ON a.tournament_slug=t.slug WHERE a.staff_id=? AND t.soft_deleted_at IS NULL ORDER BY t.updated_at DESC";eventArgs=[actor.id]}
  const events=await db.execute({sql:eventSql,args:eventArgs});
  const deletedEvents=(actor.role==="owner"||actor.role==="hall_of_fame_admin")?await db.execute({sql:"SELECT slug,title,status,soft_deleted_at FROM hof_tournaments WHERE soft_deleted_at IS NOT NULL ORDER BY soft_deleted_at DESC",args:[]}):{rows:[]};
  const people=await db.execute("SELECT id,display_name,resonator_icon FROM hof_participants ORDER BY display_name COLLATE NOCASE LIMIT 300");
  const auditRows=await db.execute({sql:"SELECT action,actor_role,reason,outcome,created_at,tournament_slug FROM hof_audit_events "+((actor.role==="owner"||actor.role==="hall_of_fame_admin")?"":"WHERE tournament_slug IN (SELECT tournament_slug FROM hof_staff_assignments WHERE staff_id=?) ")+"ORDER BY created_at DESC LIMIT 30",args:(actor.role==="owner"||actor.role==="hall_of_fame_admin")?[]:[actor.id]});
  let matches:any[]=[];
  if(slug){
   const mayManage=await can(actor,"manage_event",slug,null,db);
   if(mayManage){
    const result=await db.execute({sql:"SELECT m.id,m.round_number,m.round_label,m.match_order,m.bracket_position,m.bracket_side,m.state,m.phase_state,m.match_boss,m.boss_method,m.clear_time_seconds,m.staff_note,m.hold_note,m.started_without_details,m.participant_a,m.participant_b,m.winner_id,m.outcome,m.version,a.display_name name_a,b.display_name name_b FROM hof_matches m LEFT JOIN hof_participants a ON a.id=m.participant_a LEFT JOIN hof_participants b ON b.id=m.participant_b WHERE m.tournament_slug=? ORDER BY m.round_number,m.match_order,m.bracket_side",args:[slug]});
    matches=result.rows;
   }else if(actor.role==="referee"){
    const assigned=await db.execute({sql:"SELECT match_id FROM hof_staff_assignments WHERE staff_id=? AND tournament_slug=? AND match_id IS NOT NULL",args:[actor.id,slug]});
    const allowed=new Set(assigned.rows.map((row:any)=>String(row.match_id)));
    const result=await db.execute({sql:"SELECT m.id,m.round_number,m.round_label,m.match_order,m.bracket_position,m.bracket_side,m.state,m.phase_state,m.match_boss,m.boss_method,m.clear_time_seconds,m.staff_note,m.hold_note,m.started_without_details,m.participant_a,m.participant_b,m.winner_id,m.outcome,m.version,a.display_name name_a,b.display_name name_b FROM hof_matches m LEFT JOIN hof_participants a ON a.id=m.participant_a LEFT JOIN hof_participants b ON b.id=m.participant_b WHERE m.tournament_slug=? ORDER BY m.round_number,m.match_order,m.bracket_side",args:[slug]});
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
  if(matches.length&&slug){
   const dependencyRows=await db.execute({sql:"SELECT d.match_id,d.depends_on_match_id,d.dependency_type,d.target_slot FROM hof_match_dependencies d JOIN hof_matches m ON m.id=d.match_id WHERE m.tournament_slug=?",args:[slug]});
   const dependencyMap=new Map<string,{dependsOnMatchId:string;dependencyType:string;targetSlot:string}[]>();
   for(const edge of dependencyRows.rows){const key=String(edge.match_id),items=dependencyMap.get(key)||[];items.push({dependsOnMatchId:String(edge.depends_on_match_id),dependencyType:String(edge.dependency_type),targetSlot:String(edge.target_slot||"")});dependencyMap.set(key,items);}
   matches=matches.map((match:any)=>({...match,dependencies:(dependencyMap.get(String(match.id))||[]).filter(edge=>matches.some((candidate:any)=>String(candidate.id)===edge.dependsOnMatchId))}));
  }
  let roster:any[]=[];if(slug&&await can(actor,"manage_event",slug,null,db)){const r=await db.execute({sql:"SELECT p.id,p.display_name,p.resonator_icon,r.state,r.published,r.seed_position,r.reserve_order FROM hof_roster r JOIN hof_participants p ON p.id=r.participant_id WHERE r.tournament_slug=? ORDER BY CASE r.state WHEN 'confirmed' THEN 0 WHEN 'reserve' THEN 1 ELSE 2 END,COALESCE(r.seed_position,r.reserve_order,9999),p.display_name COLLATE NOCASE",args:[slug]});roster=r.rows;}
  const reserves=roster.filter((row:any)=>row.state==="reserve");
  const bossCatalog=await db.execute({sql:"SELECT name,icon_url FROM hof_boss_catalog WHERE enabled=1 ORDER BY name COLLATE NOCASE",args:[]});
  let bossPool:any[]=[],draftSteps:any[]=[];
  if(slug&&await can(actor,"manage_event",slug,null,db)){const pool=await db.execute({sql:"SELECT b.boss_name name,c.icon_url,b.pool_order FROM hof_tournament_bosses b JOIN hof_boss_catalog c ON c.name=b.boss_name WHERE b.tournament_slug=? AND c.enabled=1 ORDER BY b.pool_order",args:[slug]});bossPool=pool.rows;}
  const requestedMatchId=url.searchParams.get("matchId");
  if(requestedMatchId&&slug&&await can(actor,"draft_result",slug,requestedMatchId,db)){const steps=await db.execute({sql:"SELECT step_number,actor_slot,action,resonator,created_by,created_at FROM hof_draft_steps WHERE match_id=? ORDER BY step_number",args:[requestedMatchId]});draftSteps=steps.rows;}
  const phase3SafetyEnabled=await isFeatureEnabled("hof-phase-3-safety",db);
  const matchFlowEnabled=await isFeatureEnabled("hof-match-flow",db),matchFoundationEnabled=await isFeatureEnabled("hof-match-foundation",db);
  const publicMatchViewEnabled=await isFeatureEnabled("hof-public-match-view",db);
  const roundBlocks=slug&&await can(actor,"manage_event",slug,null,db)?(await db.execute({sql:"SELECT round_number,round_label,COUNT(*) total,SUM(CASE WHEN phase_state='complete' OR state IN ('forfeited','no_result','cancelled') THEN 1 ELSE 0 END) resolved,SUM(CASE WHEN phase_state='complete' AND state NOT IN ('forfeited','no_result','cancelled') THEN 1 ELSE 0 END) completed,SUM(CASE WHEN state='forfeited' THEN 1 ELSE 0 END) forfeited FROM hof_matches WHERE tournament_slug=? GROUP BY round_number,round_label ORDER BY round_number",args:[slug]})).rows:[];
  return json({actor:{id:actor.id,role:actor.role,title:actor.title,label:actor.label},phase3SafetyEnabled,matchFlowEnabled,matchFoundationEnabled,publicMatchViewEnabled,roundBlocks,events:events.rows,deletedEvents:deletedEvents.rows,participants:people.rows,audit:auditRows.rows,matches,reserves,roster,staff,bossCatalog:bossCatalog.rows,bossPool,draftSteps});
 }catch(e){return failure(e);}
}
export async function POST(request:Request){
 let tx:any;
 try{
  await migrateOnce();const db=database(),actor=await actorFor(request,db),body:any=await readJson(request,2400000);
  if(!body||typeof body!=="object")throw new HttpError(400,"Invalid request.");
  const action=text(body.action,"Action",60),now=new Date().toISOString(),slug=body.slug?text(body.slug,"Tournament",80):null,matchId=body.matchId?text(body.matchId,"Match",80):null;
  if(action==="set_hof_match_foundation_enabled"){
   if(actor.role!=="owner"&&actor.role!=="hall_of_fame_admin")throw new HttpError(403,"Only an Administrator can change Hall of Fame match-foundation settings.");
   const before=await isFeatureEnabled("hof-match-foundation",db),enabled=Boolean(body.enabled);
   if(!enabled&&await isFeatureEnabled("hof-match-flow",db))throw new HttpError(409,"Disable Phase 4 match flow before disabling its Phase 1 foundation.");
   await db.execute({sql:"INSERT INTO app_settings(key,value,updated_at) VALUES('feature:hof-match-foundation',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",args:[enabled?"true":"false",now]});
   await audit(db,actor,"match_foundation_flag",null,{enabled:before},{enabled});return json({ok:true,enabled});
  }
  if(action==="set_hof_match_flow_enabled"){
   if(actor.role!=="owner"&&actor.role!=="hall_of_fame_admin")throw new HttpError(403,"Only an Administrator can change Hall of Fame match-flow settings.");
   const before=await isFeatureEnabled("hof-match-flow",db),enabled=Boolean(body.enabled);if(enabled&&!(await isFeatureEnabled("hof-match-foundation",db)))throw new HttpError(409,"Enable the Phase 1 match foundation before Phase 4.");if(enabled&&!(await isFeatureEnabled("hof-phase-3-safety",db)))throw new HttpError(409,"Enable Phase 3 safety tools before Phase 4.");if(!enabled&&await isFeatureEnabled("hof-public-match-view",db))throw new HttpError(409,"Disable Phase 5 public match details before disabling Phase 4.");
   await db.execute({sql:"INSERT INTO app_settings(key,value,updated_at) VALUES('feature:hof-match-flow',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",args:[enabled?"true":"false",now]});
   await audit(db,actor,"match_flow_flag",null,{enabled:before},{enabled});return json({ok:true,enabled});
  }
  if(action==="set_hof_public_match_view_enabled"){
   if(actor.role!=="owner"&&actor.role!=="hall_of_fame_admin")throw new HttpError(403,"Only an Administrator can change the public Hall of Fame match view.");
   const before=await isFeatureEnabled("hof-public-match-view",db),enabled=Boolean(body.enabled);
   if(enabled&&!(await isFeatureEnabled("hof-match-flow",db)))throw new HttpError(409,"Enable Phase 4 match flow before Phase 5 public match details.");
   await db.execute({sql:"INSERT INTO app_settings(key,value,updated_at) VALUES('feature:hof-public-match-view',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",args:[enabled?"true":"false",now]});
   await audit(db,actor,"public_match_view_flag",null,{enabled:before},{enabled});return json({ok:true,enabled});
  }
  if(action==="set_hof_safety_enabled"){
   if(actor.role!=="owner"&&actor.role!=="hall_of_fame_admin")throw new HttpError(403,"Only an Administrator can change Hall of Fame safety features.");
   const before=await isFeatureEnabled("hof-phase-3-safety",db),enabled=Boolean(body.enabled);
   await db.execute({sql:"INSERT INTO app_settings(key,value,updated_at) VALUES('feature:hof-phase-3-safety',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",args:[enabled?"true":"false",now]});
   await audit(db,actor,"phase3_safety_flag",null,{enabled:before},{enabled});return json({ok:true,enabled});
  }
  const phase3Actions=new Set(["edit_completed_match","edit_completed_setup","publish_podium"]);
  if(phase3Actions.has(action)&&!(await isFeatureEnabled("hof-phase-3-safety",db)))throw new HttpError(404,"Hall of Fame safety features are not enabled.");
  if(action==="edit_completed_match"){
   if(!matchId)throw new HttpError(400,"Match is required.");
   const reason=String(body.reason||"").trim().slice(0,1000),winner=text(body.winnerId,"Winner",80),outcome=text(body.outcome,"Outcome summary",500),expected=Number(body.version);
   tx=await db.transaction("write");
   const match=(await tx.execute({sql:"SELECT * FROM hof_matches WHERE id=?",args:[matchId]})).rows[0];if(!match)throw new HttpError(404,"Match not found.");
   const eventSlug=String(match.tournament_slug);await requireCan(actor,"manage_event",eventSlug,matchId,db);
   if(![match.participant_a,match.participant_b].includes(winner))throw new HttpError(400,"Winner must be one of the two match participants.");
   if(!["complete","result_recorded","published","pending_publication"].includes(String(match.phase_state))&&!match.winner_id)throw new HttpError(409,"Only a match with a recorded result can be corrected.");
   if(Number(match.version)!==expected)throw new HttpError(409,"Match changed while the correction form was open. Refresh and retry.");
   const event=(await tx.execute({sql:"SELECT bracket_published FROM hof_tournaments WHERE slug=?",args:[eventSlug]})).rows[0];
   if(Number(event?.bracket_published)===1&&!reason)throw new HttpError(400,"A correction reason is required after the bracket is public.");
   const dependents=(await tx.execute({sql:"WITH RECURSIVE downstream(id) AS (SELECT match_id FROM hof_match_dependencies WHERE depends_on_match_id=? UNION SELECT d.match_id FROM hof_match_dependencies d JOIN downstream x ON d.depends_on_match_id=x.id) SELECT m.* FROM downstream x JOIN hof_matches m ON m.id=x.id",args:[matchId]})).rows;
   if(dependents.some((item:any)=>["in_progress","pending_publication","disputed"].includes(String(item.state))))throw new HttpError(409,"A dependent match is already underway or disputed. Resolve it before correcting this result.");
   const before={match,dependents};
   await tx.execute({sql:"UPDATE hof_matches SET winner_id=?,outcome=?,state='pending_publication',phase_state='complete',outcome_published=0,version=version+1,updated_at=? WHERE id=? AND version=?",args:[winner,outcome,now,matchId,expected]});
   for(const item of dependents)await tx.execute({sql:"UPDATE hof_matches SET participant_a=NULL,participant_b=NULL,winner_id=NULL,outcome='',state='awaiting_competitors',phase_state='upcoming',outcome_published=0,version=version+1,updated_at=? WHERE id=?",args:[now,item.id]});
   await audit(tx,actor,"edit_match_result",eventSlug,before,{matchId,winnerId:winner,outcome,resetDependentMatchIds:dependents.map((item:any)=>String(item.id))},reason);
   await tx.commit();tx=null;return json({ok:true,undoAvailable:true,undoAction:"edit_match_result",undoExpiresAt:new Date(Date.now()+10000).toISOString(),resetDependentMatchIds:dependents.map((item:any)=>String(item.id))});
  }
  if(action==="edit_completed_setup"){
   if(!matchId)throw new HttpError(400,"Match is required.");
   const reason=String(body.reason||"").trim().slice(0,1000),boss=String(body.boss||"").trim().slice(0,80),method=body.bossMethod==="manual"||body.bossMethod==="roll"||body.bossMethod==="headline"?body.bossMethod:null,clearTime=body.clearTimeSeconds===""||body.clearTimeSeconds==null?null:Number(body.clearTimeSeconds),staffNote=String(body.staffNote||"").trim().slice(0,1000),expected=Number(body.version);
   if(!Number.isInteger(clearTime)&&clearTime!==null||clearTime!==null&&(clearTime<0||clearTime>86400))throw new HttpError(400,"Clear time must be between 0 and 86,400 seconds.");
   tx=await db.transaction("write");
   const match=(await tx.execute({sql:"SELECT * FROM hof_matches WHERE id=?",args:[matchId]})).rows[0];if(!match)throw new HttpError(404,"Match not found.");
   const eventSlug=String(match.tournament_slug);await requireCan(actor,"manage_event",eventSlug,matchId,db);
   if(String(match.phase_state)!=="complete"&&!match.winner_id)throw new HttpError(409,"Only a completed match setup can be edited here.");
   if(Number(match.version)!==expected)throw new HttpError(409,"Match changed while this form was open. Refresh and retry.");
   const event=(await tx.execute({sql:"SELECT bracket_published FROM hof_tournaments WHERE slug=?",args:[eventSlug]})).rows[0];
   if(Number(event?.bracket_published)===1&&!reason)throw new HttpError(400,"A correction reason is required after the bracket is public.");
   if(boss){const known=await tx.execute({sql:"SELECT 1 FROM hof_boss_catalog WHERE name=? COLLATE NOCASE AND enabled=1",args:[boss]});if(!known.rows.length)throw new HttpError(400,"Choose an enabled Hologram boss.");}
   const before={match_boss:match.match_boss,boss_method:match.boss_method,clear_time_seconds:match.clear_time_seconds,staff_note:match.staff_note};
   const after={match_boss:boss||String(match.match_boss||""),boss_method:method,clear_time_seconds:clearTime,staff_note:staffNote};
   await tx.execute({sql:"UPDATE hof_matches SET match_boss=?,boss_method=?,clear_time_seconds=?,staff_note=?,version=version+1,updated_at=? WHERE id=? AND version=?",args:[after.match_boss,after.boss_method,after.clear_time_seconds,after.staff_note,now,matchId,expected]});
   await audit(tx,actor,"edit_match_setup",eventSlug,before,{matchId,...after},reason);
   await tx.commit();tx=null;return json({ok:true,undoAvailable:true,undoAction:"edit_match_setup",undoExpiresAt:new Date(Date.now()+10000).toISOString()});
  }
  if(action==="publish_podium"){
   if(!slug)throw new HttpError(400,"Tournament is required.");await requireCan(actor,"global_admin",slug,null,db);
   const fullyForfeitedRounds=(await db.execute({sql:"SELECT round_number FROM hof_matches WHERE tournament_slug=? GROUP BY round_number HAVING COUNT(*)=SUM(CASE WHEN state='forfeited' THEN 1 ELSE 0 END)",args:[slug]})).rows;
   for(const row of fullyForfeitedRounds){
    const round=Number(row.round_number),roundKey="hof:forfeited-round:"+slug+":"+round;
    let decision=(await db.execute({sql:"SELECT value FROM app_settings WHERE key=?",args:[roundKey]})).rows[0];
    if(!decision){const legacy=(await db.execute({sql:"SELECT value FROM app_settings WHERE key=?",args:["hof:forfeited-round:"+slug]})).rows[0];try{if(legacy&&Number(JSON.parse(String(legacy.value)).round)===round)decision=legacy;}catch{}}
    if(!decision)throw new HttpError(409,"Podium is blocked until an Arbiter cancels the event or reschedules the forfeited round.");
   }
   const placements=body.placements;if(!placements||typeof placements!=="object")throw new HttpError(400,"Choose all three podium participants.");
   const ids=[text(placements.gold,"Champion",80),text(placements.silver,"Second place",80),text(placements.bronze,"Third place",80)];
   if(new Set(ids).size!==3)throw new HttpError(400,"Each podium place must be a different confirmed participant.");
   tx=await db.transaction("write");
   const event=(await tx.execute({sql:"SELECT title,status FROM hof_tournaments WHERE slug=?",args:[slug]})).rows[0];if(!event)throw new HttpError(404,"Tournament not found.");if(String(event.status)==="cancelled")throw new HttpError(409,"A cancelled tournament cannot publish a podium.");
   if(String(event.status)==="cancelled")throw new HttpError(409,"A cancelled tournament cannot publish a podium.");
   const incomplete=await tx.execute({sql:"SELECT COUNT(*) total FROM hof_matches WHERE tournament_slug=? AND state NOT IN ('published','no_result','cancelled','forfeited')",args:[slug]});if(Number(incomplete.rows[0]?.total||0))throw new HttpError(409,"Finish or resolve every match before publishing the podium.");
   for(const id of ids){const valid=await tx.execute({sql:"SELECT 1 FROM hof_roster WHERE tournament_slug=? AND participant_id=? AND state='confirmed'",args:[slug,id]});if(!valid.rows.length)throw new HttpError(409,"Only confirmed participants can be on the podium.");}
   const prior=(await tx.execute({sql:"SELECT * FROM hof_medals WHERE tournament_slug=?",args:[slug]})).rows;
   for(const [medal,index] of [["gold",0],["silver",1],["bronze",2]] as const)await tx.execute({sql:"INSERT INTO hof_medals(tournament_slug,medal,participant_id,published,published_by,published_at) VALUES(?,?,?,1,?,?) ON CONFLICT(tournament_slug,medal) DO UPDATE SET participant_id=excluded.participant_id,published=1,published_by=excluded.published_by,published_at=excluded.published_at",args:[slug,medal,ids[index],actor.id,now]});
   await tx.execute({sql:"UPDATE hof_tournaments SET medals_published=1,status='finalized',updated_at=?,version=version+1 WHERE slug=?",args:[now,slug]});
   await audit(tx,actor,"publish_podium",slug,{medals:prior,status:String(event.status)},{gold:ids[0],silver:ids[1],bronze:ids[2],status:"finalized"});
   await tx.commit();tx=null;return json({ok:true,undoAvailable:true,undoAction:"publish_podium",undoExpiresAt:new Date(Date.now()+10000).toISOString()});
  }
  const phase4Actions=new Set(["begin_match_setup","start_match","start_without_details","save_match_details","save_draft_step","hold_match","set_event_match_rules","set_tournament_boss_pool","upsert_boss_catalog","report_match_winner","hold_and_start_next","declare_walkover","call_next_reserve","declare_double_forfeit","resolve_forfeited_round","cancel_tournament_forfeited_round"]);
  if(phase4Actions.has(action)&&!(await isFeatureEnabled("hof-match-flow",db)))throw new HttpError(404,"Hall of Fame match-flow tools are not enabled.");
  const foundationActions=new Set(["begin_match_setup","start_match","start_without_details","save_match_details","save_draft_step","hold_match","set_event_match_rules","set_tournament_boss_pool","upsert_boss_catalog"]);
  if(foundationActions.has(action)&&!(await isFeatureEnabled("hof-match-foundation",db)))throw new HttpError(404,"This Hall of Fame feature is not enabled.");
  if(action==="upsert_boss_catalog"){
   await requireCan(actor,"global_admin",null,null,db);
   const name=text(body.name,"Boss name",80),iconUrl=String(body.iconUrl||"").trim();
   if(iconUrl.length>500||iconUrl.startsWith("//")||iconUrl&&!iconUrl.startsWith("/")&&!/^https:\/\//i.test(iconUrl))throw new HttpError(400,"Boss artwork must use a site path or HTTPS URL.");
   await db.execute({sql:"INSERT INTO hof_boss_catalog(name,icon_url,enabled,created_at,updated_at) VALUES(?,?,1,?,?) ON CONFLICT(name) DO UPDATE SET icon_url=excluded.icon_url,enabled=1,updated_at=excluded.updated_at",args:[name,iconUrl,now,now]});
   await audit(db,actor,"boss_catalog_update",null,{}, {name,iconUrl});return json({ok:true,name});
  }
  if(action==="set_event_match_rules"){
   if(!slug)throw new HttpError(400,"Tournament is required.");await requireCan(actor,"manage_event",slug,null,db);
   const headlineBoss=text(body.headlineBoss,"Headline boss",80),bansPerPlayer=Number(body.bansPerPlayer);
   if(![3,4].includes(bansPerPlayer))throw new HttpError(400,"Choose three or four bans per player.");
   const event=(await db.execute({sql:"SELECT headline_boss,bans_per_player,status FROM hof_tournaments WHERE slug=?",args:[slug]})).rows[0];if(!event)throw new HttpError(404,"Tournament not found.");
   if(!["draft","announced","registration_open","registration_closed"].includes(String(event.status)))throw new HttpError(409,"Event match rules are locked after bracket preparation.");
   const boss=(await db.execute({sql:"SELECT name FROM hof_boss_catalog WHERE name=? COLLATE NOCASE AND enabled=1",args:[headlineBoss]})).rows[0];if(!boss)throw new HttpError(400,"Choose a boss from the enabled catalog.");
   await db.execute({sql:"UPDATE hof_tournaments SET boss=?,headline_boss=?,bans_per_player=?,updated_at=?,version=version+1 WHERE slug=?",args:[String(boss.name),String(boss.name),bansPerPlayer,now,slug]});
   await audit(db,actor,"setup_edit",slug,event,{headlineBoss:String(boss.name),bansPerPlayer});return json({ok:true,headlineBoss:String(boss.name),bansPerPlayer,draftSteps:draftOrder(bansPerPlayer).length});
  }
  if(action==="set_tournament_boss_pool"){
   if(!slug)throw new HttpError(400,"Tournament is required.");await requireCan(actor,"manage_event",slug,null,db);
   if(!Array.isArray(body.bosses)||body.bosses.length>32)throw new HttpError(400,"Choose up to 32 bosses for this event.");
   const names=body.bosses.map((value:unknown)=>text(value,"Boss name",80)),normalized=names.map((name:string)=>name.toLocaleLowerCase("en-US"));
   if(new Set(normalized).size!==names.length)throw new HttpError(400,"A boss can only appear once in the pool.");
   const event=(await db.execute({sql:"SELECT status FROM hof_tournaments WHERE slug=?",args:[slug]})).rows[0];if(!event)throw new HttpError(404,"Tournament not found.");
   if(!["draft","announced","registration_open","registration_closed"].includes(String(event.status)))throw new HttpError(409,"The boss pool is locked after bracket preparation.");
   const used=(await db.execute({sql:"SELECT 1 FROM hof_matches WHERE tournament_slug=? AND phase_state IN ('setting_up','live','complete') LIMIT 1",args:[slug]})).rows.length>0;if(used)throw new HttpError(409,"The boss pool cannot change after a match has started.");
   for(const name of names){const row=(await db.execute({sql:"SELECT name FROM hof_boss_catalog WHERE name=? COLLATE NOCASE AND enabled=1",args:[name]})).rows[0];if(!row)throw new HttpError(400,"Every pool boss must be present in the enabled catalog.");}
   tx=await db.transaction("write");
   const before=(await tx.execute({sql:"SELECT boss_name FROM hof_tournament_bosses WHERE tournament_slug=? ORDER BY pool_order",args:[slug]})).rows.map((row:any)=>String(row.boss_name));
   await tx.execute({sql:"DELETE FROM hof_tournament_bosses WHERE tournament_slug=?",args:[slug]});
   for(const [index,name] of names.entries())await tx.execute({sql:"INSERT INTO hof_tournament_bosses(tournament_slug,boss_name,pool_order,added_by,created_at) VALUES(?,?,?,?,?)",args:[slug,name,index,actor.id,now]});
   await audit(tx,actor,"setup_edit",slug,{bosses:before},{bosses:names});await tx.commit();tx=null;return json({ok:true,bosses:names});
  }
  if(action==="begin_match_setup"){
   if(!matchId)throw new HttpError(400,"Match is required.");
   const current=(await db.execute({sql:"SELECT m.tournament_slug,m.phase_state,m.state,m.participant_a,m.participant_b,t.status event_status FROM hof_matches m JOIN hof_tournaments t ON t.slug=m.tournament_slug WHERE m.id=?",args:[matchId]})).rows[0];if(!current)throw new HttpError(404,"Match not found.");
   const eventSlug=String(current.tournament_slug);await requireCan(actor,"manage_event",eventSlug,matchId,db);
   if(!["bracket_revealed","in_progress"].includes(String(current.event_status)))throw new HttpError(409,"Reveal the bracket before preparing a match.");
   if(!current.participant_a||!current.participant_b)throw new HttpError(409,"Both match participants must be known before setup.");
   if(!["ready","on_hold","setting_up"].includes(String(current.phase_state)))throw new HttpError(409,"Only a Ready, On hold, or existing setup match can be opened.");
   tx=await db.transaction("write");
   const locked=(await tx.execute({sql:"SELECT phase_state,state FROM hof_matches WHERE id=?",args:[matchId]})).rows[0];
   const active=await tx.execute({sql:"SELECT id FROM hof_matches WHERE tournament_slug=? AND id<>? AND phase_state IN ('setting_up','live') LIMIT 1",args:[eventSlug,matchId]});if(active.rows.length)throw new HttpError(409,"Finish or resume the other Setting up or Live match first.");
   if(!locked||!["ready","on_hold","setting_up"].includes(String(locked.phase_state))||!(["ready","scheduled"].includes(String(locked.state))))throw new HttpError(409,"Match changed while setup was opening.");
   await tx.execute({sql:"UPDATE hof_matches SET state='in_progress',phase_state='setting_up',hold_note='',version=version+1,updated_at=? WHERE id=?",args:[now,matchId]});
   await audit(tx,actor,"setup_edit",eventSlug,{phaseState:String(locked.phase_state)},{phaseState:"setting_up"});await tx.commit();tx=null;return json({ok:true,phaseState:"setting_up"});
  }
  if(action==="start_without_details"){
   if(!matchId)throw new HttpError(400,"Match is required.");
   const current=(await db.execute({sql:"SELECT m.tournament_slug,m.phase_state,m.state,m.participant_a,m.participant_b,t.status event_status FROM hof_matches m JOIN hof_tournaments t ON t.slug=m.tournament_slug WHERE m.id=?",args:[matchId]})).rows[0];if(!current)throw new HttpError(404,"Match not found.");
   const eventSlug=String(current.tournament_slug);await requireCan(actor,"manage_event",eventSlug,matchId,db);
   if(!["bracket_revealed","in_progress"].includes(String(current.event_status)))throw new HttpError(409,"Reveal the bracket before starting a match.");
   if(!current.participant_a||!current.participant_b)throw new HttpError(409,"Both match participants must be known before starting.");
   if(!["ready","on_hold","setting_up"].includes(String(current.phase_state)))throw new HttpError(409,"Only a Ready, On hold, or setup match can start without details.");
   if(!["ready","scheduled","in_progress"].includes(String(current.state)))throw new HttpError(409,"Only a Ready or setup match can start without details.");
   tx=await db.transaction("write");
   const active=await tx.execute({sql:"SELECT id FROM hof_matches WHERE tournament_slug=? AND id<>? AND phase_state IN ('setting_up','live') LIMIT 1",args:[eventSlug,matchId]});if(active.rows.length)throw new HttpError(409,"Another match is already Setting up or Live.");
   const steps=await tx.execute({sql:"SELECT COUNT(*) total FROM hof_draft_steps WHERE match_id=?",args:[matchId]});if(Number(steps.rows[0]?.total||0))throw new HttpError(409,"A match with draft steps cannot skip its setup.");
   const started=await tx.execute({sql:"UPDATE hof_matches SET state='in_progress',phase_state='live',started_without_details=1,match_boss='',boss_method=NULL,version=version+1,updated_at=? WHERE id=? AND phase_state=?",args:[now,matchId,String(current.phase_state)]});if(!started.rowsAffected)throw new HttpError(409,"Match setup changed before it could start.");
   await audit(tx,actor,"setup_edit",eventSlug,{phaseState:String(current.phase_state)},{phaseState:"live",startedWithoutDetails:true});await tx.commit();tx=null;return json({ok:true,phaseState:"live",startedWithoutDetails:true});
  }
  if(action==="start_match"){
   if(!matchId)throw new HttpError(400,"Match is required.");
   const current=(await db.execute({sql:"SELECT m.tournament_slug,m.phase_state,m.match_boss,m.started_without_details FROM hof_matches m WHERE m.id=?",args:[matchId]})).rows[0];if(!current)throw new HttpError(404,"Match not found.");
   const eventSlug=String(current.tournament_slug);await requireCan(actor,"manage_event",eventSlug,matchId,db);
   if(String(current.phase_state)!=="setting_up")throw new HttpError(409,"Open match setup before starting it.");
   if(!String(current.match_boss||"")&&!Number(current.started_without_details))throw new HttpError(409,"Choose a boss before starting the match, or use Start without details.");
   tx=await db.transaction("write");
   const active=await tx.execute({sql:"SELECT id FROM hof_matches WHERE tournament_slug=? AND id<>? AND phase_state IN ('setting_up','live') LIMIT 1",args:[eventSlug,matchId]});if(active.rows.length)throw new HttpError(409,"Another match is already Setting up or Live.");
   const started=await tx.execute({sql:"UPDATE hof_matches SET state='in_progress',phase_state='live',version=version+1,updated_at=? WHERE id=? AND phase_state='setting_up'",args:[now,matchId]});if(!started.rowsAffected)throw new HttpError(409,"Match setup changed before it could start.");
   await audit(tx,actor,"setup_edit",eventSlug,{phaseState:"setting_up"},{phaseState:"live"});await tx.commit();tx=null;return json({ok:true,phaseState:"live"});
  }
  if(action==="hold_match"){
   if(!matchId)throw new HttpError(400,"Match is required.");
   const current=(await db.execute({sql:"SELECT tournament_slug,phase_state FROM hof_matches WHERE id=?",args:[matchId]})).rows[0];if(!current)throw new HttpError(404,"Match not found.");
   const eventSlug=String(current.tournament_slug);await requireCan(actor,"manage_event",eventSlug,matchId,db);
   if(!["ready","on_hold"].includes(String(current.phase_state)))throw new HttpError(409,"Only a Ready match can be put on hold.");
   const note=String(body.note||"").trim().slice(0,1000);
   await db.execute({sql:"UPDATE hof_matches SET state='scheduled',phase_state='on_hold',hold_note=?,version=version+1,updated_at=? WHERE id=?",args:[note,now,matchId]});
   await audit(db,actor,"hold",eventSlug,{phaseState:String(current.phase_state)},{phaseState:"on_hold",holdNote:note},note);return json({ok:true,phaseState:"on_hold"});
  }
  if(action==="save_match_details"){
   if(!matchId)throw new HttpError(400,"Match is required.");
   const current=(await db.execute({sql:"SELECT m.*,t.headline_boss,t.status event_status,t.bans_per_player FROM hof_matches m JOIN hof_tournaments t ON t.slug=m.tournament_slug WHERE m.id=?",args:[matchId]})).rows[0];if(!current)throw new HttpError(404,"Match not found.");
   const eventSlug=String(current.tournament_slug);await requireCan(actor,"manage_event",eventSlug,matchId,db);
   if(!(String(current.phase_state)==="setting_up"||(String(current.phase_state)==="live"&&Number(current.started_without_details))))throw new HttpError(409,"Match details can only be edited during setup or for a match started without details.");
   let boss=body.matchBoss===undefined?String(current.match_boss||""):String(body.matchBoss||"").trim();
   const method=body.bossMethod===undefined?(current.boss_method?String(current.boss_method):null):(body.bossMethod?String(body.bossMethod):null);
   if(boss.length>80)throw new HttpError(400,"Boss name is too long.");
   if(method==="roll"){const pool=(await db.execute({sql:"SELECT b.boss_name FROM hof_tournament_bosses b JOIN hof_boss_catalog c ON c.name=b.boss_name WHERE b.tournament_slug=? AND c.enabled=1 ORDER BY b.pool_order",args:[eventSlug]})).rows.map((row:any)=>String(row.boss_name));if(!pool.length)throw new HttpError(409,"Add at least one Hologram boss to the event pool before rolling.");boss=pool[randomInt(pool.length)];}
   if(method&&!['manual','roll','headline'].includes(method))throw new HttpError(400,"Choose manual, roll, or headline boss selection.");
   if(boss&&!method)throw new HttpError(400,"Choose how this boss was selected.");
   const previousBoss=String(current.match_boss||""),previousMethod=current.boss_method?String(current.boss_method):null;
   const draftCount=Number((await db.execute({sql:"SELECT COUNT(*) total FROM hof_draft_steps WHERE match_id=?",args:[matchId]})).rows[0]?.total||0);
   if(draftCount&&(boss!==previousBoss||method!==previousMethod))throw new HttpError(409,"The boss is locked after the draft starts.");
   if(boss){
    const finalMatch=['third_place','grand_final'].includes(String(current.bracket_side))||String(current.round_label).toLocaleLowerCase("en-US")==="final";
    if(finalMatch){if(method!=="headline"||boss.toLocaleLowerCase("en-US")!==String(current.headline_boss||"").toLocaleLowerCase("en-US"))throw new HttpError(409,"Final and third-place matches must use the event headline boss.");}
    else{if(!['manual','roll'].includes(String(method)))throw new HttpError(400,"Choose a boss from the event pool for this match.");const inPool=(await db.execute({sql:"SELECT 1 FROM hof_tournament_bosses b JOIN hof_boss_catalog c ON c.name=b.boss_name WHERE b.tournament_slug=? AND b.boss_name=? COLLATE NOCASE AND c.enabled=1",args:[eventSlug,boss]})).rows.length>0;if(!inPool)throw new HttpError(409,"Choose a boss from this event's Hologram boss pool.");}
   }
   const rawClearTime=body.clearTimeSeconds===undefined?current.clear_time_seconds:(body.clearTimeSeconds===null||body.clearTimeSeconds===""?null:Number(body.clearTimeSeconds)),clearTime=rawClearTime===null||rawClearTime===undefined?null:Number(rawClearTime);
   if(clearTime!==null&&(!Number.isInteger(clearTime)||clearTime<0||clearTime>86400))throw new HttpError(400,"Clear time must be a whole number of seconds between 0 and 86400.");
   const staffNote=body.staffNote===undefined?String(current.staff_note||""):String(body.staffNote||"").trim().slice(0,1500),holdNote=body.holdNote===undefined?String(current.hold_note||""):String(body.holdNote||"").trim().slice(0,1000);
   await db.execute({sql:"UPDATE hof_matches SET match_boss=?,boss_method=?,clear_time_seconds=?,staff_note=?,hold_note=?,started_without_details=CASE WHEN ?<>'' THEN 0 ELSE started_without_details END,version=version+1,updated_at=? WHERE id=?",args:[boss,method,clearTime,staffNote,holdNote,boss,now,matchId]});
   const auditAction=method==="roll"&&boss!==previousBoss?"boss_roll":"setup_edit";
   await audit(db,actor,auditAction,eventSlug,{matchBoss:previousBoss,bossMethod:previousMethod,clearTimeSeconds:current.clear_time_seconds},{matchBoss:boss,bossMethod:method,clearTimeSeconds:clearTime,staffNote,holdNote},String(body.reason||"" ).slice(0,500));return json({ok:true,matchBoss:boss,bossMethod:method,clearTimeSeconds:clearTime});
  }
  if(action==="save_draft_step"){
   if(!matchId)throw new HttpError(400,"Match is required.");
   tx=await db.transaction("write");
   const current=(await tx.execute({sql:"SELECT m.tournament_slug,m.phase_state,m.participant_a,m.participant_b,m.match_boss,m.started_without_details,t.bans_per_player FROM hof_matches m JOIN hof_tournaments t ON t.slug=m.tournament_slug WHERE m.id=?",args:[matchId]})).rows[0];if(!current)throw new HttpError(404,"Match not found.");
   const eventSlug=String(current.tournament_slug);await requireCan(actor,"draft_result",eventSlug,matchId,db);
   if(!["setting_up","live"].includes(String(current.phase_state)))throw new HttpError(409,"Start match setup before saving draft steps.");
   if(!current.participant_a||!current.participant_b)throw new HttpError(409,"Both match participants must be known before drafting.");
   const name=text(body.resonator,"Resonator",64),resonator=featuredResonators.find((entry)=>entry.name.toLocaleLowerCase("en-US")===name.toLocaleLowerCase("en-US"));if(!resonator)throw new HttpError(400,"Choose a supported Resonator.");
   const rows=await tx.execute({sql:"SELECT step_number,actor_slot,action,resonator FROM hof_draft_steps WHERE match_id=? ORDER BY step_number",args:[matchId]});
   let step:any;try{step=validateDraftStep({history:rows.rows,stepNumber:Number(body.stepNumber),actorSlot:String(body.actorSlot),action:String(body.stepAction),resonator:resonator.name,bansPerPlayer:Number(current.bans_per_player),bossChosen:Boolean(String(current.match_boss||"")),startedWithoutDetails:Boolean(Number(current.started_without_details))});}catch(error){throw new HttpError(409,error instanceof Error?error.message:"Draft step is invalid.");}
   await tx.execute({sql:"INSERT INTO hof_draft_steps(match_id,step_number,actor_slot,action,resonator,created_by,created_at) VALUES(?,?,?,?,?,?,?)",args:[matchId,step.stepNumber,step.actorSlot,step.action,step.resonator,actor.id,now]});
   await audit(tx,actor,"setup_edit",eventSlug,{draftSteps:rows.rows.length},{draftStep:step});await tx.commit();tx=null;return json({ok:true,step,draftComplete:step.stepNumber===draftOrder(Number(current.bans_per_player)).length});
  }
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
  if(action==="repair_bye_bracket"){
   if(!slug)throw new HttpError(400,"Tournament is required.");
   await requireCan(actor,"manage_event",slug,null,db);
   tx=await db.transaction("write");
   const event=(await tx.execute({sql:"SELECT status,format FROM hof_tournaments WHERE slug=?",args:[slug]})).rows[0];
   if(!event)throw new HttpError(404,"Tournament not found.");
   if(event.format!=="single_elimination"||!["bracket_prepared","bracket_revealed"].includes(String(event.status)))throw new HttpError(409,"Only an unrevised single-elimination bracket can be repaired.");
   const roster=(await tx.execute({sql:"SELECT p.id FROM hof_roster r JOIN hof_participants p ON p.id=r.participant_id WHERE r.tournament_slug=? AND r.state='confirmed' AND r.published=1 ORDER BY COALESCE(r.seed_position,999999),p.display_name COLLATE NOCASE,p.id",args:[slug]})).rows;
   const entrants=roster.map((row:any)=>String(row.id));let size=1;while(size<entrants.length)size*=2;
   const byeCount=size-entrants.length;
   if(byeCount<=0||entrants.length<5)throw new HttpError(409,"This bracket does not need bye repair.");
   const allMatches=(await tx.execute({sql:"SELECT id,round_number,match_order,bracket_side,participant_a,participant_b,winner_id,outcome,outcome_published,state FROM hof_matches WHERE tournament_slug=? ORDER BY round_number,match_order",args:[slug]})).rows;
   if(allMatches.some((m:any)=>m.winner_id||m.outcome||Number(m.outcome_published)||["pending_publication","published","in_progress","disputed","suspended","result_recorded"].includes(String(m.state))))throw new HttpError(409,"Bracket repair is blocked after any match result has been recorded.");
   const roundOne=allMatches.filter((m:any)=>Number(m.round_number)===1&&m.bracket_side==="main");
   const roundTwo=allMatches.filter((m:any)=>Number(m.round_number)===2&&m.bracket_side==="main");
   const expectedRoundOne=entrants.length-size/2,expectedRoundTwo=size/4;
   if(roundOne.length!==expectedRoundOne||roundTwo.length!==expectedRoundTwo)throw new HttpError(409,"This bracket does not match the supported bye layout.");
   const firstRoundEntrants=new Set(roundOne.flatMap((m:any)=>[m.participant_a,m.participant_b].filter(Boolean).map(String)));
   if(firstRoundEntrants.size!==entrants.length-byeCount)throw new HttpError(409,"The first-round entrants do not match the published roster.");
   const byeSet=new Set(entrants.filter((id:string)=>!firstRoundEntrants.has(id))),orderedByes:string[]=[];
   for(const match of roundTwo)for(const id of [match.participant_a,match.participant_b])if(id&&byeSet.has(String(id))&&!orderedByes.includes(String(id)))orderedByes.push(String(id));
   for(const id of entrants)if(byeSet.has(id)&&!orderedByes.includes(id))orderedByes.push(id);
   const orderedRoundOne=[...roundOne],slots:any[]=[];let byeIndex=0,matchIndex=0;
   for(let group=0;group<expectedRoundTwo;group++){
    if(byeIndex<orderedByes.length)slots.push({kind:"player",id:orderedByes[byeIndex++]});
    else{const match=orderedRoundOne[matchIndex];slots.push({kind:"match",id:String(match.id)});await tx.execute({sql:"UPDATE hof_matches SET bracket_position=? WHERE id=?",args:[group*2,String(match.id)]});matchIndex++;}
    if(matchIndex<orderedRoundOne.length){const match=orderedRoundOne[matchIndex];slots.push({kind:"match",id:String(match.id)});await tx.execute({sql:"UPDATE hof_matches SET bracket_position=? WHERE id=?",args:[group*2+1,String(match.id)]});matchIndex++;}
    else slots.push({kind:"player",id:orderedByes[byeIndex++]});
   }
   for(let group=0;group<roundTwo.length;group++){
    const match=roundTwo[group],left=slots[group*2],right=slots[group*2+1],a=left.kind==="player"?left.id:null,b=right.kind==="player"?right.id:null;
    await tx.execute({sql:"DELETE FROM hof_match_dependencies WHERE match_id=?",args:[match.id]});
    await tx.execute({sql:"UPDATE hof_matches SET participant_a=?,participant_b=?,winner_id=NULL,outcome='',outcome_published=0,state=?,phase_state=?,bracket_position=?,version=version+1,updated_at=? WHERE id=?",args:[a,b,a&&b?"ready":"awaiting_competitors",initialMatchPhaseState({participantA:a,participantB:b}),group,now,match.id]});
    if(left.kind==="match")await tx.execute({sql:"INSERT INTO hof_match_dependencies(match_id,depends_on_match_id,dependency_type,target_slot) VALUES(?,?,'winner','participant_a')",args:[match.id,left.id]});
    if(right.kind==="match")await tx.execute({sql:"INSERT INTO hof_match_dependencies(match_id,depends_on_match_id,dependency_type,target_slot) VALUES(?,?,'winner','participant_b')",args:[match.id,right.id]});
   }
   const later=allMatches.filter((m:any)=>m.bracket_side==="main"&&Number(m.round_number)>2);
   for(const match of later)await tx.execute({sql:"UPDATE hof_matches SET bracket_position=?,updated_at=? WHERE id=?",args:[Number(match.match_order)-1,now,match.id]});
   await tx.execute({sql:"UPDATE hof_tournaments SET updated_at=?,version=version+1 WHERE slug=?",args:[now,slug]});
   await audit(tx,actor,"repair_bye_bracket",slug,{roundOneMatches:roundOne.length,roundTwoMatches:roundTwo.length},{byes:byeCount,roundTwo:roundTwo.map((m:any,i:number)=>({matchOrder:i+1,byeParticipant:[slots[i*2],slots[i*2+1]].find((node:any)=>node.kind==="player")?.id||null,sourceMatches:[slots[i*2],slots[i*2+1]].filter((node:any)=>node.kind==="match").map((node:any)=>node.id)}))});
   await tx.commit();tx=null;return json({ok:true,byes:byeCount});
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
  if(action==="record_match_result"||action==="report_match_winner"||action==="record_walkover_result"){
   if(!matchId)throw new HttpError(400,"Match is required.");const m=await db.execute({sql:"SELECT tournament_slug,state,phase_state,participant_a,participant_b,version,round_label,bracket_side FROM hof_matches WHERE id=?",args:[matchId]});if(!m.rows.length)throw new HttpError(404,"Match not found.");
   const eventSlug=String(m.rows[0].tournament_slug);await requireCan(actor,"draft_result",eventSlug,matchId,db);
   const flowEnabled=await isFeatureEnabled("hof-match-flow",db);if(flowEnabled){if(String(m.rows[0].phase_state)!=="live")throw new HttpError(409,"Only a Live match can report a winner.");}else if(!["ready","scheduled","in_progress"].includes(String(m.rows[0].state)))throw new HttpError(409,"This match is not ready for a result.");else if(String(m.rows[0].phase_state)==="setting_up")throw new HttpError(409,"Start the match before reporting its result.");
   const winner=text(body.winnerId,"Winner",80),outcome=String(body.outcome||"Winner advanced").trim().slice(0,500)||"Winner advanced",expected=Number(body.version);const bossRow=await db.execute({sql:"SELECT match_boss,boss_method FROM hof_matches WHERE id=?",args:[matchId]});if(flowEnabled&&!String(bossRow.rows[0]?.match_boss||"")&&!Number((await db.execute({sql:"SELECT started_without_details FROM hof_matches WHERE id=?",args:[matchId]})).rows[0]?.started_without_details))throw new HttpError(409,"Set the match boss before reporting the winner.");if(["third_place","grand_final"].includes(String(m.rows[0].bracket_side))||String(m.rows[0].round_label).toLowerCase()==="final"){const headline=(await db.execute({sql:"SELECT t.headline_boss FROM hof_tournaments t WHERE t.slug=?",args:[eventSlug]})).rows[0]?.headline_boss;if(String(bossRow.rows[0]?.match_boss||"").toLowerCase()!==String(headline||"").toLowerCase()||String(bossRow.rows[0]?.boss_method||"")!=="headline")throw new HttpError(409,"Final and third-place matches must use the event headline boss.");}
   if(winner!==m.rows[0].participant_a&&winner!==m.rows[0].participant_b)throw new HttpError(400,"Winner must be one of the two match participants.");
   const finalMatch=["third_place","grand_final"].includes(String(m.rows[0].bracket_side))||String(m.rows[0].round_label).toLowerCase()==="final";if(flowEnabled&&finalMatch){const headline=(await db.execute({sql:"SELECT headline_boss FROM hof_tournaments WHERE slug=?",args:[eventSlug]})).rows[0]?.headline_boss;if(String(bossRow.rows[0]?.match_boss||"").toLowerCase()!==String(headline||"").toLowerCase()||String(bossRow.rows[0]?.boss_method||"")!=="headline")throw new HttpError(409,"Final and third-place matches must use the event headline boss.");}
   const write=await db.execute({sql:"UPDATE hof_matches SET winner_id=?,outcome=?,state='pending_publication',phase_state='complete',version=version+1,updated_at=? WHERE id=? AND version=? AND state IN ('ready','scheduled','in_progress') AND (?=0 OR phase_state='live')",args:[winner,outcome,now,matchId,expected,flowEnabled?1:0]});
   if(!write.rowsAffected)throw new HttpError(409,"Match changed while this result was being entered. Refresh and retry.");
   await audit(db,actor,"record_match_result",eventSlug,m.rows[0],{winnerId:winner,outcome,state:"pending_publication"});return json({ok:true});
  }
  if(action==="hold_and_start_next"){
   if(!matchId)throw new HttpError(400,"Match is required.");tx=await db.transaction("write");
   const current=(await tx.execute({sql:"SELECT tournament_slug,phase_state,hold_note FROM hof_matches WHERE id=?",args:[matchId]})).rows[0];if(!current)throw new HttpError(404,"Match not found.");const eventSlug=String(current.tournament_slug);await requireCan(actor,"manage_event",eventSlug,matchId,tx);
   if(!["setting_up","live"].includes(String(current.phase_state)))throw new HttpError(409,"Only the active match can be put on hold.");
   const nextId=body.nextMatchId?text(body.nextMatchId,"Next match",80):"";const next=nextId?(await tx.execute({sql:"SELECT id,phase_state,state,participant_a,participant_b FROM hof_matches WHERE id=? AND tournament_slug=?",args:[nextId,eventSlug]})).rows[0]:null;
   const note=String(body.note||"").trim().slice(0,1000);await tx.execute({sql:"UPDATE hof_matches SET state='scheduled',phase_state='on_hold',hold_note=?,version=version+1,updated_at=? WHERE id=?",args:[note,now,matchId]});
   if(next){if(!next.participant_a||!next.participant_b)throw new HttpError(409,"The next match does not have two participants yet.");if(!["ready","on_hold"].includes(String(next.phase_state))||!(["ready","scheduled"].includes(String(next.state))))throw new HttpError(409,"The selected match is not Ready.");await tx.execute({sql:"UPDATE hof_matches SET state='in_progress',phase_state='setting_up',hold_note='',version=version+1,updated_at=? WHERE id=?",args:[now,nextId]});}
   await audit(tx,actor,"hold",eventSlug,{matchId,phaseState:String(current.phase_state)},{phaseState:"on_hold",nextMatchId:next?.id||null,holdNote:note},note);await tx.commit();tx=null;return json({ok:true,phaseState:"on_hold",nextMatchId:next?.id||null});
  }
  if(action==="declare_walkover"){
   if(!matchId)throw new HttpError(400,"Match is required.");const current=(await db.execute({sql:"SELECT * FROM hof_matches WHERE id=?",args:[matchId]})).rows[0];if(!current)throw new HttpError(404,"Match not found.");const eventSlug=String(current.tournament_slug);await requireCan(actor,"manage_event",eventSlug,matchId,db);
   if(!current.participant_a||!current.participant_b||!(["ready","on_hold"].includes(String(current.phase_state))))throw new HttpError(409,"Walkover requires a Ready or On hold match with both participants.");const winner=text(body.winnerId,"Present participant",80);if(![current.participant_a,current.participant_b].includes(winner))throw new HttpError(400,"Winner must be one of this match's participants.");const reason=text(body.reason,"Walkover reason",500);
   await db.execute({sql:"UPDATE hof_matches SET phase_state='live',match_boss='',boss_method=NULL,started_without_details=1,version=version+1,updated_at=? WHERE id=?",args:[now,matchId]});const result=await db.execute({sql:"UPDATE hof_matches SET winner_id=?,outcome=?,state='pending_publication',phase_state='complete',version=version+1,updated_at=? WHERE id=? AND phase_state='live'",args:[winner,"Walkover: "+reason,now,matchId]});if(!result.rowsAffected)throw new HttpError(409,"Match changed while the walkover was being recorded.");await audit(db,actor,"walkover",eventSlug,{phaseState:String(current.phase_state)},{winnerId:winner,outcome:"Walkover: "+reason},reason);return json({ok:true,winnerId:winner});
  }
  if(action==="call_next_reserve"){
   if(!matchId)throw new HttpError(400,"Match is required.");const slot=String(body.slot||"");if(!["a","b"].includes(slot))throw new HttpError(400,"Choose the absent participant slot.");
   tx=await db.transaction("write");const current=(await tx.execute({sql:"SELECT m.*,t.status event_status FROM hof_matches m JOIN hof_tournaments t ON t.slug=m.tournament_slug WHERE m.id=?",args:[matchId]})).rows[0];if(!current)throw new HttpError(404,"Match not found.");const eventSlug=String(current.tournament_slug);await requireCan(actor,"manage_event",eventSlug,matchId,tx);
   if(!["ready","on_hold"].includes(String(current.phase_state)))throw new HttpError(409,"Reserve replacement is only available before match setup.");const absent=String(current[slot==="a"?"participant_a":"participant_b"]||"");if(!absent)throw new HttpError(409,"The absent slot is already empty.");
   const reserves=await tx.execute({sql:"SELECT r.participant_id FROM hof_roster r WHERE r.tournament_slug=? AND r.state='reserve' ORDER BY COALESCE(r.reserve_order,9999),r.updated_at LIMIT 1",args:[eventSlug]});if(!reserves.rows.length)throw new HttpError(409,"There is no next reserve player.");const reserveId=String(reserves.rows[0].participant_id);const duplicate=await tx.execute({sql:"SELECT 1 FROM hof_matches WHERE tournament_slug=? AND id<>? AND (participant_a=? OR participant_b=?) LIMIT 1",args:[eventSlug,matchId,reserveId,reserveId]});if(duplicate.rows.length)throw new HttpError(409,"The next reserve is already entered in another match.");const col=slot==="a"?"participant_a":"participant_b";await tx.execute({sql:`UPDATE hof_matches SET ${col}=?,state='ready',phase_state='ready',version=version+1,updated_at=? WHERE id=?`,args:[reserveId,now,matchId]});await tx.execute({sql:"UPDATE hof_roster SET state='withdrawn',reserve_reason='Absent participant replaced by reserve',updated_at=? WHERE tournament_slug=? AND participant_id=?",args:[now,eventSlug,absent]});await tx.execute({sql:"UPDATE hof_roster SET state='confirmed',reserve_order=NULL,reserve_reason='',updated_at=? WHERE tournament_slug=? AND participant_id=?",args:[now,eventSlug,reserveId]});await audit(tx,actor,"reserve_call",eventSlug,{absentId:absent,slot},{reserveId,slot});await tx.commit();tx=null;return json({ok:true,reserveId});
  }
  if(action==="declare_double_forfeit"){
   if(!matchId)throw new HttpError(400,"Match is required.");tx=await db.transaction("write");const current=(await tx.execute({sql:"SELECT * FROM hof_matches WHERE id=?",args:[matchId]})).rows[0];if(!current)throw new HttpError(404,"Match not found.");const eventSlug=String(current.tournament_slug);await requireCan(actor,"manage_event",eventSlug,matchId,tx);if(!["ready","on_hold"].includes(String(current.phase_state)))throw new HttpError(409,"Double forfeit is only available before setup.");const reason=text(body.reason,"Double-forfeit reason",500);
   await tx.execute({sql:"UPDATE hof_matches SET winner_id=NULL,state='forfeited',phase_state='complete',outcome='Double forfeit: '||?,version=version+1,updated_at=? WHERE id=?",args:[reason,now,matchId]});await tx.execute({sql:"UPDATE hof_roster SET state='withdrawn',reserve_reason='Double forfeit',updated_at=? WHERE tournament_slug=? AND participant_id IN (?,?)",args:[now,eventSlug,current.participant_a,current.participant_b]});await cascadeDoubleForfeitByes(tx,actor,eventSlug,matchId,now);
   await audit(tx,actor,"double_forfeit",eventSlug,{phaseState:String(current.phase_state)},{roundLabel:String(current.round_label),byeCascadeApplied:true},reason);await tx.commit();tx=null;return json({ok:true,byeCascadeApplied:true});
  }
  if(action==="resolve_forfeited_round"){
   if(!slug)throw new HttpError(400,"Tournament is required.");await requireCan(actor,"global_admin",slug,null,db);
   const decision=text(body.decision,"Arbiter decision",30),reason=text(body.reason,"Decision reason",500);if(!["cancel","reschedule"].includes(decision))throw new HttpError(400,"Choose cancel or reschedule.");
   const round=Number(body.roundNumber);if(!Number.isInteger(round)||round<1)throw new HttpError(400,"Choose a valid round.");tx=await db.transaction("write");
   const event=(await tx.execute({sql:"SELECT status FROM hof_tournaments WHERE slug=?",args:[slug]})).rows[0];if(!event)throw new HttpError(404,"Tournament not found.");
   const stats=(await tx.execute({sql:"SELECT COUNT(*) total,SUM(CASE WHEN state='forfeited' THEN 1 ELSE 0 END) forfeited,SUM(CASE WHEN state='forfeited' OR phase_state='complete' THEN 1 ELSE 0 END) resolved FROM hof_matches WHERE tournament_slug=? AND round_number=?",args:[slug,round]})).rows[0];
   if(Number(stats.total||0)<1||Number(stats.forfeited||0)!==Number(stats.total||0))throw new HttpError(409,"Every match in the round must be forfeited first.");
   const decisionKey="hof:forfeited-round:"+slug+":"+round,legacyDecisionKey="hof:forfeited-round:"+slug;
   if(decision==="reschedule"){
    await tx.execute({sql:"UPDATE hof_matches SET state='ready',phase_state=CASE WHEN participant_a IS NOT NULL AND participant_b IS NOT NULL THEN 'ready' ELSE 'upcoming' END,winner_id=NULL,outcome='',version=version+1,updated_at=? WHERE tournament_slug=? AND round_number=?",args:[now,slug,round]});
    await tx.execute({sql:"UPDATE hof_tournaments SET status='in_progress',updated_at=?,version=version+1 WHERE slug=?",args:[now,slug]});
    await tx.execute({sql:"DELETE FROM app_settings WHERE key IN (?,?)",args:[decisionKey,legacyDecisionKey]});
   }else await tx.execute({sql:"UPDATE hof_tournaments SET status='cancelled',updated_at=?,version=version+1 WHERE slug=?",args:[now,slug]});
   if(decision==="cancel"){const record=JSON.stringify({round,decision,reason,actor:actor.id,at:now});for(const key of [decisionKey,legacyDecisionKey])await tx.execute({sql:"INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",args:[key,record,now]});}
   await audit(tx,actor,decision==="cancel"?"cancel":"round_reschedule",slug,{round,forfeited:Number(stats.forfeited)},{decision,reason},reason);await tx.commit();tx=null;return json({ok:true,decision});
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
    await tx.execute({sql:"UPDATE hof_matches SET "+slot+"=?,state=?,phase_state=?,version=version+1,updated_at=? WHERE id=?",args:[advancing,nextState,other?"ready":"upcoming",now,dep.match_id]});
   }
   await cascadeDoubleForfeitByes(tx,actor,eventSlug,matchId,now);
   const published=await tx.execute({sql:"UPDATE hof_matches SET state='published',phase_state='complete',outcome_published=1,version=version+1,updated_at=? WHERE id=? AND version=? AND state='pending_publication'",args:[now,matchId,match.version]});
   if(!published.rowsAffected)throw new HttpError(409,"Match changed during publication. Refresh and retry.");
   const incomplete=await tx.execute({sql:"SELECT COUNT(*) total FROM hof_matches WHERE tournament_slug=? AND state NOT IN ('published','no_result','cancelled')",args:[eventSlug]});
   const newStatus=Number(incomplete.rows[0]?.total||0)===0?"results_pending":"in_progress";
   await tx.execute({sql:"UPDATE hof_tournaments SET status=?,updated_at=?,version=version+1 WHERE slug=?",args:[newStatus,now,eventSlug]});
   await audit(tx,actor,action,eventSlug,current.rows[0],{state:"published",outcomePublished:true});
   await tx.commit();tx=null;return json({ok:true});
  }
  if(action==="open_dispute"){
   if(!matchId)throw new HttpError(400,"Match is required.");const m=await db.execute({sql:"SELECT tournament_slug,state,phase_state FROM hof_matches WHERE id=?",args:[matchId]});if(!m.rows.length)throw new HttpError(404,"Match not found.");
   const eventSlug=String(m.rows[0].tournament_slug);await requireCan(actor,"manage_event",eventSlug,matchId,db);if(["published","cancelled"].includes(String(m.rows[0].state)))throw new HttpError(409,"A published match needs an administrator correction workflow.");
   const reason=text(body.reason,"Dispute reason",1500),id=randomUUID();
   await db.execute({sql:"INSERT INTO hof_disputes(id,match_id,opened_by,reason,created_at) VALUES(?,?,?,?,?)",args:[id,matchId,actor.id,reason,now]});
   await db.execute({sql:"UPDATE hof_matches SET state='disputed',phase_state='on_hold',hold_note=?,version=version+1,updated_at=? WHERE id=?",args:[reason,now,matchId]});await audit(db,actor,action,eventSlug,{}, {matchId,disputeId:id,state:"disputed",phaseState:"on_hold"});return json({ok:true});
  }
  if(action==="resolve_dispute"){
   if(!matchId)throw new HttpError(400,"Match is required.");if(actor.role!=="owner"&&actor.role!=="hall_of_fame_admin")throw new HttpError(403,"Only an Administrator can resolve a dispute.");
   const rationale=text(body.reason,"Resolution rationale",1500),d=await db.execute({sql:"SELECT id FROM hof_disputes WHERE match_id=? AND state='open'",args:[matchId]});if(!d.rows.length)throw new HttpError(404,"Open dispute not found.");
   const m=await db.execute({sql:"SELECT tournament_slug,winner_id,outcome,participant_a,participant_b FROM hof_matches WHERE id=?",args:[matchId]});if(!m.rows.length)throw new HttpError(404,"Match not found.");
   const state=m.rows[0].winner_id?"pending_publication":"ready",phaseState=m.rows[0].winner_id?"complete":m.rows[0].participant_a&&m.rows[0].participant_b?"ready":"upcoming";
   await db.execute({sql:"UPDATE hof_disputes SET state='resolved',resolution=?,resolved_by=?,resolved_at=? WHERE match_id=? AND state='open'",args:[rationale,actor.id,now,matchId]});
   await db.execute({sql:"UPDATE hof_matches SET state=?,phase_state=?,hold_note='',version=version+1,updated_at=? WHERE id=?",args:[state,phaseState,now,matchId]});
   await audit(db,actor,action,String(m.rows[0].tournament_slug),{}, {state:"resolved",phaseState,resolution:rationale});return json({ok:true});
  }
  if(action==="delete_tournament"){
   if(actor.role!=="owner"&&actor.role!=="hall_of_fame_admin")throw new HttpError(403,"Only a full-access Black Shores administrator can delete tournaments.");
   if(!slug)throw new HttpError(400,"Choose a tournament to delete.");
   tx=await db.transaction("write");
   const event=(await tx.execute({sql:"SELECT slug,title,status,soft_deleted_at FROM hof_tournaments WHERE slug=?",args:[slug]})).rows[0];
   if(!event)throw new HttpError(404,"Tournament not found.");if(event.soft_deleted_at)throw new HttpError(409,"This tournament is already deleted.");
   const impact=(await tx.execute({sql:"SELECT (SELECT COUNT(*) FROM hof_roster WHERE tournament_slug=?) participants,(SELECT COUNT(*) FROM hof_matches WHERE tournament_slug=?) matches,(SELECT COUNT(*) FROM hof_medals WHERE tournament_slug=?) medals,(SELECT COUNT(*) FROM hof_announcements WHERE tournament_slug=?) announcements",args:[slug,slug,slug,slug]})).rows[0];
   await tx.execute({sql:"UPDATE hof_tournaments SET soft_deleted_at=?,updated_at=?,version=version+1 WHERE slug=? AND soft_deleted_at IS NULL",args:[now,now,slug]});
   await audit(tx,actor,"delete_tournament",slug,event,{softDeletedAt:now,impact});
   await tx.commit();tx=null;return json({ok:true,undoAvailable:true,undoExpiresAt:new Date(Date.parse(now)+10000).toISOString(),impact});
  }
  if(action==="undo_hof_edit"){
   if(!slug)throw new HttpError(400,"Tournament is required.");
   const targetAction=String(body.targetAction||"");if(!["edit_match_result","edit_match_setup","publish_podium"].includes(targetAction))throw new HttpError(400,"That edit cannot be undone here.");
   const targetMatch=body.matchId?String(body.matchId):"";await requireCan(actor,targetAction==="publish_podium"?"global_admin":"manage_event",targetAction==="publish_podium"?null:slug,targetMatch||null,db);
   tx=await db.transaction("write");
   const auditRow=(await tx.execute({sql:"SELECT before_state,created_at FROM hof_audit_events WHERE tournament_slug=? AND action=? AND (?='' OR json_extract(after_state,'$.matchId')=?) ORDER BY created_at DESC LIMIT 1",args:[slug,targetAction,targetMatch,targetMatch]})).rows[0];
   if(!auditRow||Date.now()-Date.parse(String(auditRow.created_at))>10000)throw new HttpError(409,"The 10-second Undo window has expired.");
   const latest=(await tx.execute({sql:"SELECT action,created_at FROM hof_audit_events WHERE tournament_slug=? ORDER BY created_at DESC LIMIT 1",args:[slug]})).rows[0];
   if(!latest||String(latest.action)!==targetAction||String(latest.created_at)!==String(auditRow.created_at))throw new HttpError(409,"A later change depends on this edit. Use the normal correction workflow.");
   const before=JSON.parse(String(auditRow.before_state||"{}"));
   if(targetAction==="edit_match_result"){
    const original=before.match;if(!original?.id)throw new HttpError(409,"The saved correction snapshot is unavailable.");
    await tx.execute({sql:"UPDATE hof_matches SET participant_a=?,participant_b=?,winner_id=?,outcome=?,state=?,phase_state=?,outcome_published=?,version=version+1,updated_at=? WHERE id=?",args:[original.participant_a,original.participant_b,original.winner_id,original.outcome,original.state,original.phase_state,original.outcome_published,now,original.id]});
    for(const item of before.dependents||[])await tx.execute({sql:"UPDATE hof_matches SET participant_a=?,participant_b=?,winner_id=?,outcome=?,state=?,phase_state=?,outcome_published=?,version=version+1,updated_at=? WHERE id=?",args:[item.participant_a,item.participant_b,item.winner_id,item.outcome,item.state,item.phase_state,item.outcome_published,now,item.id]});
   }else if(targetAction==="edit_match_setup"){
    const current=(await tx.execute({sql:"SELECT id FROM hof_matches WHERE id=?",args:[targetMatch]})).rows[0];if(!current)throw new HttpError(404,"Match not found.");
    await tx.execute({sql:"UPDATE hof_matches SET match_boss=?,boss_method=?,clear_time_seconds=?,staff_note=?,version=version+1,updated_at=? WHERE id=?",args:[before.match_boss,before.boss_method,before.clear_time_seconds,before.staff_note,now,targetMatch]});
   }else{
    await tx.execute({sql:"DELETE FROM hof_medals WHERE tournament_slug=?",args:[slug]});
    for(const medal of before.medals||[])await tx.execute({sql:"INSERT INTO hof_medals(tournament_slug,medal,participant_id,published,published_by,published_at,correction_of) VALUES(?,?,?,?,?,?,?)",args:[medal.tournament_slug,medal.medal,medal.participant_id,medal.published,medal.published_by,medal.published_at,medal.correction_of]});
    await tx.execute({sql:"UPDATE hof_tournaments SET status=?,medals_published=?,version=version+1,updated_at=? WHERE slug=?",args:[before.status,((before.medals||[]).some((medal:any)=>Number(medal.published)===1)?1:0),now,slug]});
   }
   await audit(tx,actor,"undo_hof_edit",slug,{undid:targetAction,matchId:targetMatch},{restored:true});
   await tx.commit();tx=null;return json({ok:true});
  }
  if(action==="undo_delete_tournament"){
   if(actor.role!=="owner"&&actor.role!=="hall_of_fame_admin")throw new HttpError(403,"Only a full-access Black Shores administrator can restore tournaments.");
   if(!slug)throw new HttpError(400,"Choose a tournament to restore.");
   tx=await db.transaction("write");
   const event=(await tx.execute({sql:"SELECT title,soft_deleted_at FROM hof_tournaments WHERE slug=?",args:[slug]})).rows[0];if(!event?.soft_deleted_at)throw new HttpError(404,"Deleted tournament not found.");
   const deletedAt=Date.parse(String(event.soft_deleted_at));if(!Number.isFinite(deletedAt)||Date.now()-deletedAt>10000)throw new HttpError(409,"The 10-second Undo window has expired. Use Restore with a reason.");
   const latest=(await tx.execute({sql:"SELECT action FROM hof_audit_events WHERE tournament_slug=? AND created_at>=? ORDER BY created_at DESC,id DESC LIMIT 1",args:[slug,String(event.soft_deleted_at)]})).rows[0];if(latest?.action!=="delete_tournament")throw new HttpError(409,"A later tournament change prevents Undo. Use Restore with a reason.");
   await tx.execute({sql:"UPDATE hof_tournaments SET soft_deleted_at=NULL,updated_at=?,version=version+1 WHERE slug=?",args:[now,slug]});
   await audit(tx,actor,"undo_delete_tournament",slug,{softDeletedAt:event.soft_deleted_at},{restored:true});
   await tx.commit();tx=null;return json({ok:true});
  }
  if(action==="restore_deleted_tournament"){
   if(actor.role!=="owner"&&actor.role!=="hall_of_fame_admin")throw new HttpError(403,"Only a full-access Black Shores administrator can restore tournaments.");
   if(!slug)throw new HttpError(400,"Choose a tournament to restore.");
   const reason=text(body.reason,"Restore reason",1000);tx=await db.transaction("write");
   const event=(await tx.execute({sql:"SELECT title,soft_deleted_at FROM hof_tournaments WHERE slug=?",args:[slug]})).rows[0];if(!event?.soft_deleted_at)throw new HttpError(404,"Deleted tournament not found.");
   await tx.execute({sql:"UPDATE hof_tournaments SET soft_deleted_at=NULL,updated_at=?,version=version+1 WHERE slug=?",args:[now,slug]});
   await audit(tx,actor,"restore_deleted_tournament",slug,{softDeletedAt:event.soft_deleted_at},{restored:true},reason);
   await tx.commit();tx=null;return json({ok:true});
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
   await tx.execute({sql:"INSERT INTO hof_tournaments(slug,title,boss,format,status,capacity_min,capacity_max,registration_deadline,timezone,rules,public_notice,event_date,roster_published,bracket_published,medals_published,artwork_data_url,tournament_kind,bracket_mode,headline_boss,bans_per_player,created_at,updated_at) VALUES(?,?,?,'single_elimination','archived',2,?,NULL,'UTC',?,?,?,1,0,1,?,'hologram','single_elimination',?,3,?,?)",args:[eventSlug,title,boss,capacityMax,rules,notice,eventDate,artwork,boss,now,now]});
   for(const entrant of entrants){await tx.execute({sql:"INSERT INTO hof_roster(tournament_slug,participant_id,state,published,updated_at) VALUES(?,?,'confirmed',1,?)",args:[eventSlug,entrant.participantId,now]});if(entrant.medal)await tx.execute({sql:"INSERT INTO hof_medals(tournament_slug,medal,participant_id,published,published_by,published_at) VALUES(?,?,?,1,?,?)",args:[eventSlug,entrant.medal,entrant.participantId,actor.id,now]});}
   await audit(tx,actor,action,eventSlug,{}, {status:"archived",historical:true,participants:entrants.length,medals:medals.size});await tx.commit();tx=null;return json({ok:true,participants:entrants.length,medals:medals.size,slug:eventSlug});
  }
  if(action==="edit_tournament"){
   await requireCan(actor,"global_admin",null,null,db);
   if(!slug)throw new HttpError(400,"Choose a tournament.");
   const current=await db.execute({sql:"SELECT slug,title,boss,status,event_date,rules,public_notice,artwork_data_url FROM hof_tournaments WHERE slug=?",args:[slug]});
   const row=current.rows[0];if(!row)throw new HttpError(404,"Tournament not found.");
   if(!["archived","finalized"].includes(String(row.status)))throw new HttpError(409,"Only archived tournaments can be edited here.");
   const title=text(body.title,"Title",120),boss=text(body.boss,"Hologram boss",80);
   const eventDate=body.eventDate?text(body.eventDate,"Event date",40):null;
   if(eventDate&&!/^\d{4}-\d{2}-\d{2}$/.test(eventDate))throw new HttpError(400,"Event date must be a valid date.");
   const rules=String(body.rules||"").slice(0,10000),notice=String(body.publicNotice||"").slice(0,2000);
   let artwork=String(row.artwork_data_url||"");
   if(body.artworkDataUrl!==undefined){artwork=String(body.artworkDataUrl||"");if(artwork.length>2100000||!/^data:image\/(png|jpeg|webp);base64,/.test(artwork))throw new HttpError(400,"Artwork must be PNG, JPG, or WebP under 1.5 MB.");}
   await db.execute({sql:"UPDATE hof_tournaments SET title=?,boss=?,headline_boss=?,event_date=?,rules=?,public_notice=?,artwork_data_url=?,updated_at=?,version=version+1 WHERE slug=?",args:[title,boss,boss,eventDate,rules,notice,artwork,now,slug]});
   await audit(db,actor,action,slug,{title:row.title,boss:row.boss,eventDate:row.event_date},{title,boss,eventDate,rules,publicNotice:notice,artworkChanged:body.artworkDataUrl!==undefined});
   return json({ok:true});
  }
  if(action==="create_tournament"){
   await requireCan(actor,"global_admin",null,null,db);
   const title=text(body.title,"Title",120),boss=text(body.boss,"Hologram boss",80),format=body.format==="double_elimination"?"double_elimination":"single_elimination";
   const base=title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,54)||"hologram-event",eventSlug=base+"-"+randomUUID().slice(0,8);
   const min=Math.max(2,Math.min(256,Number(body.capacityMin)||2)),max=Math.max(min,Math.min(256,Number(body.capacityMax)||32)),rules=String(body.rules||"").slice(0,10000),notice=String(body.publicNotice||"").slice(0,2000),eventDate=body.eventDate?text(body.eventDate,"Event date",50):null,artwork=String(body.artworkDataUrl||"");
   if(!/^data:image\/(png|jpeg|webp);base64,/.test(artwork)||artwork.length>2100000)throw new HttpError(400,"Upload a tournament image under 1.5 MB (PNG, JPG, or WebP).");
   if(eventDate&&Number.isNaN(Date.parse(eventDate)))throw new HttpError(400,"Enter a valid event date.");
   await db.execute({sql:"INSERT INTO hof_tournaments(slug,title,boss,format,status,capacity_min,capacity_max,registration_deadline,timezone,rules,public_notice,event_date,artwork_data_url,tournament_kind,bracket_mode,headline_boss,bans_per_player,created_at,updated_at) VALUES(?,?,?,?,'draft',?,?,NULL,'UTC',?,?,?,?, 'hologram',?,?,3,?,?)",args:[eventSlug,title,boss,format,min,max,rules,notice,eventDate,artwork,format,boss,now,now]});
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
   await db.execute({sql:"UPDATE hof_matches SET "+slot+"=?,phase_state='ready',version=version+1,updated_at=? WHERE id=?",args:[participantId,now,matchId]});
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
   if(!["announced","registration_open","registration_closed","draft"].includes(String(event.rows[0].status)))throw new HttpError(409,"Roster edits are closed for this event state.");
   const count=await db.execute({sql:"SELECT COUNT(*) total FROM hof_roster WHERE tournament_slug=? AND state='confirmed'",args:[slug]});if(!body.reserve&&Number(count.rows[0]?.total||0)>=Number(event.rows[0].capacity_max))throw new HttpError(409,"Tournament capacity has been reached.");
   const participant=await db.execute({sql:"SELECT id FROM hof_participants WHERE id=?",args:[participantId]});if(!participant.rows.length)throw new HttpError(404,"Participant not found.");
   await db.execute({sql:"INSERT INTO hof_roster(tournament_slug,participant_id,state,published,updated_at) VALUES(?,?,?,0,?) ON CONFLICT(tournament_slug,participant_id) DO UPDATE SET state=excluded.state,published=0,updated_at=excluded.updated_at",args:[slug,participantId,body.reserve?"reserve":"confirmed",now]});
   if(!body.reserve)await db.execute({sql:"INSERT INTO hof_registrations(id,tournament_slug,participant_id,reaction_message_ref,reaction_at,verified_by,verified_at,state) VALUES(?,?,?,?,?,?,?,'confirmed') ON CONFLICT(tournament_slug,participant_id) DO UPDATE SET state='confirmed',verified_by=excluded.verified_by,verified_at=excluded.verified_at",args:[randomUUID(),slug,participantId,String(body.reactionRef||"manual-admin").slice(0,120),now,actor.id,now]});
   await db.execute({sql:"UPDATE hof_tournaments SET roster_published=0,bracket_published=0,updated_at=?,version=version+1 WHERE slug=?",args:[now,slug]});await audit(db,actor,action,slug,{}, {participantId,state:body.reserve?"reserve":"confirmed"});return json({ok:true});
  }
  if(action==="publish_roster"){
   if(!slug)throw new HttpError(400,"Tournament is required.");await requireCan(actor,"manage_event",slug,null,db);
   const event=await db.execute({sql:"SELECT status FROM hof_tournaments WHERE slug=?",args:[slug]});if(!event.rows.length)throw new HttpError(404,"Tournament not found.");if(String(event.rows[0].status)!=="registration_closed")throw new HttpError(409,"Close registration before publishing the confirmed roster.");
   const result=await db.execute({sql:"UPDATE hof_roster SET published=1,updated_at=? WHERE tournament_slug=? AND state='confirmed'",args:[now,slug]});if(!result.rowsAffected)throw new HttpError(409,"Add at least one confirmed participant before publishing.");
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

