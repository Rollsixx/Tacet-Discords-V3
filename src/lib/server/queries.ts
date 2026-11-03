// Public data access and rank-history snapshots; never import OCR, image processing or the scoring engine.
import type {Client,Row} from '@libsql/client';
import {createHash} from 'node:crypto';
import {nextRankHistory,rankHistoryEvents} from '../leaderboards/rank-history.mjs';
import {aggregateMedalStandings} from '../leaderboards/medal-standings.mjs';
import {orderProfileBuildsByRank} from '../leaderboards/profile-rank-order.mjs';
import {buildDataConsistencyReport} from '../leaderboards/consistency-report.mjs';
import {database} from './database.ts';
import {HttpError} from './validation.ts';
import {featuredResonators,latestResonators} from '../resonators.ts';
import {ENGINE_VERSION,DATA_VERSION,POLICY_VERSION,SUPPORTED} from './scoring-versions.mjs';
import {scoringReadiness} from './scoring-info.ts';
import {rotationPolicyReady} from '../game-data/scoring-policies.mjs';
import {resolveHomeFeatured} from './home-featured.mjs';
type RankHistoryEntry={rank:number;previousRank:number|null;movement:number|null;rankSince:string|null;trackingSince?:string;bestRank?:number;bestTop1Days?:number;buildId?:string;score?:number;ign?:string;active?:boolean};
export async function listBuilds(options: { search?: string; character?: string; id?: string; uid?: string; includePending?: boolean; page?: number; pending?: boolean; patchMajor?: string } = {}, db: Client = database()) {
  const page = Number.isFinite(options.page) ? Math.min(10000, Math.max(1, Math.floor(options.page || 1))) : 1;
  const query = (options.search || "").slice(0, 64).trim();
  const character = (options.character || "").slice(0, 64).trim();
  const patchMajor = (options.patchMajor || "").match(/^\d{1,2}$/)?.[0] || "";
  const patchCharacters = patchMajor ? featuredResonators.filter(item => item.patchVersion.startsWith(patchMajor + ".")).map(item => item.name) : [];
  if (patchMajor && !patchCharacters.length) return {builds:[],page,hasMore:false,scoring:scoringReadiness};
  const patchSql = patchMajor ? ` AND s.character IN (${patchCharacters.map(() => "?").join(",")})` : "";
  const rankedProfile = Boolean(options.uid&&!options.includePending&&!options.pending&&!options.id);
  const result = await db.execute({
    sql: `SELECT s.id,uid,ign,character,status,created_at,reviewed_at,identity_verified,data,mpo.details AS manual_profile_details,(SELECT avatar_character FROM players p WHERE p.uid=s.uid) AS avatar_character,
      CASE WHEN s.status='approved' AND identity_verified=1 AND c.engine_version='${ENGINE_VERSION}' AND c.data_version='${DATA_VERSION}' AND c.policy_id=COALESCE((SELECT v.policy_id FROM rotation_active a JOIN rotation_versions v ON v.id=a.version_id WHERE a.character=s.character),'${POLICY_VERSION}') THEN c.score ELSE NULL END AS verified_score
       ,CASE WHEN c.engine_version='${ENGINE_VERSION}' AND c.data_version='${DATA_VERSION}' AND c.policy_id=COALESCE((SELECT v.policy_id FROM rotation_active a JOIN rotation_versions v ON v.id=a.version_id WHERE a.character=s.character),'${POLICY_VERSION}') THEN c.details END AS current_calculation
      FROM submissions s LEFT JOIN calculation_results c ON c.submission_id=s.id LEFT JOIN submission_profile_overrides mpo ON mpo.submission_id=s.id WHERE replaced_by IS NULL AND (status=? OR (?=1 AND status IN ('pending','approved'))) AND (?='' OR instr(lower(ign),lower(?))>0 OR instr(uid,?)>0 OR instr(lower(s.id),lower(?))>0)
      AND (?='' OR character=?) AND (?='' OR s.id=?) AND (?='' OR uid=?)${patchSql}
      ORDER BY created_at DESC,s.id DESC ${rankedProfile?"":"LIMIT 21 OFFSET ?"}`,
    args: [options.pending ? "pending" : "approved", options.includePending?1:0, query, query, query, query, character, character, options.id || "", options.id || "", options.uid || "", options.uid || "", ...patchCharacters, ...(rankedProfile?[]:[(page - 1) * 20])],
  });
  let builds=rankedProfile?result.rows.map(publicBuild):result.rows.slice(0,20).map(publicBuild);
  // A player's profile uses the same live rank and movement record as the boards.
  if(!options.includePending&&!options.pending&&(options.uid||options.id)&&builds.length){
    // This client may be an in-memory SQLite database with a single connection;
    // rank-history writes must not race one another inside Promise.all.
    const resonators=[...new Set(builds.map(build=>build.character))];
    const snapshots=await ensureFreshRankHistories(resonators,db);
    const histories=new Map<string,RankHistoryEntry>();
    for(const resonator of resonators){
      const uid=options.uid||builds.find(build=>build.character===resonator)!.uid;
      const history=snapshots.get(resonator)?.[uid];
      if(history)histories.set(resonator,history);
    }
    builds=builds.map(build=>{
      const ranked=histories.get(build.character);
      return {...build,rank:ranked?.rank??null,rankMovement:ranked?.movement??null,rankSince:ranked?.rankSince??null,rankTrackingSince:ranked?.trackingSince??null,rankDays:ranked?.rankSince?Math.max(0,Math.floor((Date.now()-Date.parse(ranked.rankSince))/86400000)):null,bestRank:ranked?.bestRank??null,bestTop1Days:ranked?.bestTop1Days??null,rankHasHistory:ranked?.previousRank!==null&&ranked?.previousRank!==undefined};
    });
  }
  let hasMore=rankedProfile?builds.length>page*20:result.rows.length>20;
  if(rankedProfile){
    builds=orderProfileBuildsByRank(builds);
    builds=builds.slice((page-1)*20,page*20);
  }
  let medalStanding=null;
  if(options.uid&&!options.includePending&&!options.pending){
    const overall=(await medalStandings(db,{refresh:false})).players.find(player=>player.uid===options.uid);
    if(overall)medalStanding=overall;
  }
  const medals={top1:medalStanding?.gold||0,top2:medalStanding?.silver||0,top3:medalStanding?.bronze||0,total:medalStanding?.total||0};
  const rankHistory=options.uid&&!options.includePending&&!options.pending?(await listPlayerRankHistory(options.uid,db)).events:[];
 return {builds,page,hasMore,scoring:scoringReadiness,medals,medalStanding,rankHistory};
}
function publicBuild(row: Row) {
 const data=JSON.parse(String(row.data));
 if(row.manual_profile_details){data.manualProfileDetails=JSON.parse(String(row.manual_profile_details));}
 if(row.current_calculation){data.assessment={...data.assessment,calculation:JSON.parse(String(row.current_calculation))};}
 return {
      id: String(row.id), rank: row.global_rank == null ? null : Number(row.global_rank), rankMovement:null as number|null, rankSince:null as string|null, rankTrackingSince:null as string|null, rankDays:null as number|null, bestRank:null as number|null, bestTop1Days:null as number|null, rankHasHistory:false as boolean, uid: String(row.uid), ign: String(row.ign), character: String(row.character), avatarCharacter: row.avatar_character == null ? null : String(row.avatar_character),
      status: String(row.status), createdAt: String(row.created_at), reviewedAt: row.reviewed_at,
      identityVerified: Boolean(row.identity_verified), score: row.verified_score === null ? null : Number(row.verified_score),
      data: data as { manualProfileDetails?:{weapon?:string;weaponKey?:string;weaponType?:string;talents?:(number|null)[];resonanceChain?:number}; assessment?: {eligible: boolean; awaitingRotation?:boolean; reason: string; statsVerified?:boolean; profileDetails?:{weapon?:string;weaponIcon?:boolean;talents?:(number|null)[];resonanceChain?:number}; failure?:{code?:string;message?:string;slot?:number;field?:string}; maxMainStatsVerified?:boolean; rollsVerified?:boolean; sourceSlots?:{slot:number;substats:{raw?:string;value:string}[]}[]; originalSourceSlots?:{slot:number;substats:{raw?:string;value:string}[]}[]; visualReport?:import("../scanner/scoring-readiness.ts").VisualReportSlot[]; calculation?: { score: number; metric: string; policyId: string; engineVersion: string; dataVersion: string; finalStats?: Record<string,number>; displayStats?: Record<string,number>; startState?: string; rotationOrigin?: string; rotation: string; weapon: string; conditions: string; identities: {echo: string; set: string; echoMatch?: {equivalentVariants?: string[]}}[] }}; slots: { slot: number; cost: { raw: string; value: string }; mainStat: { raw: string; value: string }; substats: { raw: string; value: string }[] }[] },
    }; }

