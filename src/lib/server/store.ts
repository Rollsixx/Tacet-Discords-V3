// Moderation mutations are isolated from submission OCR and public queries.
import {randomUUID} from 'node:crypto';
import type {Client} from '@libsql/client';
import {database} from './database.ts';
import {HttpError} from './validation.ts';
import {revalidateCorrectedBuilds} from './correction-workflow.mjs';
import {ENGINE_VERSION,DATA_VERSION,POLICY_VERSION} from './scoring-versions.mjs';
import {scoreActiveRotation,recordRotationScore,applyPublishedRotation} from './rotations/store.mjs';
export {listBuilds,listLeaderboard,adminOverview,listAdminAudit,findPlayers,homeRankings,listAdminPlayers,adminPlayerBuilds} from './queries.ts';
export {scoringReadiness} from './scoring-info.ts';
export {rateLimit} from './rate-limit.ts';
export async function moderate(id: string, action: "approved" | "rejected", reviewer: string, note: string, identityVerified: boolean, db: Client = database(), allowUnranked = false) {
  const tx = await db.transaction("write");
  try {
    const now = new Date().toISOString();
    if (action === "rejected") {
      const saved = await tx.execute({ sql: "SELECT uid FROM submissions WHERE id=? AND status='pending'", args: [id] });
      if (!saved.rows.length) throw new HttpError(409, "Submission is missing or has already been reviewed.");
      await tx.execute({ sql: "INSERT INTO rejection_events VALUES (?,?,?,?,?)", args: [randomUUID(), id, reviewer, note, now] });
      for (const table of ["submission_source_evidence", "assets", "calculation_results", "build_events", "moderation_events", "rotation_run_scores"]) {
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
    await tx.execute({ sql: "INSERT INTO moderation_events VALUES (?,?,?,?,?,?)", args: [randomUUID(), id, action, reviewer, (!assessed?.eligible?"Approved as unranked: ":"")+(note.trim()||assessed?.reason||"Moderator approved this build."), now] });
    await tx.commit();
  } finally { tx.close(); }
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
export async function setPlayerVerification(id:string,verified:boolean,reviewer:string,note:string,db:Client=database()){
 const row=(await db.execute({sql:"SELECT uid FROM submissions WHERE id=? AND status='approved'",args:[id]})).rows[0];
 if(!row)throw new HttpError(404,'Approved build not found.');
 return setUidVerification(String(row.uid),verified,reviewer,note,db);
}
export async function setUidVerification(uid:string,verified:boolean,reviewer:string,note:string,db:Client=database()){
 const tx=await db.transaction('write');let result;
 try{result=await applyUidVerification(tx,uid,verified,reviewer,note,new Date().toISOString());await tx.commit();}finally{tx.close();}
 if(verified)await revalidateCorrectedBuilds(db,{uid});
 return result;
}

export async function deleteBuild(id: string, reviewer: string, note: string, db: Client = database()) {
  const tx=await db.transaction('write');
  try {
    const saved=await tx.execute({sql:'SELECT uid FROM submissions WHERE id=?',args:[id]});
    if(!saved.rows.length)throw new HttpError(404,'Submission not found. It may have already been deleted.');
    // Preserve decisions in a ledger without foreign keys before removing evidence.
    for(const table of ['moderation_events','build_events']) await tx.execute({sql:`INSERT INTO admin_audit_events SELECT id,submission_id,action,reviewer,note,created_at FROM ${table} WHERE submission_id=?`,args:[id]});
    await tx.execute({sql:'INSERT INTO admin_audit_events VALUES (?,?,?,?,?,?)',args:[randomUUID(),id,'deleted',reviewer,note,new Date().toISOString()]});
    for(const table of ['submission_source_evidence','assets','calculation_results','build_events','moderation_events','rotation_run_scores']) await tx.execute({sql:`DELETE FROM ${table} WHERE submission_id=?`,args:[id]});
    await tx.execute({sql:'DELETE FROM submissions WHERE id=?',args:[id]});
    const uid=String(saved.rows[0].uid);
    await tx.execute({sql:'DELETE FROM players WHERE uid=? AND identity_verified=0 AND NOT EXISTS (SELECT 1 FROM submissions WHERE uid=?)',args:[uid,uid]});
    await tx.commit();
    return {deleted:id};
  }finally{tx.close();}
}

export {correctEchoSubstat,revalidateCorrectedBuilds} from './correction-workflow.mjs';
