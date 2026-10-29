import {validateEchoSlot} from "../scanner/stat-validation.ts";
import {allowedSubstatCorrection} from "../scanner/substat-options.ts";
import {visualReadiness,assessmentReadiness} from "../scanner/scoring-readiness.ts";
import { latestResonators } from "../resonators.ts";
import { createHash, randomUUID } from "node:crypto";
import type { Client, Row } from "@libsql/client";
import { database } from "./database.ts";
import { HttpError, type SubmissionInput } from "./validation.ts";
import { DAMAGE_CORE_VERSION } from "./damage-core.ts";
import { assessSource } from "./source-evidence.mjs";
import { ENGINE_VERSION, DATA_VERSION, POLICY_VERSION, SUPPORTED, assessEquipment, identitiesFromReport } from "./scoring.mjs";
import sharp from "sharp";
import {OWNER_ROTATION_REQUIRED,AWAITING_ROTATION_POLICY} from "../game-data/scoring-policies.mjs";
import {scoreActiveRotation,recordRotationScore,applyPublishedRotation} from "./rotations/store.mjs";

export async function rateLimit(key: string, max: number, db: Client = database()) {
  const window = Math.floor(Date.now() / 60000);
  const result = await db.execute({
    sql: `INSERT INTO rate_limits(key,window,count) VALUES (?,?,1)
      ON CONFLICT(key) DO UPDATE SET
      count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,
      window=excluded.window RETURNING count`,
    args: [key, window],
  });
  if (key === "submission-global" && Number(result.rows[0].count) === 1) {
    await db.execute({ sql: "DELETE FROM rate_limits WHERE window<?", args: [window - 10] });
  }
  if (Number(result.rows[0].count) > max) throw new HttpError(429, "Too many requests. Wait one minute.");
}
export async function submit(input: SubmissionInput, db: Client = database(), requireSourceUid = false) {
  const sourceAssessment = await assessSource(input);
  const assessment = {...sourceAssessment, ...(sourceAssessment.statsVerified && input.sourceImage ? {cropEvidenceVersion:'source-crops/1'} : {})};
  if (requireSourceUid && assessment.reason.startsWith("Scoring worker busy")) throw new HttpError(429, "Scanner is busy. Please try again in a moment.");
  if (requireSourceUid && assessment.failure?.code==='OCR_SERVICE_UNAVAILABLE')throw new HttpError(503,assessment.failure.message);
  if (requireSourceUid && !assessment.statsVerified&&assessment.failure)throw new HttpError(400,assessment.failure.message);
  if (requireSourceUid && assessment.sourceUid !== input.uid) throw new HttpError(400, "Screenshot UID could not be confirmed. Upload a clear original card; UID cannot be changed.");
  if (requireSourceUid && !assessment.statsVerified) throw new HttpError(400, "Echo stats could not be verified against the screenshot. Values cannot be edited; upload a clear original card and scan again.");
  // Retain server-derived visual evidence. Client crops never establish scoring identity.
  const sourceCrops = assessment.statsVerified && input.sourceImage ? await Promise.all(input.slots.map(async (slot,index)=>({
    ...slot,
    portrait:await sharp(input.sourceImage).extract({left:22+index*374,top:650,width:192,height:182}).png().toBuffer(),
    sonata:await sharp(input.sourceImage).extract({left:264+index*374,top:660,width:56,height:56}).png().toBuffer(),
  }))) : input.slots;
  let data = {
    assessment,
    character: input.character,
    slots: requireSourceUid ? assessment.sourceSlots : input.slots.map(({ slot, cost, mainStat, substats }) => ({ slot, cost, mainStat, substats })),
    recognition: "unverified",
  };
  data=await applyPublishedRotation(db,input.character,data);
  const hash = createHash("sha256").update(input.uid).update(input.character.toLowerCase());
  for (const slot of sourceCrops) {
    hash.update(JSON.stringify([slot.cost.value, slot.mainStat.value, slot.substats.map(x => x.value)]));
    hash.update(slot.portrait).update(slot.sonata);
  }
  // A new scoring policy/evidence can be resubmitted; duplicates within it cannot.
  hash.update(data.assessment.eligible ? POLICY_VERSION : "unscored");
  const fingerprint = hash.digest("hex");
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const tx = await db.transaction("write");
  try {
    const duplicate = await tx.execute({ sql: "SELECT id FROM submissions WHERE fingerprint=?", args: [fingerprint] });
    if (duplicate.rows.length) throw new HttpError(409, "This build has already been submitted.");
    const recent = await tx.execute({ sql: "SELECT COUNT(*) AS count FROM submissions WHERE uid=? AND created_at>?", args: [input.uid, new Date(Date.now() - 60000).toISOString()] });
    if (Number(recent.rows[0].count) >= 10) throw new HttpError(429, "Please wait before submitting another build for this UID.");
    await tx.execute({ sql: "INSERT INTO players(uid,created_at) VALUES (?,?) ON CONFLICT(uid) DO NOTHING", args: [input.uid, createdAt] });
    await tx.execute({ sql: "INSERT INTO submissions(id,uid,ign,character,fingerprint,data,created_at,identity_verified) VALUES (?,?,?,?,?,?,?,(SELECT identity_verified FROM players WHERE uid=?))", args: [id, input.uid, input.ign, input.character, fingerprint, JSON.stringify(data), createdAt, input.uid] });
    for (const slot of sourceCrops) {
      for (const kind of ["portrait", "sonata"] as const) {
        await tx.execute({ sql: "INSERT INTO assets(id,submission_id,slot,kind,png) VALUES (?,?,?,?,?)", args: [`${id}-${slot.slot}-${kind}`, id, slot.slot, kind, slot[kind]] });
      }
    }
    await tx.commit();
    return { ok: true, id, status: "pending", createdAt, readiness:{...visualReadiness(assessment.visualReport||[],assessment.statsVerified===true),rolls:assessment.rollsVerified??(assessment.eligible?true:null),ready:data.assessment.eligible,awaitingRotation:assessmentReadiness(data.assessment).awaitingRotation,reason:data.assessment.reason} };
  } finally { tx.close(); }
}
export async function moderate(id: string, action: "approved" | "rejected", reviewer: string, note: string, identityVerified: boolean, db: Client = database(), allowUnranked = false) {
  const tx = await db.transaction("write");
  try {
    const now = new Date().toISOString();
    if (action === "rejected") {
      const saved = await tx.execute({ sql: "SELECT uid FROM submissions WHERE id=? AND status='pending'", args: [id] });
      if (!saved.rows.length) throw new HttpError(409, "Submission is missing or has already been reviewed.");
      await tx.execute({ sql: "INSERT INTO rejection_events VALUES (?,?,?,?,?)", args: [randomUUID(), id, reviewer, note, now] });
      for (const table of ["assets", "calculation_results", "build_events", "moderation_events", "rotation_run_scores"]) {
        await tx.execute({ sql: `DELETE FROM ${table} WHERE submission_id=?`, args: [id] });
      }
      await tx.execute({ sql: "DELETE FROM submissions WHERE id=?", args: [id] });
      await tx.execute({ sql: "DELETE FROM players WHERE uid=? AND identity_verified=0 AND NOT EXISTS (SELECT 1 FROM submissions WHERE uid=?)", args: [String(saved.rows[0].uid), String(saved.rows[0].uid)] });
      await tx.commit();
      return;
    }
    const pending=await tx.execute({sql:"SELECT uid,character,data FROM submissions WHERE id=? AND status='pending'",args:[id]});
    if(!pending.rows.length)throw new HttpError(409,"Submission is missing or has already been reviewed.");
    const pendingData=JSON.parse(String(pending.rows[0].data));
    const prepared=await applyPublishedRotation(tx,String(pending.rows[0].character),pendingData);
    if(prepared!==pendingData)await tx.execute({sql:"UPDATE submissions SET data=? WHERE id=? AND status='pending'",args:[JSON.stringify(prepared),id]});
    const assessed=prepared.assessment;
    if(!assessed?.eligible&&allowUnranked!==true)throw new HttpError(422,'Scoring is blocked. Resolve the Echo identities first, or explicitly approve this build as unranked.');
    if(!assessed?.eligible&&note.trim().length<10)throw new HttpError(400,'Explain why this build is being approved as unranked (at least 10 characters).');
    const uid=String(pending.rows[0].uid);
    if(identityVerified)await applyUidVerification(tx,uid,true,reviewer,note,now);
    // A review checkbox cannot revoke a previously verified UID. Revocation is explicit.
    const updated = await tx.execute({ sql: "UPDATE submissions SET status=?,reviewed_at=?,identity_verified=(SELECT identity_verified FROM players WHERE uid=?) WHERE id=? AND status='pending'", args: [action, now, uid, id] });
    if (updated.rowsAffected !== 1) throw new HttpError(409, "Submission is missing or has already been reviewed.");
    if (action === "approved") {
      const saved = await tx.execute({sql: "SELECT data FROM submissions WHERE id=?", args: [id]});
      const assessment = JSON.parse(String(saved.rows[0].data)).assessment;
      const calculation = assessment?.eligible ? await scoreActiveRotation(tx, String((await tx.execute({sql:'SELECT character FROM submissions WHERE id=?',args:[id]})).rows[0].character),JSON.parse(String(saved.rows[0].data))) || assessment.calculation : null;
      if (calculation && calculation.engineVersion === ENGINE_VERSION && calculation.dataVersion === DATA_VERSION && (calculation.policyId === POLICY_VERSION || calculation.rotationVersion) && Number.isFinite(calculation.score) && calculation.score > 0) {
        await tx.execute({sql: "INSERT INTO calculation_results(submission_id,score,engine_version,data_version,reference_case_version,verified_at,policy_id,details) VALUES (?,?,?,?,?,?,?,?)", args: [id,calculation.score,ENGINE_VERSION,DATA_VERSION,calculation.referenceCaseVersion,now,calculation.policyId,JSON.stringify(calculation)]});
        await recordRotationScore(tx,id,String((await tx.execute({sql:'SELECT character FROM submissions WHERE id=?',args:[id]})).rows[0].character),JSON.parse(String(saved.rows[0].data)),calculation,now);
      }
    }
    await tx.execute({ sql: "INSERT INTO moderation_events VALUES (?,?,?,?,?,?)", args: [randomUUID(), id, action, reviewer, (!assessed?.eligible?"Approved as unranked: ":"")+note, now] });
    await tx.commit();
  } finally { tx.close(); }
}
export const scoringReadiness = {
  enabled: true,
  reason: "Versioned permanent-passive S0/signature-R1 damage benchmark. Only approved, identity-verified builds with source-validated inputs are ranked.",
  engineVersion: ENGINE_VERSION, numericCoreVersion: DAMAGE_CORE_VERSION,
  dataVersion: DATA_VERSION, policyId: POLICY_VERSION, supportedCharacters: SUPPORTED, ownerRotationRequired: OWNER_ROTATION_REQUIRED,
  metric: "Expected standardized benchmark damage (not DPS)",
  missing: [],
};
export async function listBuilds(options: { search?: string; character?: string; id?: string; uid?: string; includePending?: boolean; page?: number; pending?: boolean } = {}, db: Client = database()) {
  const page = Number.isFinite(options.page) ? Math.min(10000, Math.max(1, Math.floor(options.page || 1))) : 1;
  const query = (options.search || "").slice(0, 64).trim();
  const character = (options.character || "").slice(0, 64).trim();
  const result = await db.execute({
    sql: `SELECT s.id,uid,ign,character,status,created_at,reviewed_at,identity_verified,data,
      CASE WHEN s.status='approved' AND identity_verified=1 AND c.engine_version='${ENGINE_VERSION}' AND c.data_version='${DATA_VERSION}' AND c.policy_id=COALESCE((SELECT v.policy_id FROM rotation_active a JOIN rotation_versions v ON v.id=a.version_id WHERE a.character=s.character),'${POLICY_VERSION}') THEN c.score ELSE NULL END AS verified_score
       ,CASE WHEN c.engine_version='${ENGINE_VERSION}' AND c.data_version='${DATA_VERSION}' AND c.policy_id=COALESCE((SELECT v.policy_id FROM rotation_active a JOIN rotation_versions v ON v.id=a.version_id WHERE a.character=s.character),'${POLICY_VERSION}') THEN c.details END AS current_calculation
      FROM submissions s LEFT JOIN calculation_results c ON c.submission_id=s.id WHERE (status=? OR (?=1 AND status IN ('pending','approved'))) AND (?='' OR instr(lower(ign),lower(?))>0 OR instr(uid,?)>0 OR instr(lower(s.id),lower(?))>0)
      AND (?='' OR character=?) AND (?='' OR s.id=?) AND (?='' OR uid=?)
      ORDER BY created_at DESC,s.id DESC LIMIT 21 OFFSET ?`,
    args: [options.pending ? "pending" : "approved", options.includePending?1:0, query, query, query, query, character, character, options.id || "", options.id || "", options.uid || "", options.uid || "", (page - 1) * 20],
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
      id: String(row.id), rank: row.global_rank == null ? null : Number(row.global_rank), uid: String(row.uid), ign: String(row.ign), character: String(row.character),
      status: String(row.status), createdAt: String(row.created_at), reviewedAt: row.reviewed_at,
      identityVerified: Boolean(row.identity_verified), score: row.verified_score === null ? null : Number(row.verified_score),
      data: data as { assessment?: {eligible: boolean; awaitingRotation?:boolean; reason: string; statsVerified?:boolean; rollsVerified?:boolean; visualReport?:import("../scanner/scoring-readiness.ts").VisualReportSlot[]; calculation?: { score: number; metric: string; policyId: string; engineVersion: string; dataVersion: string; finalStats?: {totalHp?:number;totalDef?:number;totalAtk?:number;totalCritRate?:number;totalCritDMG?:number;energyRegen?:number}; startState?: string; rotationOrigin?: string; rotation: string; weapon: string; conditions: string; identities: {echo: string; set: string; echoMatch?: {equivalentVariants?: string[]}}[] }}; slots: { slot: number; cost: { raw: string; value: string }; mainStat: { raw: string; value: string }; substats: { raw: string; value: string }[] }[] },
    }; }

export async function listLeaderboard(options: {character?: string;search?: string;page?: number} = {}, db: Client = database()) {
  const character = options.character || SUPPORTED[0];
  const page = Number.isFinite(options.page) ? Math.min(10000,Math.max(1,Math.floor(options.page || 1))) : 1;
  if (!SUPPORTED.includes(character)) return {builds: [],page,hasMore:false,scoring:scoringReadiness,rotationReady:false};
  const search = (options.search || "").slice(0,64).trim();
  const policy=(await db.execute({sql:'SELECT v.policy_id FROM rotation_active a JOIN rotation_versions v ON v.id=a.version_id WHERE a.character=?',args:[character]})).rows[0];
  const rotationReady=!OWNER_ROTATION_REQUIRED.includes(character)||Boolean(policy&&policy.policy_id!==AWAITING_ROTATION_POLICY);
  const result = await db.execute({sql: `WITH candidates AS (
    SELECT s.id,s.uid,s.ign,s.character,s.status,s.created_at,s.reviewed_at,s.identity_verified,s.data,c.details AS current_calculation,c.score AS verified_score,
    row_number() OVER (PARTITION BY s.uid,s.character ORDER BY c.score DESC,s.id ASC) AS player_best
    FROM submissions s JOIN calculation_results c ON c.submission_id=s.id
    WHERE s.status='approved' AND s.identity_verified=1 AND s.character=? AND c.engine_version=? AND c.data_version=? AND c.policy_id=COALESCE((SELECT v.policy_id FROM rotation_active a JOIN rotation_versions v ON v.id=a.version_id WHERE a.character=s.character),?)
  ), ranked AS (
    SELECT *,row_number() OVER (ORDER BY verified_score DESC,id ASC) AS global_rank FROM candidates WHERE player_best=1
  ) SELECT * FROM ranked WHERE (?='' OR instr(lower(ign),lower(?))>0 OR instr(uid,?)>0)
    ORDER BY global_rank ASC LIMIT 21 OFFSET ?`,args:[character,ENGINE_VERSION,DATA_VERSION,POLICY_VERSION,search,search,search,(page-1)*20]});
  return {builds:result.rows.slice(0,20).map(publicBuild),page,hasMore:result.rows.length>20,scoring:scoringReadiness,rotationReady};
}

async function applyUidVerification(tx: Awaited<ReturnType<Client['transaction']>>, uid:string, verified:boolean, reviewer:string, note:string, now:string) {
 const player=await tx.execute({sql:'SELECT identity_verified FROM players WHERE uid=?',args:[uid]});
 if(!player.rows.length)throw new HttpError(404,'Player UID not found.');
 const builds=await tx.execute({sql:'SELECT id FROM submissions WHERE uid=? AND identity_verified!=?',args:[uid,verified?1:0]});
 await tx.execute({sql:'UPDATE players SET identity_verified=?,verified_at=? WHERE uid=?',args:[verified?1:0,verified?now:null,uid]});
 for(const build of builds.rows){
  await tx.execute({sql:'UPDATE submissions SET identity_verified=? WHERE id=?',args:[verified?1:0,String(build.id)]});
  await tx.execute({sql:'INSERT INTO build_events VALUES (?,?,?,?,?,?)',args:[randomUUID(),String(build.id),verified?'identity_verified':'identity_unverified',reviewer,note,now]});
 }
 if(Boolean(player.rows[0].identity_verified)!==verified||builds.rows.length)await tx.execute({sql:'INSERT INTO admin_audit_events VALUES (?,?,?,?,?,?)',args:[randomUUID(),uid,verified?'player_verified':'player_unverified',reviewer,note,now]});
 return {updated:builds.rows.length};
}
export async function setPlayerVerification(id:string, verified:boolean, reviewer:string, note:string, db:Client=database()){
 const tx=await db.transaction('write');
 try{
  const selected=await tx.execute({sql:"SELECT uid FROM submissions WHERE id=? AND status='approved'",args:[id]});
  if(!selected.rows.length)throw new HttpError(404,'Approved build not found.');
  const result=await applyUidVerification(tx,String(selected.rows[0].uid),verified,reviewer,note,new Date().toISOString());
  await tx.commit();return result;
 }finally{tx.close();}
}
export async function setUidVerification(uid:string,verified:boolean,reviewer:string,note:string,db:Client=database()){
 const tx=await db.transaction('write');
 try{const result=await applyUidVerification(tx,uid,verified,reviewer,note,new Date().toISOString());await tx.commit();return result;}finally{tx.close();}
}

export async function adminOverview(db: Client = database()) {
  const result = await db.execute(`SELECT
    (SELECT COUNT(*) FROM submissions WHERE status='pending') AS pending,
    (SELECT COUNT(*) FROM submissions WHERE status='approved') AS approved,
    (SELECT COUNT(DISTINCT uid) FROM submissions WHERE status='approved' AND identity_verified=0) AS unverified,
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

export async function deleteBuild(id: string, reviewer: string, note: string, db: Client = database()) {
  const tx=await db.transaction('write');
  try {
    const saved=await tx.execute({sql:'SELECT uid FROM submissions WHERE id=?',args:[id]});
    if(!saved.rows.length)throw new HttpError(404,'Submission not found. It may have already been deleted.');
    // Preserve decisions in a ledger without foreign keys before removing evidence.
    for(const table of ['moderation_events','build_events']) await tx.execute({sql:`INSERT INTO admin_audit_events SELECT id,submission_id,action,reviewer,note,created_at FROM ${table} WHERE submission_id=?`,args:[id]});
    await tx.execute({sql:'INSERT INTO admin_audit_events VALUES (?,?,?,?,?,?)',args:[randomUUID(),id,'deleted',reviewer,note,new Date().toISOString()]});
    for(const table of ['assets','calculation_results','build_events','moderation_events','rotation_run_scores']) await tx.execute({sql:`DELETE FROM ${table} WHERE submission_id=?`,args:[id]});
    await tx.execute({sql:'DELETE FROM submissions WHERE id=?',args:[id]});
    const uid=String(saved.rows[0].uid);
    await tx.execute({sql:'DELETE FROM players WHERE uid=? AND identity_verified=0 AND NOT EXISTS (SELECT 1 FROM submissions WHERE uid=?)',args:[uid,uid]});
    await tx.commit();
    return {deleted:id};
  }finally{tx.close();}
}

export async function findPlayers(search = "", db: Client = database()) {
 const query=search.trim().slice(0,64);
 const result=await db.execute({sql:`SELECT uid,MAX(created_at) AS updated_at,COUNT(*) AS builds,COUNT(DISTINCT character) AS characters,
 (SELECT ign FROM submissions latest WHERE latest.uid=s.uid AND latest.status='approved' ORDER BY created_at DESC,id DESC LIMIT 1) AS ign
 FROM submissions s WHERE status='approved' AND uid IN (SELECT uid FROM submissions WHERE status='approved' AND (?='' OR instr(lower(ign),lower(?))>0 OR instr(uid,?)>0))
 GROUP BY uid ORDER BY updated_at DESC,uid ASC LIMIT 21`,args:[query,query,query]});
 return {players:result.rows.slice(0,20).map(row=>({uid:String(row.uid),ign:String(row.ign),builds:Number(row.builds),characters:Number(row.characters),updatedAt:String(row.updated_at)})),hasMore:result.rows.length>20};
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
 SUM(CASE WHEN s.status='approved' THEN 1 ELSE 0 END) AS approved,
 SUM(CASE WHEN s.status='pending' THEN 1 ELSE 0 END) AS pending,
 COUNT(DISTINCT s.character) AS characters
 FROM players p LEFT JOIN submissions s ON s.uid=p.uid AND s.status IN ('pending','approved')
 WHERE (?='' OR instr(p.uid,?)>0 OR EXISTS (SELECT 1 FROM submissions n WHERE n.uid=p.uid AND (instr(lower(n.ign),lower(?))>0 OR instr(lower(n.id),lower(?))>0)))
 AND (?='' OR EXISTS (SELECT 1 FROM submissions n WHERE n.uid=p.uid AND n.character=?))
 GROUP BY p.uid ORDER BY updated_at DESC,p.uid ASC LIMIT 21 OFFSET ?`,args:[query,query,query,query,character,character,(page-1)*20]});
 return {players:result.rows.slice(0,20).map(row=>({uid:String(row.uid),ign:String(row.ign),identityVerified:Boolean(row.identity_verified),verifiedAt:row.verified_at,builds:Number(row.builds),approved:Number(row.approved),pending:Number(row.pending),characters:Number(row.characters),updatedAt:String(row.updated_at)})),page,hasMore:result.rows.length>20};
}
export async function adminPlayerBuilds(uid:string,page=1,db:Client=database()){
 const player=await db.execute({sql:`SELECT uid,identity_verified,verified_at,
 COALESCE((SELECT ign FROM submissions s WHERE s.uid=p.uid ORDER BY created_at DESC,id DESC LIMIT 1),uid) AS ign,
 (SELECT COUNT(*) FROM submissions s WHERE s.uid=p.uid AND status='pending') AS pending,
 (SELECT COUNT(*) FROM submissions s WHERE s.uid=p.uid AND status='approved') AS approved
 FROM players p WHERE uid=?`,args:[uid]});
 if(!player.rows.length)throw new HttpError(404,'Player UID not found.');
 const row=player.rows[0];
 return {...await listBuilds({uid,page,includePending:true},db),player:{uid:String(row.uid),ign:String(row.ign),identityVerified:Boolean(row.identity_verified),verifiedAt:row.verified_at,pending:Number(row.pending),approved:Number(row.approved)}};
}