function parseRankState(raw:unknown):Record<string,RankHistoryEntry>{
 try{const parsed=JSON.parse(String(raw||"{}"));return parsed&&typeof parsed==="object"?parsed as Record<string,RankHistoryEntry>:{}}catch{return {};}
}
async function synchronizeRankHistory(character:string,rows:Row[],db:Client,recordEvents=true,sourceRevision?:number):Promise<Record<string,RankHistoryEntry>|null>{
 const generation="rank-v6:"+createHash("sha256").update(rows.map(row=>[String(row.id),String(row.uid),String(row.ign),String(row.global_rank),Number(row.verified_score).toPrecision(15)].join(":")).join("\n")).digest("hex");
 const materialize=(saved:Row|undefined)=>parseRankState(saved?.state);
 const saveChanged=async(tx:Awaited<ReturnType<Client["transaction"]>>,saved:Row|undefined)=>{
  if(String(saved?.generation_hash||"")===generation)return materialize(saved);
  const priorGeneration=String(saved?.generation_hash||""),hasBaseline=["rank-v2:","rank-v3:","rank-v4:","rank-v5:","rank-v6:"].some(prefix=>priorGeneration.startsWith(prefix));
  const previous=hasBaseline?parseRankState(saved?.state):{},now=new Date().toISOString();
  const historyRows=rows.map(row=>({uid:String(row.uid),ign:String(row.ign),global_rank:Number(row.global_rank),id:String(row.id),score:Number(row.verified_score)}));
  const next=nextRankHistory(historyRows,previous,now);
  const events=rankHistoryEvents(historyRows,previous,hasBaseline,now);
  if(recordEvents)for(const event of events)await tx.execute({sql:"INSERT INTO leaderboard_rank_events(character,uid,event_type,old_rank,new_rank,old_score,new_score,old_build_id,new_build_id,changed_at) VALUES(?,?,?,?,?,?,?,?,?,?)",args:[character,event.uid,event.type,event.oldRank,event.newRank,event.oldScore,event.newScore,event.oldBuildId,event.newBuildId,event.changedAt]});
  return next;
 };
 if(sourceRevision!==undefined){
  const tx=await db.transaction("write");
  try{
   const clock=(await tx.execute({sql:"SELECT revision FROM leaderboard_rank_clock WHERE character=?",args:[character]})).rows[0];
   if(Number(clock?.revision)!==sourceRevision)return null;
   const saved=(await tx.execute({sql:"SELECT generation_hash,state FROM leaderboard_rank_history WHERE character=?",args:[character]})).rows[0];
   const next=await saveChanged(tx,saved);
   const now=new Date().toISOString();
   await tx.execute({sql:"INSERT INTO leaderboard_rank_history(character,generation_hash,state,updated_at,source_revision) VALUES(?,?,?,?,?) ON CONFLICT(character) DO UPDATE SET generation_hash=excluded.generation_hash,state=excluded.state,updated_at=excluded.updated_at,source_revision=excluded.source_revision",args:[character,generation,JSON.stringify(next),now,sourceRevision]});
   await tx.execute({sql:"UPDATE leaderboard_rank_clock SET dirty=0 WHERE character=? AND revision=?",args:[character,sourceRevision]});
   await tx.commit();
   return next;
  }finally{tx.close();}
 }
 let saved=(await db.execute({sql:"SELECT generation_hash,state FROM leaderboard_rank_history WHERE character=?",args:[character]})).rows[0];
 if(String(saved?.generation_hash||"")!==generation){
  const tx=await db.transaction("write");
  try{
   saved=(await tx.execute({sql:"SELECT generation_hash,state FROM leaderboard_rank_history WHERE character=?",args:[character]})).rows[0];
   if(String(saved?.generation_hash||"")!==generation){
    const next=await saveChanged(tx,saved),now=new Date().toISOString();
    await tx.execute({sql:"INSERT INTO leaderboard_rank_history(character,generation_hash,state,updated_at) VALUES(?,?,?,?) ON CONFLICT(character) DO UPDATE SET generation_hash=excluded.generation_hash,state=excluded.state,updated_at=excluded.updated_at",args:[character,generation,JSON.stringify(next),now]});
    saved={generation_hash:generation,state:JSON.stringify(next)} as unknown as Row;
   }
   await tx.commit();
  }finally{tx.close();}
 }
 return materialize(saved);
}

