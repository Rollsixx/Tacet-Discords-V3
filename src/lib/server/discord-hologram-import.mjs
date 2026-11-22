import {createHash,randomUUID} from 'node:crypto';
import {HttpError} from './validation.ts';

const validId=(value)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const must=(condition,message,status=422)=>{if(!condition)throw new HttpError(status,message);};

export function validateDiscordSnapshot(snapshot){
 must(snapshot&&typeof snapshot==='object'&&snapshot.version===2,'Unsupported Discord tournament snapshot.');
 const event=snapshot.event,roster=snapshot.roster,matches=snapshot.matches;
 must(event&&/^discord-hologram-[1-9]\d{0,14}$/.test(event.id),'Invalid Discord tournament ID.');
 must(typeof event.title==='string'&&event.title.trim().length>0&&event.title.length<=120
  &&typeof event.category==='string'&&event.category.length<=80
  &&Number.isInteger(event.capacity)&&event.capacity>=2&&event.capacity<=256
  &&['registration','running','completed'].includes(event.state),'Invalid tournament details.');
 must(Number.isSafeInteger(snapshot.revision)&&snapshot.revision>0,'Invalid source revision.');
 must(Array.isArray(roster)&&roster.length<=event.capacity
  &&Array.isArray(matches)&&matches.length<=256,'Invalid roster or bracket size.');
 const ids=new Set();
 for(const player of roster){
  must(player&&validId(player.id)&&!ids.has(player.id)&&typeof player.displayName==='string'
   &&player.displayName.trim().length>0&&player.displayName.length<=40,'Invalid or duplicate roster entry.');
  ids.add(player.id);
 }
 const hasPlayer=(id)=>id===null||ids.has(id),byId=new Map();
 for(const match of matches){
  must(match&&Number.isInteger(match.round)&&match.round>0&&match.round<=9
   &&Number.isInteger(match.number)&&match.number>0&&match.number<=128
   &&match.id===`${event.id}-r${match.round}-m${match.number}`&&!byId.has(match.id)
   &&['main','third_place'].includes(match.side)&&Array.isArray(match.participants)
   &&match.participants.length===2&&match.participants.every(hasPlayer)&&hasPlayer(match.winner)
   &&(match.winner===null||(match.resolved&&match.participants.includes(match.winner)))
   &&typeof match.resolved==='boolean'&&typeof match.active==='boolean'
   &&(match.boss===null||typeof match.boss==='string'&&match.boss.length<=80)
   &&(match.phase===null||['unstarted','waiting','running','expired','resolved'].includes(match.phase))
   &&Array.isArray(match.dependencies)&&match.dependencies.length<=2,'Invalid match.');
  byId.set(match.id,match);
 }
 must(matches.filter(match=>match.active).length<=1&&(!matches.some(match=>match.active)||event.state==='running'),
  'Only one running tournament match is allowed.');
 for(const match of matches){
  const slots=new Set(),sources=new Set();
  for(const edge of match.dependencies){
   must(byId.get(edge.matchId)?.round===match.round-1
    &&edge.type===(match.side==='third_place'?'loser':'winner')
    &&['a','b'].includes(edge.slot)&&!slots.has(edge.slot)&&!sources.has(edge.matchId),
   'Invalid bracket dependency.');slots.add(edge.slot);sources.add(edge.matchId);
  }
 }
 const steps=snapshot.draftSteps??[];
 must(Array.isArray(steps)&&steps.length<=matches.length*12,'Invalid ban and pick steps.');
 const stepsByMatch=new Map();
 for(const step of steps){
  must(step&&typeof step.matchId==='string'&&byId.has(step.matchId)
   &&Number.isInteger(step.step)&&step.step>=1&&step.step<=12
   &&['a','b'].includes(step.slot)&&['pick','ban'].includes(step.action)
   &&typeof step.resonator==='string'&&step.resonator.trim().length>0&&step.resonator.length<=64,
  'Invalid ban and pick step.');
  const list=stepsByMatch.get(step.matchId)||[];list.push(step);stepsByMatch.set(step.matchId,list);
 }
 for(const list of stepsByMatch.values()){
  list.sort((a,b)=>a.step-b.step);
  must(list.every((step,index)=>step.step===index+1),'Ban and pick steps must be consecutive.');
  const order=[['a','ban'],['a','ban'],['b','ban'],['b','ban'],['a','pick'],['b','pick'],['a','ban'],['b','ban'],['a','pick'],['a','pick'],['b','pick'],['b','pick']];
  const bans=[],picks=[];
  for(const step of list){
   const [slot,action]=order[step.step-1];
   must(step.slot===slot&&step.action===action,'Ban and pick steps do not follow the Discord tournament rules.');
   const name=step.resonator.trim().toLocaleLowerCase('en-US');
   if(action==='pick'){
    must(!bans.includes(name)&&!(picks.some(pick=>pick.slot===slot&&pick.name===name))
     &&picks.filter(pick=>pick.slot===slot).length<3,'Discord draft contains an illegal Resonator pick.');
    picks.push({slot,name});
   }else{
    must(!picks.some(pick=>pick.name===name),'A picked Resonator cannot be banned.');
    bans.push(name);
   }
  }
 }
 const podium=snapshot.podiumForReview;
 must(podium&&['gold','silver','bronze'].every(medal=>podium[medal]===null||ids.has(podium[medal]))
  &&new Set(Object.values(podium).filter(Boolean)).size===Object.values(podium).filter(Boolean).length,
 'Invalid podium candidates.');
 return {event,roster,matches,steps,podium};
}

