// Moderation mutations are isolated from submission OCR and public queries.
import {randomUUID} from 'node:crypto';
import type {Client} from '@libsql/client';
import {database} from './database.ts';
import {HttpError} from './validation.ts';
import {revalidateCorrectedBuilds} from './correction-workflow.mjs';
import {applyUidVerification,approvePendingBuildTx,autoApproveVerifiedPendingBuilds} from './approval-workflow.mjs';
export {listBuilds,listLeaderboard,adminOverview,listAdminAudit,findPlayers,homeRankings,listAdminPlayers,adminPlayerBuilds} from './queries.ts';
export {scoringReadiness} from './scoring-info.ts';
export {rateLimit} from './rate-limit.ts';
export async function moderate(id: string, action: "approved" | "rejected", reviewer: string, note: string, identityVerified: boolean, db: Client = database(), allowUnranked = false, requireRanked=false) {
 const tx=await db.transaction('write');
 try{
  const now=new Date().toISOString();
  if(action==='rejected'){
   const saved=await tx.execute({sql:"SELECT uid FROM submissions WHERE id=? AND status='pending'",args:[id]});
   if(!saved.rows.length)throw new HttpError(409,'Submission is missing or has already been reviewed.');
   await tx.execute({sql:'INSERT INTO rejection_events VALUES (?,?,?,?,?)',args:[randomUUID(),id,reviewer,note,now]});
   for(const table of ['submission_source_evidence','assets','calculation_results','build_events','moderation_events','rotation_run_scores'])await tx.execute({sql:`DELETE FROM ${table} WHERE submission_id=?`,args:[id]});
   await tx.execute({sql:'DELETE FROM submissions WHERE id=?',args:[id]});
   await tx.execute({sql:'DELETE FROM players WHERE uid=? AND identity_verified=0 AND NOT EXISTS (SELECT 1 FROM submissions WHERE uid=?)',args:[String(saved.rows[0].uid),String(saved.rows[0].uid)]});
   await tx.commit();return;
  }
  await approvePendingBuildTx(tx,id,{reviewer,note,identityVerified,allowUnranked,requireRanked,now});
  await tx.commit();
 }finally{tx.close();}
}
export async function setPlayerVerification(id:string,verified:boolean,reviewer:string,note:string,db:Client=database()){
 const row=(await db.execute({sql:"SELECT uid FROM submissions WHERE id=? AND status='approved'",args:[id]})).rows[0];
 if(!row)throw new HttpError(404,'Approved build not found.');
 return setUidVerification(String(row.uid),verified,reviewer,note,db);
}
export async function setUidVerification(uid:string,verified:boolean,reviewer:string,note:string,db:Client=database()){
 const tx=await db.transaction('write');let result;
 try{result=await applyUidVerification(tx,uid,verified,reviewer,note,new Date().toISOString());await tx.commit();}finally{tx.close();}
 if(verified){await revalidateCorrectedBuilds(db,{uid});await autoApproveVerifiedPendingBuilds(uid,db);}
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

export {autoApproveVerifiedPendingBuilds};
export {correctEchoSubstat,revalidateCorrectedBuilds} from './correction-workflow.mjs';

export async function updateManualProfileDetails(
 id:string,details:Record<string,unknown>,reviewer:string,note:string,weaponIcon?:Buffer,removeWeaponIcon=false,db:Client=database()
){
 const tx=await db.transaction('write');
 try{
  const exists=await tx.execute({sql:"SELECT id FROM submissions WHERE id=?",args:[id]});
  if(!exists.rows.length)throw new HttpError(404,"Build not found.");
  const now=new Date().toISOString();
  await tx.execute({sql:"INSERT INTO submission_profile_overrides(submission_id,details,reviewer,updated_at) VALUES(?,?,?,?) ON CONFLICT(submission_id) DO UPDATE SET details=excluded.details,reviewer=excluded.reviewer,updated_at=excluded.updated_at",args:[id,JSON.stringify(details),reviewer,now]});
  if(weaponIcon)await tx.execute({sql:"INSERT INTO submission_profile_assets(id,submission_id,kind,png) VALUES(?,?,?,?) ON CONFLICT(submission_id,kind) DO UPDATE SET png=excluded.png",args:[randomUUID(),id,"weapon",weaponIcon]});
  else if(removeWeaponIcon)await tx.execute({sql:"DELETE FROM submission_profile_assets WHERE submission_id=? AND kind='weapon'",args:[id]});
  await tx.execute({sql:"INSERT INTO admin_audit_events VALUES (?,?,?,?,?,?)",args:[randomUUID(),id,"profile_details_updated",reviewer,note,now]});
  await tx.commit();
  return {ok:true};
 }finally{tx.close();}
}