async function readRankedBoardRows(character:string,db:Client):Promise<Row[]>{
 const result=await db.execute({sql:`WITH candidates AS (
  SELECT s.id,s.uid,s.ign,s.character,s.status,s.created_at,s.reviewed_at,s.identity_verified,s.data,p.avatar_character,c.details AS current_calculation,c.score AS verified_score,
  row_number() OVER(PARTITION BY s.uid,s.character ORDER BY c.score DESC,s.id ASC) AS player_best
  FROM submissions s JOIN players p ON p.uid=s.uid JOIN calculation_results c ON c.submission_id=s.id
  WHERE s.status='approved' AND s.replaced_by IS NULL AND s.identity_verified=1 AND s.character=? AND c.engine_version=? AND c.data_version=? AND c.policy_id=COALESCE((SELECT v.policy_id FROM rotation_active a JOIN rotation_versions v ON v.id=a.version_id WHERE a.character=s.character),?)
 ), ranked AS (
  SELECT *,row_number() OVER(ORDER BY verified_score DESC,id ASC) AS global_rank FROM candidates WHERE player_best=1
 ) SELECT * FROM ranked ORDER BY global_rank ASC`,args:[character,ENGINE_VERSION,DATA_VERSION,POLICY_VERSION]});
 return result.rows;
}

async function ensureFreshRankHistory(character:string,db:Client,force=false):Promise<{state:Record<string,RankHistoryEntry>;refreshed:boolean}>{
 await db.execute({sql:"INSERT INTO leaderboard_rank_clock(character,revision,dirty) VALUES(?,1,1) ON CONFLICT(character) DO NOTHING",args:[character]});
 for(let attempt=0;attempt<5;attempt++){
  const clock=(await db.execute({sql:"SELECT revision,dirty FROM leaderboard_rank_clock WHERE character=?",args:[character]})).rows[0];
  const revision=Number(clock?.revision||0);
  const saved=(await db.execute({sql:"SELECT state,source_revision FROM leaderboard_rank_history WHERE character=?",args:[character]})).rows[0];
  const dirty=force||Number(clock?.dirty)!==0||Number(saved?.source_revision)!==revision;
  if(!dirty)return {state:parseRankState(saved?.state),refreshed:false};
  const rows=await readRankedBoardRows(character,db);
  const state=await synchronizeRankHistory(character,rows,db,true,revision);
  if(state)return {state,refreshed:true};
 }
 throw new HttpError(503,"Rank history is updating. Try again shortly.");
}