export async function importDiscordHologram(db,snapshot,now=new Date().toISOString()){
 const {event,roster,matches,steps,podium}=validateDiscordSnapshot(snapshot);
 const slug=event.id,revision=snapshot.revision,hash=createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
 const markerKey=`hof:discord-preview:${slug}`,revisionKey=`hof:discord-sync:${slug}`;
 const tx=await db.transaction('write');
 try{
  const existing=(await tx.execute({sql:'SELECT status,roster_published,bracket_published,medals_published,soft_deleted_at FROM hof_tournaments WHERE slug=?',args:[slug]})).rows[0];
  const marker=(await tx.execute({sql:'SELECT value FROM app_settings WHERE key=?',args:[markerKey]})).rows[0];
  const current=(await tx.execute({sql:'SELECT value FROM app_settings WHERE key=?',args:[revisionKey]})).rows[0];
  let markerData=null;try{if(marker)markerData=JSON.parse(String(marker.value));}catch{}
  const autoRevealOnRunning=markerData?.autoRevealOnRunning===true||!existing;
  if(existing&&(!markerData||markerData.source!=='discord'||markerData.managed!==true))throw new HttpError(409,'This event is not managed by the Discord integration.');
  if(existing&&(existing.soft_deleted_at||Number(existing.medals_published)||['finalized','archived','cancelled'].includes(String(existing.status))))throw new HttpError(409,'This Discord event is closed to further updates.');
  let last={revision:0,hash:''};try{if(current)last=JSON.parse(String(current.value));}catch{}
  if(revision<Number(last.revision||0))throw new HttpError(409,'This Discord snapshot is stale.');
  if(revision===Number(last.revision||0)){
   if(hash!==last.hash)throw new HttpError(409,'This source revision was already used for different tournament data.');
   await tx.commit();return {slug,roster:roster.length,matches:matches.length,revision,idempotent:true,podiumForReview:podium};
  }
  const initialStatus=event.state==='registration'?'draft':'bracket_prepared';
  await tx.execute({sql:`INSERT INTO hof_tournaments(slug,title,boss,format,status,capacity_min,capacity_max,timezone,created_at,updated_at,tournament_kind,bracket_mode,headline_boss)
   VALUES(?,?,'','single_elimination',?,2,?,'UTC',?,?,'hologram','single_elimination','')
   ON CONFLICT(slug) DO UPDATE SET title=excluded.title,capacity_max=MAX(hof_tournaments.capacity_max,excluded.capacity_max),updated_at=excluded.updated_at`,args:[slug,event.title,initialStatus,event.capacity,now,now]});
  for(let i=0;i<roster.length;i++){
   const player=roster[i];
   await tx.execute({sql:`INSERT INTO hof_participants(id,display_name,resonator_icon,created_at,updated_at) VALUES(?,?,'',?,?)
    ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,updated_at=excluded.updated_at`,args:[player.id,player.displayName,now,now]});
   await tx.execute({sql:`INSERT INTO hof_roster(tournament_slug,participant_id,state,seed_position,published,updated_at,display_name_snapshot)
    VALUES(?,?,'confirmed',?,0,?,?) ON CONFLICT(tournament_slug,participant_id) DO UPDATE SET state='confirmed',seed_position=excluded.seed_position,updated_at=excluded.updated_at,display_name_snapshot=excluded.display_name_snapshot`,args:[slug,player.id,i+1,now,player.displayName]});
  }
  if(roster.length){
   const rosterParams=roster.map(player=>player.id);
   await tx.execute({sql:`DELETE FROM hof_roster WHERE tournament_slug=? AND participant_id NOT IN (${rosterParams.map(()=>'?').join(',')})`,args:[slug,...rosterParams]});
  }else await tx.execute({sql:'DELETE FROM hof_roster WHERE tournament_slug=?',args:[slug]});
  const priorBossRows=await tx.execute({sql:'SELECT id,match_boss FROM hof_matches WHERE tournament_slug=?',args:[slug]});
  const priorBosses=new Map(priorBossRows.rows.map(row=>[String(row.id),String(row.match_boss||'')]));
  await tx.execute({sql:`UPDATE hof_matches SET phase_state='ready' WHERE tournament_slug=? AND phase_state IN ('setting_up','live')`,args:[slug]});
  const insertMatch=`INSERT INTO hof_matches(id,tournament_slug,round_number,round_label,match_order,bracket_side,participant_a,participant_b,state,winner_id,outcome,outcome_published,bracket_position,phase_state,match_boss,updated_at)
   VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
   participant_a=excluded.participant_a,participant_b=excluded.participant_b,state=excluded.state,winner_id=excluded.winner_id,
   outcome=excluded.outcome,outcome_published=excluded.outcome_published,phase_state=excluded.phase_state,match_boss=excluded.match_boss,updated_at=excluded.updated_at`;
  for(const match of matches){
   const [a,b]=match.participants,active=match.active;
   const state=match.resolved?(match.winner?'published':'no_result'):active?'in_progress':a&&b?'ready':'awaiting_competitors';
   const phase=match.resolved?'complete':active?(match.phase==='running'?'live':'setting_up'):a&&b?'ready':'upcoming';
   const side=match.side==='third_place'?'third_place':'main';
   await tx.execute({sql:insertMatch,args:[match.id,slug,match.round,side==='third_place'?'Third-place match':`Round ${match.round}`,match.number,side,a,b,state,match.winner,match.winner?'Discord tournament result':match.resolved?'No winner':'',match.resolved?1:0,match.number-1,phase,match.boss||'',now]});
   if(active&&match.boss&&priorBosses.get(match.id)!==match.boss){
    await tx.execute({sql:`INSERT INTO hof_audit_events(id,tournament_slug,match_id,actor_id,actor_role,action,reason,before_state,after_state,outcome,created_at)
     VALUES(?,?,?,'discord-bot','integration','boss_roll','',?,?,'success',?)`,args:[randomUUID(),slug,match.id,JSON.stringify({matchBoss:priorBosses.get(match.id)||''}),JSON.stringify({matchId:match.id,matchBoss:match.boss}),now]});
   }
  }
  await tx.execute({sql:'DELETE FROM hof_match_dependencies WHERE match_id IN (SELECT id FROM hof_matches WHERE tournament_slug=?)',args:[slug]});
  await tx.execute({sql:'DELETE FROM hof_draft_steps WHERE match_id IN (SELECT id FROM hof_matches WHERE tournament_slug=?)',args:[slug]});
  if(matches.length){
   const matchIds=matches.map(match=>match.id);
   await tx.execute({sql:`DELETE FROM hof_matches WHERE tournament_slug=? AND id NOT IN (${matchIds.map(()=>'?').join(',')})`,args:[slug,...matchIds]});
  }else await tx.execute({sql:'DELETE FROM hof_matches WHERE tournament_slug=?',args:[slug]});
  await tx.execute({sql:'DELETE FROM hof_match_dependencies WHERE match_id IN (SELECT id FROM hof_matches WHERE tournament_slug=?)',args:[slug]});
  for(const match of matches)for(const edge of match.dependencies){
   await tx.execute({sql:'INSERT INTO hof_match_dependencies(match_id,depends_on_match_id,dependency_type,target_slot) VALUES(?,?,?,?)',args:[match.id,edge.matchId,edge.type,`participant_${edge.slot}`]});
  }
  await tx.execute({sql:'DELETE FROM hof_draft_steps WHERE match_id IN (SELECT id FROM hof_matches WHERE tournament_slug=?)',args:[slug]});
  for(const step of steps){
   await tx.execute({sql:'INSERT INTO hof_draft_steps(match_id,step_number,actor_slot,action,resonator,created_by,created_at) VALUES(?,?,?,?,?,?,?)',args:[step.matchId,step.step,step.slot,step.action,step.resonator,'discord-bot',now]});
  }
  await tx.execute({sql:`INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`,args:[markerKey,JSON.stringify({source:'discord',managed:true,sourceState:event.state,autoRevealOnRunning,podiumForReview:podium}),now]});
  await tx.execute({sql:`INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`,args:[revisionKey,JSON.stringify({revision,hash,receivedAt:now}),now]});
  if(existing&&event.state==='running'&&String(existing.status)==='bracket_revealed')await tx.execute({sql:"UPDATE hof_tournaments SET status='in_progress' WHERE slug=?",args:[slug]});
  if(event.state==='running'&&autoRevealOnRunning){
   await tx.execute({sql:"UPDATE hof_roster SET published=1,updated_at=? WHERE tournament_slug=? AND state='confirmed'",args:[now,slug]});
   await tx.execute({sql:"UPDATE hof_tournaments SET status='in_progress',roster_published=1,bracket_published=1 WHERE slug=?",args:[slug]});
  }
  if(existing&&event.state!=='registration'&&['draft','registration_closed'].includes(String(existing.status)))await tx.execute({sql:"UPDATE hof_tournaments SET status='bracket_prepared' WHERE slug=?",args:[slug]});
  if(existing&&event.state==='completed'&&['bracket_revealed','in_progress'].includes(String(existing.status)))await tx.execute({sql:"UPDATE hof_tournaments SET status='results_pending' WHERE slug=?",args:[slug]});
  await tx.execute({sql:`INSERT INTO hof_audit_events(id,tournament_slug,actor_id,actor_role,action,reason,before_state,after_state,outcome,created_at) VALUES(?,?,'discord-bot','integration','discord_sync','',?,?, 'success',?)`,args:[randomUUID(),slug,JSON.stringify({revision:last.revision||0}),JSON.stringify({revision,roster:roster.length,matches:matches.length}),now]});
  await tx.execute({sql:'UPDATE hof_tournaments SET updated_at=?,version=version+1 WHERE slug=?',args:[now,slug]});
  await tx.commit();
  return {slug,roster:roster.length,matches:matches.length,revision,idempotent:false,podiumForReview:podium};
 }catch(error){await tx.rollback();throw error;}finally{tx.close();}
}

