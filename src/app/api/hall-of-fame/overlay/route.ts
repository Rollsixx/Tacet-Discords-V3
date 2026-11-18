import {database,migrateOnce} from "@/lib/server/database";
import {failure} from "@/lib/server/http";
import {isFeatureEnabled} from "@/lib/server/feature-flags.mjs";

export async function GET(request:Request){
 try{
  await migrateOnce();
  const slug=new URL(request.url).searchParams.get("slug")||"";
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>80)return Response.json({error:"Invalid event."},{status:400});
  const db=database();
  const tournament=(await db.execute({sql:"SELECT slug,title,status,bracket_published FROM hof_tournaments WHERE slug=? AND soft_deleted_at IS NULL",args:[slug]})).rows[0];
  if(!tournament||!Number(tournament.bracket_published)||!["bracket_revealed","in_progress","results_pending","finalized","archived"].includes(String(tournament.status)))return Response.json({error:"The bracket is not public."},{status:404});
  const [rows,edges,rolls,enabled]=await Promise.all([
   db.execute({sql:"SELECT m.id,m.round_number,m.round_label,m.match_order,m.bracket_side,m.phase_state,m.state,m.participant_a,m.participant_b,m.winner_id,m.outcome_published,m.match_boss,m.updated_at,a.display_name name_a,b.display_name name_b,c.icon_url boss_icon FROM hof_matches m LEFT JOIN hof_participants a ON a.id=m.participant_a LEFT JOIN hof_participants b ON b.id=m.participant_b LEFT JOIN hof_boss_catalog c ON c.name=m.match_boss WHERE m.tournament_slug=? AND m.state<>'cancelled' ORDER BY m.round_number,m.match_order",args:[slug]}),
   db.execute({sql:"SELECT d.match_id,d.depends_on_match_id,d.dependency_type,d.target_slot FROM hof_match_dependencies d JOIN hof_matches m ON m.id=d.match_id WHERE m.tournament_slug=?",args:[slug]}),
   db.execute({sql:"SELECT id,action,created_at,after_state FROM hof_audit_events WHERE tournament_slug=? AND action IN ('boss_roll','publish_match_result','verify_match_result') ORDER BY created_at DESC LIMIT 12",args:[slug]}),
   isFeatureEnabled("hof-public-match-view",db)
  ]);
  const matches=rows.rows.map((row:any)=>({id:String(row.id),round:Number(row.round_number),roundLabel:String(row.round_label),order:Number(row.match_order),side:String(row.bracket_side),phase:String(row.phase_state),state:String(row.state),a:row.participant_a?{id:String(row.participant_a),name:String(row.name_a)}:null,b:row.participant_b?{id:String(row.participant_b),name:String(row.name_b)}:null,winnerId:Number(row.outcome_published)&&row.winner_id?String(row.winner_id):null,boss:enabled?String(row.match_boss||""):"",bossIcon:enabled?String(row.boss_icon||""):"",updatedAt:String(row.updated_at),dependencies:edges.rows.filter((edge:any)=>String(edge.match_id)===String(row.id)).map((edge:any)=>({source:String(edge.depends_on_match_id),type:String(edge.dependency_type),slot:String(edge.target_slot)}))}));
  const active=enabled?matches.find(match=>["setting_up","live"].includes(match.phase)):null;
  const steps=active?await db.execute({sql:"SELECT step_number,actor_slot,action,resonator FROM hof_draft_steps WHERE match_id=? ORDER BY step_number",args:[active.id]}):{rows:[]};
  const events=rolls.rows.map((row:any)=>{let after:any={};try{after=JSON.parse(String(row.after_state));}catch{}return {id:String(row.id),type:String(row.action),at:String(row.created_at),matchId:String(after.matchId||""),boss:String(after.matchBoss||"")};});
  return Response.json({title:String(tournament.title),slug,scene:active?"match":"bracket",activeMatchId:active?.id||null,matches,draft:steps.rows.map((row:any)=>({step:Number(row.step_number),slot:String(row.actor_slot),action:String(row.action),resonator:String(row.resonator)})),latestEvent:events[0]||null,latestRoll:enabled?events.find(event=>event.type==="boss_roll"&&event.matchId===active?.id)||null:null,matchViewEnabled:Boolean(enabled)},{headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
 }catch(error){return failure(error);}
}