async function ensureFreshRankHistories(characters:string[],db:Client):Promise<Map<string,Record<string,RankHistoryEntry>>>{
 const unique=[...new Set(characters)];
 if(!unique.length)return new Map();
 await db.execute({sql:`INSERT INTO leaderboard_rank_clock(character,revision,dirty) VALUES ${unique.map(()=>"(?,1,1)").join(",")} ON CONFLICT(character) DO NOTHING`,args:unique});
 const marks=unique.map(()=>"?").join(",");
 const rows=await db.execute({sql:`SELECT c.character,c.revision,c.dirty,h.state,h.source_revision FROM leaderboard_rank_clock c LEFT JOIN leaderboard_rank_history h ON h.character=c.character WHERE c.character IN (${marks})`,args:unique});
 const states=new Map<string,Record<string,RankHistoryEntry>>(),stale:string[]=[];
 for(const row of rows.rows){
  const character=String(row.character),revision=Number(row.revision);
  if(Number(row.dirty)!==0||Number(row.source_revision)!==revision)stale.push(character);
  else states.set(character,parseRankState(row.state));
 }
 for(const character of stale){
  const {state}=await ensureFreshRankHistory(character,db);
  states.set(character,state);
 }
 return states;
}

export async function refreshLeaderboardRankHistory(db:Client=database(),options:{force?:boolean;characters?:string[]}={}){
 const requested=options.characters?.filter(character=>SUPPORTED.includes(character))||[];
 let characters:string[];
 if(options.force)characters=requested.length?requested:SUPPORTED;
 else if(requested.length)characters=requested;
 else{
  const dirty=(await db.execute("SELECT character FROM leaderboard_rank_clock WHERE dirty!=0 ORDER BY character")).rows.map(row=>String(row.character));
  const uninitialized=(await db.execute("SELECT DISTINCT s.character FROM submissions s LEFT JOIN leaderboard_rank_history h ON h.character=s.character WHERE s.status='approved' AND s.identity_verified=1 AND s.replaced_by IS NULL AND h.character IS NULL")).rows.map(row=>String(row.character));
  characters=[...new Set([...dirty,...uninitialized])].filter(character=>SUPPORTED.includes(character));
 }
 let refreshed=0;
 for(const character of characters){
  const result=await ensureFreshRankHistory(character,db,options.force===true);
  if(result.refreshed)refreshed++;
 }
 return {refreshed};
}

function rankedBuild(row:Row,history:RankHistoryEntry){
 const build=publicBuild({...row,global_rank:history.rank,verified_score:history.score} as Row);
 return {...build,
  rankMovement:history.movement??null,rankSince:history.rankSince??null,rankTrackingSince:history.trackingSince??null,
  rankDays:history.rankSince?Math.max(0,Math.floor((Date.now()-Date.parse(history.rankSince))/86400000)):null,
  bestRank:history.bestRank??build.rank,bestTop1Days:history.bestTop1Days??null,
  rankHasHistory:history.previousRank!==null&&history.previousRank!==undefined};
}
async function loadRankedBuilds(entries:Array<{character:string;uid:string;history:RankHistoryEntry}>,db:Client):Promise<Awaited<ReturnType<typeof listBuilds>>["builds"]>{
 if(!entries.length)return [];
 const ids=entries.map(entry=>entry.history.buildId).filter((id):id is string=>Boolean(id));
 if(!ids.length)return [];
 const marks=ids.map(()=>"?").join(",");
 const result=await db.execute({sql:`SELECT s.id,s.uid,s.ign,s.character,s.status,s.created_at,s.reviewed_at,s.identity_verified,s.data,p.avatar_character,c.details AS current_calculation,c.score AS verified_score
  FROM submissions s JOIN players p ON p.uid=s.uid JOIN calculation_results c ON c.submission_id=s.id
  WHERE s.id IN (${marks}) AND s.status='approved' AND s.replaced_by IS NULL AND s.identity_verified=1
   AND c.engine_version=? AND c.data_version=? AND c.policy_id=COALESCE((SELECT v.policy_id FROM rotation_active a JOIN rotation_versions v ON v.id=a.version_id WHERE a.character=s.character),?)`,args:[...ids,ENGINE_VERSION,DATA_VERSION,POLICY_VERSION]});
 const byId=new Map(result.rows.map(row=>[String(row.id),row]));
 return entries.flatMap(entry=>{const row=byId.get(String(entry.history.buildId));return row?[rankedBuild(row,entry.history)]:[];});
}

