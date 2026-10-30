// Read-only data access: never import OCR, image processing or the scoring engine.
import type {Client,Row} from '@libsql/client';
import {database} from './database.ts';
import {HttpError} from './validation.ts';
import {featuredResonators,latestResonators} from '../resonators.ts';
import {ENGINE_VERSION,DATA_VERSION,POLICY_VERSION,SUPPORTED} from './scoring-versions.mjs';
import {scoringReadiness} from './scoring-info.ts';
import {rotationPolicyReady} from '../game-data/scoring-policies.mjs';
export async function listBuilds(options: { search?: string; character?: string; id?: string; uid?: string; includePending?: boolean; page?: number; pending?: boolean; patchMajor?: string } = {}, db: Client = database()) {
  const page = Number.isFinite(options.page) ? Math.min(10000, Math.max(1, Math.floor(options.page || 1))) : 1;
  const query = (options.search || "").slice(0, 64).trim();
  const character = (options.character || "").slice(0, 64).trim();
  const patchMajor = (options.patchMajor || "").match(/^\d{1,2}$/)?.[0] || "";
  const patchCharacters = patchMajor ? featuredResonators.filter(item => item.patchVersion.startsWith(patchMajor + ".")).map(item => item.name) : [];
  if (patchMajor && !patchCharacters.length) return {builds:[],page,hasMore:false,scoring:scoringReadiness};
  const patchSql = patchMajor ? ` AND s.character IN (${patchCharacters.map(() => "?").join(",")})` : "";
  const result = await db.execute({
    sql: `SELECT s.id,uid,ign,character,status,created_at,reviewed_at,identity_verified,data,(SELECT avatar_character FROM players p WHERE p.uid=s.uid) AS avatar_character,
      CASE WHEN s.status='approved' AND identity_verified=1 AND c.engine_version='${ENGINE_VERSION}' AND c.data_version='${DATA_VERSION}' AND c.policy_id=COALESCE((SELECT v.policy_id FROM rotation_active a JOIN rotation_versions v ON v.id=a.version_id WHERE a.character=s.character),'${POLICY_VERSION}') THEN c.score ELSE NULL END AS verified_score
       ,CASE WHEN c.engine_version='${ENGINE_VERSION}' AND c.data_version='${DATA_VERSION}' AND c.policy_id=COALESCE((SELECT v.policy_id FROM rotation_active a JOIN rotation_versions v ON v.id=a.version_id WHERE a.character=s.character),'${POLICY_VERSION}') THEN c.details END AS current_calculation
      FROM submissions s LEFT JOIN calculation_results c ON c.submission_id=s.id WHERE replaced_by IS NULL AND (status=? OR (?=1 AND status IN ('pending','approved'))) AND (?='' OR instr(lower(ign),lower(?))>0 OR instr(uid,?)>0 OR instr(lower(s.id),lower(?))>0)
      AND (?='' OR character=?) AND (?='' OR s.id=?) AND (?='' OR uid=?)${patchSql}
      ORDER BY created_at DESC,s.id DESC LIMIT 21 OFFSET ?`,
    args: [options.pending ? "pending" : "approved", options.includePending?1:0, query, query, query, query, character, character, options.id || "", options.id || "", options.uid || "", options.uid || "", ...patchCharacters, (page - 1) * 20],
  });
  return {
    builds: result.rows.slice(0, 20).map(publicBuild),
    page, hasMore: result.rows.length > 20, scoring: scoringReadiness,
  };
}

function publicBuild(row: Row) {
 const data=JSON.parse(String(row.data));
 if(row.current_calculation){data.assessment={...data.assessment,calculation:JSON.parse(String(row.current_calculation))};}
 return {
      id: String(row.id), rank: row.global_rank == null ? null : Number(row.global_rank), uid: String(row.uid), ign: String(row.ign), character: String(row.character), avatarCharacter: row.avatar_character == null ? null : String(row.avatar_character),
      status: String(row.status), createdAt: String(row.created_at), reviewedAt: row.reviewed_at,
      identityVerified: Boolean(row.identity_verified), score: row.verified_score === null ? null : Number(row.verified_score),
      data: data as { assessment?: {eligible: boolean; awaitingRotation?:boolean; reason: string; statsVerified?:boolean; rollsVerified?:boolean; sourceSlots?:{slot:number;substats:{raw?:string;value:string}[]}[]; originalSourceSlots?:{slot:number;substats:{raw?:string;value:string}[]}[]; visualReport?:import("../scanner/scoring-readiness.ts").VisualReportSlot[]; calculation?: { score: number; metric: string; policyId: string; engineVersion: string; dataVersion: string; finalStats?: Record<string,number>; startState?: string; rotationOrigin?: string; rotation: string; weapon: string; conditions: string; identities: {echo: string; set: string; echoMatch?: {equivalentVariants?: string[]}}[] }}; slots: { slot: number; cost: { raw: string; value: string }; mainStat: { raw: string; value: string }; substats: { raw: string; value: string }[] }[] },
    }; }