/** A moderator attests the corrected numeric OCR value. Original OCR remains in the audit ledger. */
export async function correctEchoSubstat(id:string, slot:number, position:number, expected:string, replacement:string, reviewer:string, note:string, db:Client=database()){
 if(!Number.isInteger(slot)||slot<1||slot>5||!Number.isInteger(position)||position<1||position>5)throw new HttpError(400,'Invalid Echo or substat position.');
 if(!allowedSubstatCorrection(replacement))throw new HttpError(400,'Replacement must be a pinned legal Echo substat roll.');
 if(reviewer.trim().length<2||reviewer.length>64||note.length>500)throw new HttpError(400,'Valid reviewer and correction note required.');
 const tx=await db.transaction('write');
 try{
  const found=await tx.execute({sql:'SELECT uid,character,data,status,identity_verified FROM submissions WHERE id=?',args:[id]});
  if(!found.rows.length)throw new HttpError(404,'Submission not found.');
  const row=found.rows[0];
  if(String(row.status)!=='pending')throw new HttpError(409,'Only pending submissions may receive corrections.');
  const data=JSON.parse(String(row.data));
  const target=data.slots?.[slot-1],field=target?.substats?.[position-1];
  if(!field||field.value!==expected)throw new HttpError(409,'Stored reading changed. Refresh before correcting.');
  if(expected===replacement)throw new HttpError(400,'Choose a different roll value.');
  const oldType=String(expected).replace(/[-+]?\d+(?:\.\d+)?%?\s*$/,'').trim();
  const newType=String(replacement).replace(/[-+]?\d+(?:\.\d+)?%?\s*$/,'').trim();
  if(oldType!==newType||expected.includes('%')!==replacement.includes('%'))throw new HttpError(422,'Correction must retain the original substat type and unit.');
  const revised=structuredClone(data);
  revised.slots[slot-1].substats[position-1]={...field,value:replacement};
  const issues=revised.slots.flatMap((s:Parameters<typeof validateEchoSlot>[0])=>validateEchoSlot(s));
  const invalid=issues.find((issue:{code:string;message:string})=>issue.code!=='UNSUPPORTED_ROLL');
  if(invalid)throw new HttpError(422,'Invalid Echo combination: '+invalid.message);
  const at=new Date().toISOString();
  revised.substatCorrections=[...(revised.substatCorrections||[]),{slot,position,original:expected,replacement,reviewer:reviewer.trim(),note:note.trim()||'Moderator confirmed the correct in-game roll.',at,adminVerifiedSubstat:true}];
  const originalSourceField=revised.assessment?.sourceSlots?.[slot-1]?.substats?.[position-1];
  if(!originalSourceField||originalSourceField.value!==expected||revised.assessment?.statsVerified!==true||!revised.assessment.sourceHash||revised.assessment.sourceUid!==String(row.uid))throw new HttpError(422,'Original server-verified source evidence is missing or inconsistent.');
  const scoringSlots=structuredClone(revised.assessment.sourceSlots);
  scoringSlots[slot-1].substats[position-1]={...originalSourceField,value:replacement};
  revised.slots=scoringSlots;
  revised.assessment={...revised.assessment,sourceSlots:scoringSlots,rollsVerified:issues.length===0,catalogReview:issues.length>0,eligible:false,awaitingRotation:false,calculation:undefined};
  let reason='Another Echo substat still has an unsupported roll.';
  if(issues.length===0){
   if(revised.assessment.maxMainStatsVerified!==true)reason='Max-level main stats are not verified.';
   else if(!SUPPORTED.includes(String(row.character)))reason='This character has no supported scoring policy.';
   else {
    try{
     const identities=identitiesFromReport(revised.assessment.visualReport||[]);
     const equipment=await assessEquipment(String(row.character),scoringSlots,identities);
     revised.assessment={...revised.assessment,...equipment,sourceSlots:scoringSlots,rollsVerified:true,catalogReview:false};
     const prepared=await applyPublishedRotation(tx,String(row.character),revised);
     revised.assessment=prepared.assessment;
     reason=revised.assessment.reason||'Admin-confirmed legal roll; equipment verified.';
    }catch(error){reason=error instanceof Error?error.message:'Echo identities or scoring inputs remain unverified.';}
   }
  }
  let calculation=null;
  if(revised.assessment.eligible===true){
   try{calculation=await scoreActiveRotation(tx,String(row.character),revised)||revised.assessment.calculation||null;}
   catch(error){reason=error instanceof Error?error.message:'Score calculation failed.';}
  }
  const activePolicy=(await tx.execute({sql:'SELECT v.policy_id FROM rotation_active a JOIN rotation_versions v ON v.id=a.version_id WHERE a.character=?',args:[String(row.character)]})).rows[0];
  const requiredPolicy=activePolicy?String(activePolicy.policy_id):POLICY_VERSION;
  const validScore=calculation&&calculation.engineVersion===ENGINE_VERSION&&calculation.dataVersion===DATA_VERSION&&calculation.policyId===requiredPolicy&&Number.isFinite(calculation.score)&&calculation.score>0;
  const verified=Number(row.identity_verified)===1;
  const ranked=Boolean(validScore&&verified);
  if(!ranked){
   revised.assessment={...revised.assessment,reason:!verified&&validScore?'UID verification is still required before ranking.':!validScore&&revised.assessment.eligible===true?'A score matching the currently published rotation policy is required.':reason};
  }
  await tx.execute({sql:"UPDATE submissions SET data=?,status=?,reviewed_at=CASE WHEN ?='approved' THEN ? ELSE reviewed_at END WHERE id=? AND status='pending'",args:[JSON.stringify(revised),ranked?'approved':'pending',ranked?'approved':'pending',at,id]});
  await tx.execute({sql:'DELETE FROM calculation_results WHERE submission_id=?',args:[id]});
  if(ranked){
   await tx.execute({sql:'INSERT INTO calculation_results(submission_id,score,engine_version,data_version,reference_case_version,verified_at,policy_id,details) VALUES (?,?,?,?,?,?,?,?)',args:[id,calculation.score,ENGINE_VERSION,DATA_VERSION,calculation.referenceCaseVersion,at,calculation.policyId,JSON.stringify(calculation)]});
   await recordRotationScore(tx,id,String(row.character),revised,calculation,at);
   await tx.execute({sql:'INSERT INTO moderation_events VALUES (?,?,?,?,?,?)',args:[randomUUID(),id,'approved',reviewer.trim(),'Auto-approved after moderator-confirmed legal substat correction. '+(note.trim()||'Verified against the in-game roll.'),at]});
  }
  await tx.execute({sql:'INSERT INTO admin_audit_events VALUES (?,?,?,?,?,?)',args:[randomUUID(),id,'substat_corrected',reviewer.trim(),'Echo '+slot+', substat '+position+': '+expected+' -> '+replacement+'. '+(note.trim()||'Moderator confirmed the correct in-game roll.'),at]});
  await tx.commit();
  return {slot,position,original:expected,replacement,ranked,reason:ranked?'Approved and ranked automatically.':revised.assessment.reason};
 }finally{tx.close();}
}