export async function medalStandings(db:Client=database(),options:{refresh?:boolean}={}){
 if(options.refresh!==false)await refreshLeaderboardRankHistory(db);
 const marks=SUPPORTED.map(()=>"?").join(",");
 const snapshots=await db.execute({sql:`SELECT character,state FROM leaderboard_rank_history WHERE character IN (${marks})`,args:SUPPORTED});
 const candidates:Array<{id:string;uid:string;ign:string;character:string;rank:number;score:number}>=[];
 for(const snapshot of snapshots.rows){
  const character=String(snapshot.character),state=parseRankState(snapshot.state);
  for(const [uid,entry] of Object.entries(state))if(entry.active!==false&&Number(entry.rank)<=3&&entry.buildId)candidates.push({id:entry.buildId,uid,ign:entry.ign||uid,character,rank:Number(entry.rank),score:Number(entry.score)||0});
 }
 const uids=[...new Set(candidates.map(candidate=>candidate.uid))];
 const avatars=new Map<string,string|null>();
 if(uids.length){
  const rows=await db.execute({sql:`SELECT uid,avatar_character FROM players WHERE uid IN (${uids.map(()=>"?").join(",")})`,args:uids});
  for(const row of rows.rows)avatars.set(String(row.uid),row.avatar_character==null?null:String(row.avatar_character));
 }
 const standings=aggregateMedalStandings(candidates.map(row=>({...row,avatarCharacter:avatars.get(row.uid)||null})));
 const historyRows=standings.map(player=>({uid:player.uid,ign:player.ign,global_rank:player.rank,id:player.buildId,score:player.points,verified_score:player.points} as unknown as Row));
 const now=Date.now();
 let history:Record<string,RankHistoryEntry>|null,updatedAt:string;
 if(options.refresh===false){
  const saved=await db.execute({sql:"SELECT state,updated_at FROM leaderboard_rank_history WHERE character='__medal_standings__'",args:[]});
  history=parseRankState(saved.rows[0]?.state);
  updatedAt=String(saved.rows[0]?.updated_at||new Date(now).toISOString());
 }else{
  history=await synchronizeRankHistory("__medal_standings__",historyRows,db,false);
  const saved=await db.execute({sql:"SELECT updated_at FROM leaderboard_rank_history WHERE character='__medal_standings__'",args:[]});
  updatedAt=String(saved.rows[0]?.updated_at||new Date(now).toISOString());
 }
 return {updatedAt,players:standings.map(player=>{const saved=history?.[player.uid];return {...player,rankMovement:saved?.movement??null,rankSince:saved?.rankSince??null,rankTrackingSince:saved?.trackingSince??null,rankDays:saved?.rankSince?Math.max(0,Math.floor((now-Date.parse(saved.rankSince))/86400000)):null,bestRank:saved?.bestRank??player.rank,bestTop1Days:saved?.bestTop1Days??0,rankHasHistory:saved?.previousRank!==null&&saved?.previousRank!==undefined};})};
}

export async function listLeaderboard(options:{character?:string;search?:string;page?:number;rotationPolicyId?:string|null}={},db:Client=database()){
 const character=options.character||SUPPORTED[0],page=Number.isFinite(options.page)?Math.min(10000,Math.max(1,Math.floor(options.page||1))):1;
 if(!SUPPORTED.includes(character))return {builds:[],page,hasMore:false,scoring:scoringReadiness,rotationReady:false};
 const search=(options.search||"").slice(0,64).trim().toLowerCase();
 const policy=Object.prototype.hasOwnProperty.call(options,"rotationPolicyId")?{policy_id:options.rotationPolicyId}:(await db.execute({sql:"SELECT v.policy_id FROM rotation_active a JOIN rotation_versions v ON v.id=a.version_id WHERE a.character=?",args:[character]})).rows[0];
 const rotationReady=rotationPolicyReady(policy?.policy_id);
 const {state}=await ensureFreshRankHistory(character,db);
 const matching=Object.entries(state).filter(([uid,entry])=>entry.active!==false&&Number.isInteger(Number(entry.rank))&&(!search||uid.toLowerCase().includes(search)||(entry.ign||"").toLowerCase().includes(search))).sort((a,b)=>Number(a[1].rank)-Number(b[1].rank)||a[0].localeCompare(b[0]));
 const pageEntries=matching.slice((page-1)*20,page*20);
 const builds=await loadRankedBuilds(pageEntries.map(([uid,history])=>({character,uid,history})),db);
 return {builds,page,hasMore:matching.length>page*20,scoring:scoringReadiness,rotationReady};
}

export async function listLeaderboardRankChanges(limit=100,db:Client=database(),filters:{character?:string;player?:string;from?:string;to?:string}={}){
 const character=(filters.character||"").trim().slice(0,64).toLowerCase(),player=(filters.player||"").trim().slice(0,64).toLowerCase();
 const from=/^\d{4}-\d{2}-\d{2}$/.test(filters.from||"")?filters.from!:"",to=/^\d{4}-\d{2}-\d{2}$/.test(filters.to||"")?filters.to!:"";
 const result=await db.execute({sql:`WITH events AS (
  SELECT e.id,e.character,e.uid,COALESCE(s.ign,e.uid) AS ign,e.event_type,e.old_rank,e.new_rank,e.old_score,e.new_score,COALESCE(e.new_build_id,e.old_build_id,'') AS build_id,e.changed_at FROM leaderboard_rank_events e LEFT JOIN submissions s ON s.id=COALESCE(e.new_build_id,e.old_build_id)
  UNION ALL SELECT -h.id,h.character,h.uid,COALESCE(s.ign,h.uid),'moved',h.old_rank,h.new_rank,NULL,h.score,h.build_id,h.changed_at FROM leaderboard_rank_changes h LEFT JOIN submissions s ON s.id=h.build_id
 ) SELECT * FROM events WHERE (?='' OR lower(character)=?) AND (?='' OR instr(lower(uid||' '||ign),?)>0) AND (?='' OR date(changed_at)>=date(?)) AND (?='' OR date(changed_at)<=date(?))
 ORDER BY changed_at DESC,id DESC LIMIT ?`,args:[character,character,player,player,from,from,to,to,Math.min(200,Math.max(1,Math.floor(limit)))]});
 return {changes:result.rows.map(row=>({id:Number(row.id),character:String(row.character),uid:String(row.uid),ign:String(row.ign),type:String(row.event_type) as "moved"|"entered"|"left",oldRank:row.old_rank==null?null:Number(row.old_rank),newRank:row.new_rank==null?null:Number(row.new_rank),oldScore:row.old_score==null?null:Number(row.old_score),newScore:row.new_score==null?null:Number(row.new_score),buildId:String(row.build_id),changedAt:String(row.changed_at)}))};
}

