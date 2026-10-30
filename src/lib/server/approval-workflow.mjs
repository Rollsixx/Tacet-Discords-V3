import {randomUUID} from 'node:crypto';
import {HttpError} from './validation.ts';
import {ENGINE_VERSION,DATA_VERSION,POLICY_VERSION} from './scoring-versions.mjs';
import {scoreActiveRotation,recordRotationScore,applyPublishedRotation} from './rotations/store.mjs';
import {isRankableUnderActiveRotation} from './approval-policy.mjs';
import {replacePriorResonatorBuilds} from './replacement-workflow.mjs';

export async function applyUidVerification(tx,uid,verified,reviewer,note,now){
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

export async function approvePendingBuildTx(tx,id,{reviewer,note,identityVerified=false,allowUnranked=false,requireRanked=false,now=new Date().toISOString()}){
 const row=(await tx.execute({sql:"SELECT uid,character,data FROM submissions WHERE id=? AND status='pending'",args:[id]})).rows[0];
 if(!row)throw new HttpError(409,'Submission is missing or has already been reviewed.');
 const uid=String(row.uid),character=String(row.character),pendingData=JSON.parse(String(row.data));
 let data=await applyPublishedRotation(tx,character,pendingData);
 let assessment=data.assessment;
 if(!assessment?.eligible&&!allowUnranked)throw new HttpError(422,'Scoring is blocked. Resolve the Echo identities first, or explicitly approve this build as unranked.');
 if(identityVerified)await applyUidVerification(tx,uid,true,reviewer,note,now);
 let calculation=assessment?.eligible?await scoreActiveRotation(tx,character,data)||assessment.calculation:null;
 const player=(await tx.execute({sql:'SELECT identity_verified FROM players WHERE uid=?',args:[uid]})).rows[0];
 const active=(await tx.execute({sql:'SELECT v.id,v.kind,v.policy_id FROM rotation_active a JOIN rotation_versions v ON v.id=a.version_id WHERE a.character=?',args:[character]})).rows[0];
 const identityIsVerified=Number(player?.identity_verified)===1;
 if(requireRanked){
  if(!identityIsVerified)throw new HttpError(422,'UID verification is required before automatic approval.');
  if(!assessment?.eligible||!isRankableUnderActiveRotation(calculation,active))throw new HttpError(422,'This build is not fully scoring-ready under the active published rotation.');
  assessment={...assessment,eligible:true,awaitingRotation:false,calculation,reason:'Automatically approved: verified UID and current scoring checks passed.'};
  data={...data,assessment};calculation=assessment.calculation;
 }
 if(data!==pendingData)await tx.execute({sql:"UPDATE submissions SET data=? WHERE id=? AND status='pending'",args:[JSON.stringify(data),id]});
 const updated=await tx.execute({sql:"UPDATE submissions SET status='approved',reviewed_at=?,identity_verified=(SELECT identity_verified FROM players WHERE uid=?) WHERE id=? AND status='pending'",args:[now,uid,id]});
 if(updated.rowsAffected!==1)throw new HttpError(409,'Submission is missing or has already been reviewed.');
 if(identityIsVerified&&isRankableUnderActiveRotation(calculation,active))await replacePriorResonatorBuilds(tx,{id,uid,character,reviewer:'System: build replacement',now});
 if(calculation&&calculation.engineVersion===ENGINE_VERSION&&calculation.dataVersion===DATA_VERSION&&(calculation.policyId===POLICY_VERSION||calculation.rotationVersion)&&Number.isFinite(calculation.score)&&calculation.score>0){
  await tx.execute({sql:'INSERT INTO calculation_results(submission_id,score,engine_version,data_version,reference_case_version,verified_at,policy_id,details) VALUES (?,?,?,?,?,?,?,?)',args:[id,calculation.score,ENGINE_VERSION,DATA_VERSION,calculation.referenceCaseVersion,now,calculation.policyId,JSON.stringify(calculation)]});
  await recordRotationScore(tx,id,character,data,calculation,now);
 }
 await tx.execute({sql:'INSERT INTO moderation_events VALUES (?,?,?,?,?,?)',args:[randomUUID(),id,'approved',reviewer,(!assessment?.eligible?'Approved as unranked: ':'')+(note.trim()||assessment?.reason||'Moderator approved this build.'),now]});
 return {id,status:'approved',ranked:Boolean(calculation&&calculation.rotationVersion)};
}

export async function autoApproveVerifiedSubmission(id,db){
 const tx=await db.transaction('write');
 try{
  const row=(await tx.execute({sql:"SELECT s.status,s.data,p.identity_verified FROM submissions s JOIN players p ON p.uid=s.uid WHERE s.id=?",args:[id]})).rows[0];
  if(!row||String(row.status)!=='pending'||Number(row.identity_verified)!==1)return false;
  const data=JSON.parse(String(row.data));
  if(Array.isArray(data.substatCorrections)&&data.substatCorrections.length)return false;
  await approvePendingBuildTx(tx,id,{reviewer:'System: verified UID',note:'Automatically approved after verified UID and active scoring checks passed.',requireRanked:true});
  await tx.commit();return true;
 }catch(error){
  if(error instanceof HttpError&&(error.status===409||error.status===422))return false;
  throw error;
 }finally{tx.close();}
}

export async function autoApproveVerifiedPendingBuilds(uid,db){
 const rows=(await db.execute({sql:"SELECT id FROM submissions WHERE uid=? AND status='pending' ORDER BY created_at ASC,id ASC",args:[uid]})).rows;
 let approved=0;
 for(const row of rows){
  try{if(await autoApproveVerifiedSubmission(String(row.id),db))approved++;}
  catch{/* Keep an individual submission pending if its evidence or scoring work fails. */}
 }
 return {approved,checked:rows.length};
}
