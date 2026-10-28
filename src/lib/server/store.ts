import { createHash, randomUUID } from "node:crypto";
import type { Client, Row } from "@libsql/client";
import { database } from "./database.ts";
import { HttpError, type SubmissionInput } from "./validation.ts";
import { DAMAGE_CORE_VERSION } from "./damage-core.ts";
import { assessSource } from "./source-evidence.mjs";
import { ENGINE_VERSION, DATA_VERSION, POLICY_VERSION, SUPPORTED } from "./scoring.mjs";

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
  const assessment = await assessSource(input);
  if (requireSourceUid && assessment.reason.startsWith("Scoring worker busy")) throw new HttpError(429, "Scanner is busy. Please try again in a moment.");
  if (requireSourceUid && assessment.sourceUid !== input.uid) throw new HttpError(400, "Screenshot UID could not be confirmed. Upload a clear original card; UID cannot be changed.");
  if (requireSourceUid && !assessment.statsVerified) throw new HttpError(400, "Echo stats could not be verified against the screenshot. Values cannot be edited; upload a clear original card and scan again.");
  const data = {
    assessment,
    character: input.character,
    slots: requireSourceUid ? assessment.sourceSlots : input.slots.map(({ slot, cost, mainStat, substats }) => ({ slot, cost, mainStat, substats })),
    recognition: "unverified",
  };
  const hash = createHash("sha256").update(input.uid).update(input.character.toLowerCase());
  for (const slot of input.slots) {
    hash.update(JSON.stringify([slot.cost.value, slot.mainStat.value, slot.substats.map(x => x.value)]));
    hash.update(slot.portrait).update(slot.sonata);
  }
  // A new scoring policy/evidence can be resubmitted; duplicates within it cannot.
  hash.update(assessment.eligible ? POLICY_VERSION : "unscored");
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
    await tx.execute({ sql: "INSERT INTO submissions(id,uid,ign,character,fingerprint,data,created_at) VALUES (?,?,?,?,?,?,?)", args: [id, input.uid, input.ign, input.character, fingerprint, JSON.stringify(data), createdAt] });
    for (const slot of input.slots) {
      for (const kind of ["portrait", "sonata"] as const) {
        await tx.execute({ sql: "INSERT INTO assets(id,submission_id,slot,kind,png) VALUES (?,?,?,?,?)", args: [`${id}-${slot.slot}-${kind}`, id, slot.slot, kind, slot[kind]] });
      }
    }
    await tx.commit();
    return { ok: true, id, status: "pending", createdAt };
  } finally { tx.close(); }
}
export async function moderate(id: string, action: "approved" | "rejected", reviewer: string, note: string, identityVerified: boolean, db: Client = database()) {
  const tx = await db.transaction("write");
  try {
    const now = new Date().toISOString();
    if (action === "rejected") {
      const saved = await tx.execute({ sql: "SELECT uid FROM submissions WHERE id=? AND status='pending'", args: [id] });
      if (!saved.rows.length) throw new HttpError(409, "Submission is missing or has already been reviewed.");
      await tx.execute({ sql: "INSERT INTO rejection_events VALUES (?,?,?,?,?)", args: [randomUUID(), id, reviewer, note, now] });
      for (const table of ["assets", "calculation_results", "build_events", "moderation_events"]) {
        await tx.execute({ sql: `DELETE FROM ${table} WHERE submission_id=?`, args: [id] });
      }
      await tx.execute({ sql: "DELETE FROM submissions WHERE id=?", args: [id] });
      await tx.execute({ sql: "DELETE FROM players WHERE uid=? AND NOT EXISTS (SELECT 1 FROM submissions WHERE uid=?)", args: [String(saved.rows[0].uid), String(saved.rows[0].uid)] });
      await tx.commit();
      return;
    }
    const updated = await tx.execute({ sql: "UPDATE submissions SET status=?,reviewed_at=?,identity_verified=? WHERE id=? AND status='pending'", args: [action, now, identityVerified ? 1 : 0, id] });
    if (updated.rowsAffected !== 1) throw new HttpError(409, "Submission is missing or has already been reviewed.");
    if (action === "approved") {
      const saved = await tx.execute({sql: "SELECT data FROM submissions WHERE id=?", args: [id]});
      const assessment = JSON.parse(String(saved.rows[0].data)).assessment;
      const calculation = assessment?.eligible ? assessment.calculation : null;
      if (calculation && calculation.engineVersion === ENGINE_VERSION && calculation.dataVersion === DATA_VERSION && calculation.policyId === POLICY_VERSION && Number.isFinite(calculation.score) && calculation.score > 0) {
        await tx.execute({sql: "INSERT INTO calculation_results(submission_id,score,engine_version,data_version,reference_case_version,verified_at,policy_id,details) VALUES (?,?,?,?,?,?,?,?)", args: [id,calculation.score,ENGINE_VERSION,DATA_VERSION,calculation.referenceCaseVersion,now,POLICY_VERSION,JSON.stringify(calculation)]});
      }
    }
    await tx.execute({ sql: "INSERT INTO moderation_events VALUES (?,?,?,?,?,?)", args: [randomUUID(), id, action, reviewer, note, now] });
    await tx.commit();
  } finally { tx.close(); }
}
export const scoringReadiness = {
  enabled: true,
  reason: "Versioned permanent-passive S0/signature-R1 damage benchmark. Only approved, identity-verified builds with source-validated inputs are ranked.",
  engineVersion: ENGINE_VERSION, numericCoreVersion: DAMAGE_CORE_VERSION,
  dataVersion: DATA_VERSION, policyId: POLICY_VERSION, supportedCharacters: SUPPORTED,
  metric: "Expected standardized benchmark damage (not DPS)",
  missing: [],
};
export async function listBuilds(options: { search?: string; character?: string; id?: string; page?: number; pending?: boolean } = {}, db: Client = database()) {
  const page = Number.isFinite(options.page) ? Math.min(10000, Math.max(1, Math.floor(options.page || 1))) : 1;
  const query = (options.search || "").slice(0, 64).trim();
  const character = (options.character || "").slice(0, 64).trim();
  const result = await db.execute({
    sql: `SELECT s.id,uid,ign,character,status,created_at,reviewed_at,identity_verified,data,
      CASE WHEN s.status='approved' AND identity_verified=1 AND c.engine_version='${ENGINE_VERSION}' AND c.data_version='${DATA_VERSION}' AND c.policy_id='${POLICY_VERSION}' THEN c.score ELSE NULL END AS verified_score
      FROM submissions s LEFT JOIN calculation_results c ON c.submission_id=s.id WHERE status=? AND (?='' OR instr(lower(ign),lower(?))>0 OR instr(uid,?)>0 OR instr(lower(s.id),lower(?))>0)
      AND (?='' OR character=?) AND (?='' OR s.id=?)
      ORDER BY created_at DESC,s.id DESC LIMIT 21 OFFSET ?`,
    args: [options.pending ? "pending" : "approved", query, query, query, query, character, character, options.id || "", options.id || "", (page - 1) * 20],
  });
  return {
    builds: result.rows.slice(0, 20).map(publicBuild),
    page, hasMore: result.rows.length > 20, scoring: scoringReadiness,
  };
}