export async function listPlayerRankHistory(uid:string,db:Client=database()){
 const result=await db.execute({sql:`SELECT e.id,e.character,e.event_type,e.old_rank,e.new_rank,e.old_score,e.new_score,COALESCE(e.new_build_id,e.old_build_id,'') AS build_id,e.changed_at FROM leaderboard_rank_events e WHERE e.uid=? ORDER BY e.changed_at DESC,e.id DESC LIMIT 100`,args:[uid]});
 return {events:result.rows.map(row=>({id:Number(row.id),character:String(row.character),type:String(row.event_type) as "moved"|"entered"|"left",oldRank:row.old_rank==null?null:Number(row.old_rank),newRank:row.new_rank==null?null:Number(row.new_rank),oldScore:row.old_score==null?null:Number(row.old_score),newScore:row.new_score==null?null:Number(row.new_score),buildId:String(row.build_id),changedAt:String(row.changed_at)}))};
}

export async function leaderboardConsistencyReport(db:Client=database()){
 const marks=SUPPORTED.map(()=>"?").join(",");
 const staleResult=await db.execute({sql:`SELECT s.id,s.uid,s.character,
  CASE WHEN c.submission_id IS NULL THEN 'No current score record'
       WHEN c.engine_version<>? THEN 'Score uses an older scoring engine'
       WHEN c.data_version<>? THEN 'Score uses outdated scoring data'
       ELSE 'Score uses an inactive rotation version' END AS reason
  FROM submissions s LEFT JOIN calculation_results c ON c.submission_id=s.id
  WHERE s.status='approved' AND s.replaced_by IS NULL AND s.identity_verified=1 AND s.character IN (${marks})
   AND (c.submission_id IS NULL OR c.engine_version<>? OR c.data_version<>? OR c.policy_id<>COALESCE((SELECT v.policy_id FROM rotation_active a JOIN rotation_versions v ON v.id=a.version_id WHERE a.character=s.character),?))
  ORDER BY s.created_at DESC,s.id LIMIT 100`,args:[ENGINE_VERSION,DATA_VERSION,...SUPPORTED,ENGINE_VERSION,DATA_VERSION,POLICY_VERSION]});
 const duplicateResult=await db.execute({sql:`SELECT uid,character,COUNT(*) AS count FROM submissions WHERE status='approved' AND replaced_by IS NULL GROUP BY uid,character HAVING COUNT(*)>1 ORDER BY count DESC,character,uid LIMIT 100`,args:[]});
 const medalResult=await db.execute({sql:`WITH candidates AS (
   SELECT s.id,s.uid,s.character,c.score,row_number() OVER(PARTITION BY s.uid,s.character ORDER BY c.score DESC,s.id ASC) AS player_best
   FROM submissions s JOIN calculation_results c ON c.submission_id=s.id
   WHERE s.status='approved' AND s.replaced_by IS NULL AND s.identity_verified=1 AND s.character IN (${marks})
    AND c.engine_version=? AND c.data_version=? AND c.policy_id=COALESCE((SELECT v.policy_id FROM rotation_active a JOIN rotation_versions v ON v.id=a.version_id WHERE a.character=s.character),?)
  ), ranked AS (SELECT uid,character,row_number() OVER(PARTITION BY character ORDER BY score DESC,id ASC) AS global_rank FROM candidates WHERE player_best=1)
  SELECT uid,SUM(CASE WHEN global_rank=1 THEN 1 ELSE 0 END) AS gold,SUM(CASE WHEN global_rank=2 THEN 1 ELSE 0 END) AS silver,SUM(CASE WHEN global_rank=3 THEN 1 ELSE 0 END) AS bronze FROM ranked WHERE global_rank<=3 GROUP BY uid`,args:[...SUPPORTED,ENGINE_VERSION,DATA_VERSION,POLICY_VERSION]});
 const expected=(await medalStandings(db)).players,profiles=new Map(medalResult.rows.map(row=>[String(row.uid),{gold:Number(row.gold),silver:Number(row.silver),bronze:Number(row.bronze)}]));
 const expectedByUid=new Map(expected.map(player=>[player.uid,{gold:player.gold,silver:player.silver,bronze:player.bronze}]));
 const medalMismatches=[...new Set([...profiles.keys(),...expectedByUid.keys()])].flatMap(uid=>{
  const profile=profiles.get(uid)||{gold:0,silver:0,bronze:0},standings=expectedByUid.get(uid)||{gold:0,silver:0,bronze:0};
  return profile.gold===standings.gold&&profile.silver===standings.silver&&profile.bronze===standings.bronze?[]:[{uid,profile,standings}];
 });
 return buildDataConsistencyReport({
  staleScores:staleResult.rows.map(row=>({id:String(row.id),uid:String(row.uid),character:String(row.character),reason:String(row.reason)})),
  duplicateBuilds:duplicateResult.rows.map(row=>({uid:String(row.uid),character:String(row.character),count:Number(row.count)})),
  medalMismatches
 });
}

