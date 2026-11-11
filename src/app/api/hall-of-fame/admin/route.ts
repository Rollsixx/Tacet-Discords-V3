import {randomUUID} from "node:crypto";
import {database,migrateOnce} from "@/lib/server/database";
import {authorize,failure,json,readJson} from "@/lib/server/http";
import {HttpError} from "@/lib/server/validation";
import {featuredResonators} from "@/lib/resonators";

const statuses=["draft","announced","registration_open","registration_closed","bracket_prepared","bracket_revealed","in_progress","results_pending","finalized","archived","suspended","cancelled"];
const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function text(value:unknown,name:string,max=300){if(typeof value!=="string"||!value.trim()||value.trim().length>max)throw new HttpError(400,name+" is required.");return value.trim();}
async function audit(db:any,action:string,slug:string|null,before:unknown,after:unknown,reason=""){
 await db.execute({sql:"INSERT INTO hof_audit_events(id,tournament_slug,actor_id,actor_role,action,reason,before_state,after_state,outcome,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",args:[randomUUID(),slug,"owner","hall_of_fame_admin",action,reason,JSON.stringify(before||{}),JSON.stringify(after||{}),"success",new Date().toISOString()]});
}
export async function GET(request:Request){
 try{authorize(request);await migrateOnce();const db=database();
  const events=await db.execute("SELECT slug,title,boss,status,format,event_date,capacity_min,capacity_max,roster_published,bracket_published,medals_published FROM hof_tournaments ORDER BY updated_at DESC");
  const people=await db.execute("SELECT id,display_name,resonator_icon FROM hof_participants ORDER BY display_name COLLATE NOCASE LIMIT 300");
  const auditRows=await db.execute("SELECT action,actor_role,reason,outcome,created_at,tournament_slug FROM hof_audit_events ORDER BY created_at DESC LIMIT 30");
  return json({events:events.rows,participants:people.rows,audit:auditRows.rows});
 }catch(e){return failure(e);}
}
export async function POST(request:Request){
 try{authorize(request);await migrateOnce();const body:any=await readJson(request,50000);if(!body||typeof body!=="object")throw new HttpError(400,"Invalid request.");const db=database(),action=text(body.action,"Action",60),now=new Date().toISOString();
  if(action==="create_tournament"){
   const slug=text(body.slug,"Slug",80).toLowerCase();if(!slugPattern.test(slug))throw new HttpError(400,"Use a lowercase URL slug.");
   const title=text(body.title,"Title",120),boss=text(body.boss,"Hologram boss",80),format=body.format==="double_elimination"?"double_elimination":"single_elimination";
   const min=Math.max(2,Math.min(256,Number(body.capacityMin)||2)),max=Math.max(min,Math.min(256,Number(body.capacityMax)||32));
   const timezone=text(body.timezone||"UTC","Timezone",80),rules=String(body.rules||"").slice(0,10000),notice=String(body.publicNotice||"").slice(0,2000),eventDate=body.eventDate?text(body.eventDate,"Event date",50):null;
   await db.execute({sql:"INSERT INTO hof_tournaments(slug,title,boss,format,status,capacity_min,capacity_max,registration_deadline,timezone,rules,public_notice,event_date,created_at,updated_at) VALUES(?,?,?,?,'draft',?,?,NULL,?,?,?,?,?,?)",args:[slug,title,boss,format,min,max,timezone,rules,notice,eventDate,now,now]});
   await audit(db,action,slug,{}, {slug,title,boss,format,status:"draft"});return json({ok:true});
  }
  if(action==="set_status"){
   const slug=text(body.slug,"Tournament",80),status=text(body.status,"Status",40);if(!statuses.includes(status))throw new HttpError(400,"Unsupported tournament status.");
   const old=await db.execute({sql:"SELECT status FROM hof_tournaments WHERE slug=?",args:[slug]});if(!old.rows.length)throw new HttpError(404,"Tournament not found.");
   await db.execute({sql:"UPDATE hof_tournaments SET status=?,updated_at=?,version=version+1 WHERE slug=?",args:[status,now,slug]});await audit(db,action,slug,old.rows[0],{status},String(body.reason||"").slice(0,500));return json({ok:true});
  }
  if(action==="add_participant"){
   const id=randomUUID(),name=text(body.name,"Participant display name",40),resonator=text(body.resonator,"Resonator",64);
   if(!featuredResonators.some(r=>r.name.toLowerCase()===resonator.toLowerCase()))throw new HttpError(400,"Choose a supported Resonator.");
   const icon=featuredResonators.find(r=>r.name.toLowerCase()===resonator.toLowerCase())!.name;
   await db.execute({sql:"INSERT INTO hof_participants(id,display_name,resonator_icon,created_at,updated_at) VALUES(?,?,?,?,?)",args:[id,name,icon,now,now]});await audit(db,action,null,{}, {id,name,resonatorIcon:icon});return json({ok:true,id});
  }
  if(action==="add_roster"){
   const slug=text(body.slug,"Tournament",80),participantId=text(body.participantId,"Participant",80);
   const event=await db.execute({sql:"SELECT status,capacity_max FROM hof_tournaments WHERE slug=?",args:[slug]});if(!event.rows.length)throw new HttpError(404,"Tournament not found.");
   if(!["registration_open","registration_closed","draft"].includes(String(event.rows[0].status)))throw new HttpError(409,"Roster edits are closed for this event state.");
   const count=await db.execute({sql:"SELECT COUNT(*) total FROM hof_roster WHERE tournament_slug=? AND state='confirmed'",args:[slug]});if(Number(count.rows[0]?.total||0)>=Number(event.rows[0].capacity_max))throw new HttpError(409,"Tournament capacity has been reached.");
   const participant=await db.execute({sql:"SELECT id FROM hof_participants WHERE id=?",args:[participantId]});if(!participant.rows.length)throw new HttpError(404,"Participant not found.");
   await db.execute({sql:"INSERT INTO hof_roster(tournament_slug,participant_id,state,published,updated_at) VALUES(?,?,'confirmed',0,?) ON CONFLICT(tournament_slug,participant_id) DO UPDATE SET state='confirmed',published=0,updated_at=excluded.updated_at",args:[slug,participantId,now]});
   await db.execute({sql:"INSERT INTO hof_registrations(id,tournament_slug,participant_id,reaction_message_ref,reaction_at,verified_by,verified_at,state) VALUES(?,?,?,?,?,?,?,'confirmed') ON CONFLICT(tournament_slug,participant_id) DO UPDATE SET state='confirmed',verified_by=excluded.verified_by,verified_at=excluded.verified_at",args:[randomUUID(),slug,participantId,String(body.reactionRef||"manual-admin").slice(0,120),now,"owner",now]});
   await audit(db,action,slug,{}, {participantId,state:"confirmed"});return json({ok:true});
  }
  if(action==="publish_roster"){
   const slug=text(body.slug,"Tournament",80);const result=await db.execute({sql:"UPDATE hof_roster SET published=1,updated_at=? WHERE tournament_slug=? AND state='confirmed'",args:[now,slug]});
   if(!result.rowsAffected)throw new HttpError(409,"No confirmed participants to publish.");await db.execute({sql:"UPDATE hof_tournaments SET roster_published=1,updated_at=?,version=version+1 WHERE slug=?",args:[now,slug]});await audit(db,action,slug,{}, {published:true});return json({ok:true});
  }
  if(action==="set_medal"){
   const slug=text(body.slug,"Tournament",80),medal=text(body.medal,"Medal",12),participantId=text(body.participantId,"Participant",80);if(!["gold","silver","bronze"].includes(medal))throw new HttpError(400,"Unsupported medal.");
   const valid=await db.execute({sql:"SELECT 1 FROM hof_roster WHERE tournament_slug=? AND participant_id=? AND state='confirmed'",args:[slug,participantId]});if(!valid.rows.length)throw new HttpError(409,"Medal recipient must be a confirmed participant.");
   await db.execute({sql:"INSERT INTO hof_medals(tournament_slug,medal,participant_id,published,published_by,published_at) VALUES(?,?,?,0,NULL,NULL) ON CONFLICT(tournament_slug,medal) DO UPDATE SET participant_id=excluded.participant_id,published=0,published_by=NULL,published_at=NULL",args:[slug,medal,participantId]});
   await audit(db,action,slug,{}, {medal,participantId,published:false});return json({ok:true});
  }
  if(action==="publish_medals"){
   const slug=text(body.slug,"Tournament",80);const n=await db.execute({sql:"UPDATE hof_medals SET published=1,published_by='owner',published_at=? WHERE tournament_slug=?",args:[now,slug]});if(!n.rowsAffected)throw new HttpError(409,"Set at least one medal first.");
   await db.execute({sql:"UPDATE hof_tournaments SET medals_published=1,status='finalized',updated_at=?,version=version+1 WHERE slug=?",args:[now,slug]});await audit(db,action,slug,{}, {published:true});return json({ok:true});
  }
  if(action==="add_announcement"){
   const slug=text(body.slug,"Tournament",80),title=text(body.title,"Announcement title",140),message=text(body.body,"Announcement text",4000),category=["general","pinned","critical"].includes(body.category)?body.category:"general",id=randomUUID(),publish=Boolean(body.publish);
   await db.execute({sql:"INSERT INTO hof_announcements(id,tournament_slug,category,title,body,published,published_by,published_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",args:[id,slug,category,title,message,publish?1:0,publish?"owner":null,publish?now:null,now]});await audit(db,action,slug,{}, {id,title,published:publish});return json({ok:true});
  }
  throw new HttpError(400,"Unknown Hall of Fame action.");
 }catch(e){return failure(e);}
}