function publicBuild(row: Row) { return {
      id: String(row.id), uid: String(row.uid), ign: String(row.ign), character: String(row.character),
      status: String(row.status), createdAt: String(row.created_at), reviewedAt: row.reviewed_at,
      identityVerified: Boolean(row.identity_verified), score: row.verified_score === null ? null : Number(row.verified_score),
      data: JSON.parse(String(row.data)) as { assessment?: {eligible: boolean; reason: string; calculation?: { score: number; metric: string; policyId: string; engineVersion: string; dataVersion: string; startState?: string; rotationOrigin?: string; rotation: string; weapon: string; conditions: string; identities: {echo: string; set: string; echoMatch?: {equivalentVariants?: string[]}}[] }}; slots: { slot: number; cost: { raw: string; value: string }; mainStat: { raw: string; value: string }; substats: { raw: string; value: string }[] }[] },
    }; }

export async function listLeaderboard(options: {character?: string;search?: string;page?: number} = {}, db: Client = database()) {
  const character = options.character || SUPPORTED[0];
  const page = Number.isFinite(options.page) ? Math.min(10000,Math.max(1,Math.floor(options.page || 1))) : 1;
  if (!SUPPORTED.includes(character)) return {builds: [],page,hasMore:false,scoring:scoringReadiness};
  const search = (options.search || "").slice(0,64).trim();
  const result = await db.execute({sql: `WITH candidates AS (
    SELECT s.id,s.uid,s.ign,s.character,s.status,s.created_at,s.reviewed_at,s.identity_verified,s.data,c.score AS verified_score,
    row_number() OVER (PARTITION BY s.uid,s.character ORDER BY c.score DESC,s.id ASC) AS player_best
    FROM submissions s JOIN calculation_results c ON c.submission_id=s.id
    WHERE s.status='approved' AND s.identity_verified=1 AND s.character=? AND c.engine_version=? AND c.data_version=? AND c.policy_id=?
  ) SELECT * FROM candidates WHERE player_best=1 AND (?='' OR instr(lower(ign),lower(?))>0 OR instr(uid,?)>0)
    ORDER BY verified_score DESC,id ASC LIMIT 21 OFFSET ?`,args:[character,ENGINE_VERSION,DATA_VERSION,POLICY_VERSION,search,search,search,(page-1)*20]});
  return {builds:result.rows.slice(0,20).map(publicBuild),page,hasMore:result.rows.length>20,scoring:scoringReadiness};
}

export async function setPlayerVerification(id: string, verified: boolean, reviewer: string, note: string, db: Client = database()) {
 const tx = await db.transaction("write");
 try {
  const selected=await tx.execute({sql:"SELECT uid FROM submissions WHERE id=? AND status='approved'",args:[id]});
  if(!selected.rows.length)throw new HttpError(404,"Approved build not found.");
  const builds=await tx.execute({sql:"SELECT id FROM submissions WHERE uid=? AND status='approved' AND identity_verified!=?",args:[String(selected.rows[0].uid),verified?1:0]});
  for(const build of builds.rows){
   await tx.execute({sql:'UPDATE submissions SET identity_verified=? WHERE id=?',args:[verified?1:0,String(build.id)]});
   await tx.execute({sql:'INSERT INTO build_events VALUES (?,?,?,?,?,?)',args:[randomUUID(),String(build.id),verified?'identity_verified':'identity_unverified',reviewer,note,new Date().toISOString()]});
  }
  await tx.commit();return {updated:builds.rows.length};
 }finally{tx.close();}
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
    for(const table of ['assets','calculation_results','build_events','moderation_events']) await tx.execute({sql:`DELETE FROM ${table} WHERE submission_id=?`,args:[id]});
    await tx.execute({sql:'DELETE FROM submissions WHERE id=?',args:[id]});
    const uid=String(saved.rows[0].uid);
    await tx.execute({sql:'DELETE FROM players WHERE uid=? AND NOT EXISTS (SELECT 1 FROM submissions WHERE uid=?)',args:[uid,uid]});
    await tx.commit();
    return {deleted:id};
  }finally{tx.close();}
}