export async function adminOverview(db: Client = database()) {
  const result = await db.execute(`SELECT
    (SELECT COUNT(*) FROM submissions WHERE status='pending') AS pending,
    (SELECT COUNT(*) FROM submissions WHERE status='approved' AND replaced_by IS NULL) AS approved,
    (SELECT COUNT(DISTINCT uid) FROM submissions WHERE status='approved' AND replaced_by IS NULL AND identity_verified=0) AS unverified,
    (SELECT COUNT(*) FROM players) AS players,
    (SELECT CAST((julianday('now')-julianday(MIN(created_at)))*24 AS INTEGER) FROM submissions WHERE status='pending') AS oldest_pending_hours`);
  return {...Object.fromEntries(Object.entries(result.rows[0]).filter(([key])=>key!=='oldest_pending_hours').map(([key,value])=>[key,Number(value)])),oldestPendingAgeHours:result.rows[0].oldest_pending_hours==null?null:Number(result.rows[0].oldest_pending_hours)} as {pending:number;approved:number;unverified:number;players:number;oldestPendingAgeHours:number|null};
}

export async function listAdminAudit(page = 1, search = "", db: Client = database(), reviewerFilter = "", actionFilter = "") {
  page = Math.min(10000,Math.max(1,Number.isFinite(page)?Math.floor(page):1));
  const query=search.trim().slice(0,64).toLowerCase();
  const reviewer=reviewerFilter.trim().slice(0,64).toLowerCase(),action=actionFilter.trim().slice(0,40).toLowerCase();
  const result=await db.execute({sql:`WITH events AS (
    SELECT id,submission_id,action,reviewer,note,created_at FROM moderation_events
    UNION ALL SELECT id,submission_id,action,reviewer,note,created_at FROM build_events
    UNION ALL SELECT id,submission_id,'rejected' AS action,reviewer,note,created_at FROM rejection_events
    UNION ALL SELECT id,submission_id,action,reviewer,note,created_at FROM admin_audit_events
  ) SELECT events.*,s.uid,s.character FROM events LEFT JOIN submissions s ON s.id=events.submission_id
    WHERE (?='' OR instr(lower(events.submission_id||' '||events.reviewer||' '||events.action),?)>0)
      AND (?='' OR lower(events.reviewer)=?) AND (?='' OR lower(events.action)=?)
    ORDER BY events.created_at DESC,events.id DESC LIMIT 21 OFFSET ?`,args:[query,query,reviewer,reviewer,action,action,(page-1)*20]});
  return {events:result.rows.slice(0,20).map(row=>({id:String(row.id),submissionId:String(row.submission_id),action:String(row.action),reviewer:String(row.reviewer),note:String(row.note),createdAt:String(row.created_at),uid:row.uid==null?null:String(row.uid),character:row.character==null?null:String(row.character)})),page,hasMore:result.rows.length>20};
}

export async function findPlayers(search = "", db: Client = database()) {
 const query=search.trim().slice(0,64);
 const result=await db.execute({sql:`SELECT uid,MAX(created_at) AS updated_at,COUNT(*) AS builds,COUNT(DISTINCT character) AS characters,(SELECT avatar_character FROM players p WHERE p.uid=s.uid) AS avatar_character,
 (SELECT character FROM submissions latest WHERE latest.uid=s.uid AND latest.status='approved' AND latest.replaced_by IS NULL ORDER BY created_at DESC,id DESC LIMIT 1) AS latest_character,
 (SELECT ign FROM submissions latest WHERE latest.uid=s.uid AND latest.status='approved' AND latest.replaced_by IS NULL ORDER BY created_at DESC,id DESC LIMIT 1) AS ign
 FROM submissions s WHERE status='approved' AND replaced_by IS NULL AND uid IN (SELECT uid FROM submissions WHERE status='approved' AND replaced_by IS NULL AND (?='' OR instr(lower(ign),lower(?))>0 OR instr(uid,?)>0))
 GROUP BY uid ORDER BY updated_at DESC,uid ASC LIMIT 21`,args:[query,query,query]});
 return {players:result.rows.slice(0,20).map(row=>({uid:String(row.uid),ign:String(row.ign),avatarCharacter:row.avatar_character==null?null:String(row.avatar_character),character:row.latest_character==null?null:String(row.latest_character),builds:Number(row.builds),characters:Number(row.characters),updatedAt:String(row.updated_at)})),hasMore:result.rows.length>20};
}