export async function listLeaderboard(options: {character?: string;search?: string;page?: number} = {}, db: Client = database()) {
  const character = options.character || SUPPORTED[0];
  const page = Number.isFinite(options.page) ? Math.min(10000,Math.max(1,Math.floor(options.page || 1))) : 1;
  if (!SUPPORTED.includes(character)) return {builds: [],page,hasMore:false,scoring:scoringReadiness,rotationReady:false};
  const search = (options.search || "").slice(0,64).trim();
  const policy=(await db.execute({sql:'SELECT v.policy_id FROM rotation_active a JOIN rotation_versions v ON v.id=a.version_id WHERE a.character=?',args:[character]})).rows[0];
  const rotationReady=rotationPolicyReady(policy?.policy_id);
  const result = await db.execute({sql: `WITH candidates AS (
    SELECT s.id,s.uid,s.ign,s.character,s.status,s.created_at,s.reviewed_at,s.identity_verified,s.data,p.avatar_character,c.details AS current_calculation,c.score AS verified_score,
    row_number() OVER (PARTITION BY s.uid,s.character ORDER BY c.score DESC,s.id ASC) AS player_best
    FROM submissions s JOIN players p ON p.uid=s.uid JOIN calculation_results c ON c.submission_id=s.id
    WHERE s.status='approved' AND s.replaced_by IS NULL AND s.identity_verified=1 AND s.character=? AND c.engine_version=? AND c.data_version=? AND c.policy_id=COALESCE((SELECT v.policy_id FROM rotation_active a JOIN rotation_versions v ON v.id=a.version_id WHERE a.character=s.character),?)
  ), ranked AS (
    SELECT *,row_number() OVER (ORDER BY verified_score DESC,id ASC) AS global_rank FROM candidates WHERE player_best=1
  ) SELECT * FROM ranked WHERE (?='' OR instr(lower(ign),lower(?))>0 OR instr(uid,?)>0)
    ORDER BY global_rank ASC LIMIT 21 OFFSET ?`,args:[character,ENGINE_VERSION,DATA_VERSION,POLICY_VERSION,search,search,search,(page-1)*20]});
  return {builds:result.rows.slice(0,20).map(publicBuild),page,hasMore:result.rows.length>20,scoring:scoringReadiness,rotationReady};
}

export async function adminOverview(db: Client = database()) {
  const result = await db.execute(`SELECT
    (SELECT COUNT(*) FROM submissions WHERE status='pending') AS pending,
    (SELECT COUNT(*) FROM submissions WHERE status='approved' AND replaced_by IS NULL) AS approved,
    (SELECT COUNT(DISTINCT uid) FROM submissions WHERE status='approved' AND replaced_by IS NULL AND identity_verified=0) AS unverified,
    (SELECT COUNT(*) FROM players) AS players`);
  return Object.fromEntries(Object.entries(result.rows[0]).map(([key,value])=>[key,Number(value)])) as {pending:number;approved:number;unverified:number;players:number};
}

export async function listAdminAudit(page = 1, search = "", db: Client = database()) {
  page = Math.min(10000,Math.max(1,Number.isFinite(page)?Math.floor(page):1));
  const query=search.trim().slice(0,64).toLowerCase();
  const result=await db.execute({sql:`WITH events AS (
    SELECT id,submission_id,action,reviewer,note,created_at FROM moderation_events
    UNION ALL SELECT id,submission_id,action,reviewer,note,created_at FROM build_events
    UNION ALL SELECT id,submission_id,'rejected' AS action,reviewer,note,created_at FROM rejection_events
    UNION ALL SELECT id,submission_id,action,reviewer,note,created_at FROM admin_audit_events
  ) SELECT * FROM events WHERE (?='' OR instr(lower(submission_id||' '||reviewer||' '||action),?)>0)
    ORDER BY created_at DESC,id DESC LIMIT 21 OFFSET ?`,args:[query,query,(page-1)*20]});
  return {events:result.rows.slice(0,20).map(row=>({id:String(row.id),submissionId:String(row.submission_id),action:String(row.action),reviewer:String(row.reviewer),note:String(row.note),createdAt:String(row.created_at)})),page,hasMore:result.rows.length>20};
}

export async function findPlayers(search = "", db: Client = database()) {
 const query=search.trim().slice(0,64);
 const result=await db.execute({sql:`SELECT uid,MAX(created_at) AS updated_at,COUNT(*) AS builds,COUNT(DISTINCT character) AS characters,(SELECT avatar_character FROM players p WHERE p.uid=s.uid) AS avatar_character,
 (SELECT ign FROM submissions latest WHERE latest.uid=s.uid AND latest.status='approved' AND latest.replaced_by IS NULL ORDER BY created_at DESC,id DESC LIMIT 1) AS ign
 FROM submissions s WHERE status='approved' AND replaced_by IS NULL AND uid IN (SELECT uid FROM submissions WHERE status='approved' AND replaced_by IS NULL AND (?='' OR instr(lower(ign),lower(?))>0 OR instr(uid,?)>0))
 GROUP BY uid ORDER BY updated_at DESC,uid ASC LIMIT 21`,args:[query,query,query]});
 return {players:result.rows.slice(0,20).map(row=>({uid:String(row.uid),ign:String(row.ign),avatarCharacter:row.avatar_character==null?null:String(row.avatar_character),builds:Number(row.builds),characters:Number(row.characters),updatedAt:String(row.updated_at)})),hasMore:result.rows.length>20};
}

// Reuse the ranking policy, including one best build per verified UID and stable ties.
// Return only the fields needed on Home, never full Echo records or private submissions.
export async function homeRankings(db: Client = database()) {
 const boards=await Promise.all(latestResonators.map(async character=>{
  const result=await listLeaderboard({character:character.name},db);
  return {character:character.name,players:result.builds.slice(0,5).map(build=>({id:build.id,uid:build.uid,ign:build.ign,rank:build.rank!,score:build.score!}))};
 }));
 return {boards};
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