// Reuse the ranking policy, including one best build per verified UID and stable ties.
// Return only the fields needed on Home, never full Echo records or private submissions.
export async function homeRankings(db: Client = database()) {
 const configuration=await homeFeaturedSettings(db);
 const names=configuration.featured.map(item=>item.name);
 await refreshLeaderboardRankHistory(db,{characters:names});
 const snapshots=names.length?await db.execute({sql:`SELECT character,state FROM leaderboard_rank_history WHERE character IN (${names.map(()=>"?").join(",")})`,args:names}):{rows:[] as Row[]};
 const byCharacter=new Map(snapshots.rows.map(row=>[String(row.character),parseRankState(row.state)]));
 const entries=names.flatMap(character=>Object.entries(byCharacter.get(character)||{}).filter(([,entry])=>entry.active!==false).sort((a,b)=>Number(a[1].rank)-Number(b[1].rank)).slice(0,5).map(([uid,history])=>({character,uid,history})));
 const ranked=await loadRankedBuilds(entries,db);
 const byBuild=new Map(ranked.map(build=>[build.id,build]));
 const boards=names.map(character=>({character,players:entries.filter(entry=>entry.character===character).flatMap(entry=>{const build=byBuild.get(entry.history.buildId||"");return build?[{id:build.id,uid:build.uid,ign:build.ign,rank:build.rank!,score:build.score!}]:[]})}));
 const standings=await medalStandings(db);
 return {boards,featured:configuration.featured,topPlayers:standings.players,topPlayersUpdatedAt:standings.updatedAt};
}

export async function homeFeaturedSettings(db:Client=database()) {
 const supported=featuredResonators.map(character=>character.name);
 const fallback=latestResonators.map(character=>character.name);
 const result=await db.execute({sql:"SELECT value FROM app_settings WHERE key='home_latest_resonators'",args:[]});
 let saved:unknown;
 try{saved=JSON.parse(String(result.rows[0]?.value||'null'));}catch{saved=null;}
 const names=resolveHomeFeatured(saved,supported,fallback);
 const byName=new Map(featuredResonators.map(character=>[character.name,character]));
 return {selected:names,featured:names.map(name=>byName.get(name)!).filter(Boolean),options:featuredResonators.map(character=>({name:character.name,label:character.displayName||character.name,element:character.element}))};
}

export async function listAdminPlayers(options:{search?:string;character?:string;page?:number}={},db:Client=database()){
 const page=Math.min(10000,Math.max(1,Number.isFinite(options.page)?Math.floor(options.page||1):1));
 const query=(options.search||'').trim().slice(0,64),character=(options.character||'').trim().slice(0,64);
 const result=await db.execute({sql:`SELECT p.uid,p.identity_verified,p.verified_at,
 COALESCE((SELECT ign FROM submissions n WHERE n.uid=p.uid ORDER BY created_at DESC,id DESC LIMIT 1),p.uid) AS ign,
 COALESCE(MAX(s.created_at),p.created_at) AS updated_at,COUNT(s.id) AS builds,
 SUM(CASE WHEN s.status='approved' AND s.replaced_by IS NULL THEN 1 ELSE 0 END) AS approved,
 SUM(CASE WHEN s.status='pending' THEN 1 ELSE 0 END) AS pending,
 COUNT(DISTINCT s.character) AS characters
 FROM players p LEFT JOIN submissions s ON s.uid=p.uid AND s.status IN ('pending','approved') AND s.replaced_by IS NULL
 WHERE (?='' OR instr(p.uid,?)>0 OR EXISTS (SELECT 1 FROM submissions n WHERE n.uid=p.uid AND (instr(lower(n.ign),lower(?))>0 OR instr(lower(n.id),lower(?))>0)))
 AND (?='' OR EXISTS (SELECT 1 FROM submissions n WHERE n.uid=p.uid AND n.character=?))
 GROUP BY p.uid ORDER BY updated_at DESC,p.uid ASC LIMIT 21 OFFSET ?`,args:[query,query,query,query,character,character,(page-1)*20]});
 return {players:result.rows.slice(0,20).map(row=>({uid:String(row.uid),ign:String(row.ign),identityVerified:Boolean(row.identity_verified),verifiedAt:row.verified_at,builds:Number(row.builds),approved:Number(row.approved),pending:Number(row.pending),characters:Number(row.characters),updatedAt:String(row.updated_at)})),page,hasMore:result.rows.length>20};
}
export async function adminPlayerBuilds(uid:string,page=1,db:Client=database()){
 const player=await db.execute({sql:`SELECT uid,identity_verified,verified_at,
 COALESCE((SELECT ign FROM submissions s WHERE s.uid=p.uid ORDER BY created_at DESC,id DESC LIMIT 1),uid) AS ign,
 (SELECT COUNT(*) FROM submissions s WHERE s.uid=p.uid AND status='pending') AS pending,
 (SELECT COUNT(*) FROM submissions s WHERE s.uid=p.uid AND status='approved' AND replaced_by IS NULL) AS approved
 FROM players p WHERE uid=?`,args:[uid]});
 if(!player.rows.length)throw new HttpError(404,'Player UID not found.');
 const row=player.rows[0];
 return {...await listBuilds({uid,page,includePending:true},db),player:{uid:String(row.uid),ign:String(row.ign),identityVerified:Boolean(row.identity_verified),verifiedAt:row.verified_at,pending:Number(row.pending),approved:Number(row.approved)}};
}

