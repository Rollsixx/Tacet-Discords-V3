import {randomUUID,createHash} from 'node:crypto';
import {HttpError} from './validation.ts';
import {allowedSubstatCorrection} from '../scanner/substat-options.ts';
import {parseSubstat,validateEchoSlot} from '../scanner/stat-validation.ts';
import {assessEquipment,identitiesFromReport,SUPPORTED,ENGINE_VERSION,DATA_VERSION} from './scoring.mjs';
import {initializeRotations,scoreActiveRotation} from './rotations/store.mjs';
import {isRankableUnderActiveRotation} from './approval-policy.mjs';
import {replacePriorResonatorBuilds} from './replacement-workflow.mjs';
const must=(c,m,status=422)=>{if(!c)throw new HttpError(status,m);};
async function proof(row,data,db){const a=data.assessment;must(a?.statsVerified===true,'Original screenshot numbers were not server-verified.');must(/^[a-f0-9]{64}$/.test(a.sourceHash||''),'Original screenshot verification hash is missing.');must(a.sourceUid===String(row.uid),'Original screenshot UID does not match this player.');must(a.sourceSlots?.length===5,'Original server OCR slots are missing.');
 const evidence=(await db.execute({sql:'SELECT image,source_hash FROM submission_source_evidence WHERE submission_id=?',args:[String(row.id)]})).rows[0];
 if(evidence)must(evidence.source_hash===a.sourceHash&&createHash('sha256').update(Buffer.from(evidence.image)).digest('hex')===a.sourceHash,'Stored screenshot and verification hash disagree. Original evidence must be reviewed.');
}
export function correctionLedgerVerified(data){
 const ledger=data.substatCorrections||[];
 return ledger.every((c,i)=>allowedSubstatCorrection(c.replacement)&&(c.adminVerifiedSubstat===true||(data.correctionVerifications||[]).some(v=>v.verified===true&&JSON.stringify(v.corrections?.[i])===JSON.stringify(c))));
}
function materializeCorrectedSlots(data){
 // The persisted slots array is the effective build currently shown in admin.
 // assessment.sourceSlots may lag behind it after an Echo correction. Replay the
 // audited ledger over that effective snapshot, retaining originalSourceSlots as OCR evidence.
 const slots=structuredClone(data.slots||data.assessment?.sourceSlots||[]);
 for(const correction of data.substatCorrections||[]){
  const {slot,position,replacement}=correction;
  must(Number.isInteger(slot)&&slot>=1&&slot<=5&&Number.isInteger(position)&&position>=1&&position<=5,'Saved correction has an invalid Echo position.');
  must(allowedSubstatCorrection(replacement),'Saved correction is not a pinned legal Echo substat roll.');
  const field=slots[slot-1]?.substats?.[position-1],before=parseSubstat(field?.value||''),after=parseSubstat(replacement);
  must(before&&after&&before.name===after.name&&before.percent===after.percent,'Saved correction changes its recognized stat type or unit.');
  slots[slot-1].substats[position-1]={...field,value:replacement};
 }
 return slots;
}
async function rebuild(tx,row,data){
 await proof(row,data,tx);
 // The correction ledger is authoritative for effective scoring values. Keep
 // originalSourceSlots and submission_source_evidence as immutable OCR evidence.
 const slots=materializeCorrectedSlots(data),a={...data.assessment,sourceSlots:structuredClone(slots)};
 data={...data,slots,assessment:a};
 const freshAssessment={...a};delete freshAssessment.scoringIssues;delete freshAssessment.rollTableIssues;
 const issues=slots.flatMap(s=>validateEchoSlot(s).map(i=>({slot:s.slot,...i})));
 const next={...data,assessment:{...freshAssessment,eligible:false,awaitingRotation:false,rollsVerified:issues.length===0,catalogReview:issues.length>0,calculation:undefined}};
 let reason=issues.length?'Echo '+issues[0].slot+': '+issues[0].message:'';
 let calculation=null;
 if(!issues.length&&!correctionLedgerVerified(data))reason='Historical corrections require moderator verification against original evidence.';
 if(!issues.length&&correctionLedgerVerified(data)){
  if(a.maxMainStatsVerified!==true)reason='Maximum main-stat amounts are not source-verified.';
  else if(!SUPPORTED.includes(String(row.character)))reason='This resonator has no integrated scoring data.';
  else try{
   const identities=a.visualReport?.length===5?identitiesFromReport(a.visualReport):a.calculation?.identities;
   must(identities?.length===5,'Five confirmed Echo and Sonata identities are required.');
   Object.assign(next.assessment,await assessEquipment(String(row.character),slots,identities));
   calculation=await scoreActiveRotation(tx,String(row.character),next)||(next.assessment.eligible?next.assessment.calculation:null);
   reason=next.assessment.reason||'Equipment validated.';
  }catch(e){next.assessment.eligible=false;reason=e.message||'Scoring evaluation failed.';}
 }
 const active=(await tx.execute({sql:'SELECT v.id,v.kind,v.policy_id FROM rotation_active a JOIN rotation_versions v ON v.id=a.version_id WHERE a.character=?',args:[String(row.character)]})).rows[0];
 const valid=isRankableUnderActiveRotation(calculation,active);
 const player=(await tx.execute({sql:'SELECT identity_verified FROM players WHERE uid=?',args:[String(row.uid)]})).rows[0];
 const verified=Number(player?.identity_verified)===1,ranked=valid&&verified;
 if(valid)Object.assign(next.assessment,{eligible:true,awaitingRotation:false,calculation,reason:verified?'Moderator correction validated; approved and scored under the active policy.':'Player UID verification is required before automatic approval and ranking.'});
 else Object.assign(next.assessment,{eligible:false,reason:reason||'A calculation matching the active scoring policy is required.'});
 const at=new Date().toISOString(),status=ranked?'approved':String(row.status);
 const previous=(await tx.execute({sql:'SELECT details FROM calculation_results WHERE submission_id=?',args:[String(row.id)]})).rows[0];
 const changed=JSON.stringify(next)!==String(row.data)||status!==String(row.status)||Number(row.identity_verified)!==(verified?1:0)||(valid&&status==='approved'?previous?.details!==JSON.stringify(calculation):Boolean(previous));
 if(!changed)return {ranked,eligible:valid,status,reason:next.assessment.reason,score:ranked?calculation.score:null,policyId:valid?calculation.policyId:null,changed:false};
 if(previous&&active){const c=JSON.parse(String(previous.details)),v=(await tx.execute({sql:'SELECT id FROM rotation_versions WHERE id=?',args:[c.rotationVersion||active.id]})).rows[0];if(v)await tx.execute({sql:'INSERT OR IGNORE INTO rotation_score_history VALUES (?,?,?,?,?,?,?)',args:[randomUUID(),String(v.id),String(row.id),'before-correction/'+randomUUID(),c.score,JSON.stringify(c),at]});}
 await tx.execute({sql:"UPDATE submissions SET data=?,status=?,identity_verified=?,reviewed_at=CASE WHEN status='pending' AND ?='approved' THEN ? ELSE reviewed_at END WHERE id=?",args:[JSON.stringify(next),status,verified?1:0,status,at,String(row.id)]});
 if(ranked&&row.status==='pending')await replacePriorResonatorBuilds(tx,{id:String(row.id),uid:String(row.uid),character:String(row.character),reviewer:'System: corrected build replacement',now:at});
 await tx.execute({sql:'DELETE FROM calculation_results WHERE submission_id=?',args:[String(row.id)]});
 // An approved unverified build may retain a valid calculation; public ranking
 // still requires the UID flag. Pending unverified builds never auto-approve.
 if(valid&&status==='approved'){
  await tx.execute({sql:'INSERT INTO calculation_results VALUES (?,?,?,?,?,?,?,?)',args:[String(row.id),calculation.score,ENGINE_VERSION,DATA_VERSION,calculation.referenceCaseVersion,at,calculation.policyId,JSON.stringify(calculation)]});
  if(active)await tx.execute({sql:'INSERT OR IGNORE INTO rotation_score_history VALUES (?,?,?,?,?,?,?)',args:[randomUUID(),String(active.id),String(row.id),'correction/'+randomUUID(),calculation.score,JSON.stringify(calculation),at]});
 }
 if(ranked&&row.status==='pending')await tx.execute({sql:'INSERT INTO moderation_events VALUES (?,?,?,?,?,?) ON CONFLICT(submission_id) DO NOTHING',args:[randomUUID(),String(row.id),'approved','system','Automatically approved after authenticated moderator correction, verified UID and complete scoring validation.',at]});
 return {ranked,eligible:valid,status,reason:next.assessment.reason,score:ranked?calculation.score:null,policyId:valid?calculation.policyId:null,changed:true};
}
export async function correctEchoSubstat(id,slot,position,expected,replacement,reviewer,note='',db){
 if(!db){const {database}=await import('./database.ts');db=database();}
 must(Number.isInteger(slot)&&slot>=1&&slot<=5&&Number.isInteger(position)&&position>=1&&position<=5,'Invalid Echo or substat position.',400);
 must(allowedSubstatCorrection(replacement),'Replacement must be a pinned legal Echo substat roll.',400);
 must(typeof reviewer==='string'&&reviewer.trim().length>=2&&reviewer.length<=64&&typeof note==='string'&&note.length<=500,'Valid moderator and optional note required.',400);
 await initializeRotations(db);const tx=await db.transaction('write');try{
  const row=(await tx.execute({sql:"SELECT * FROM submissions WHERE id=? AND status IN ('pending','approved')",args:[id]})).rows[0];must(row,'Submission not found.',404);
  const data=JSON.parse(String(row.data)),field=data.slots?.[slot-1]?.substats?.[position-1];
  must(field&&field.value===expected,'Stored reading changed. Reload before correcting.',409);must(expected!==replacement,'Choose a different legal roll.',400);
  const old=parseSubstat(expected),corrected=parseSubstat(replacement);must(old&&corrected&&old.name===corrected.name&&old.percent===corrected.percent,'Correction must preserve the recognized stat type and unit.');await proof(row,data,tx);
  const original=data.assessment.sourceSlots[slot-1]?.substats?.[position-1];must(original,'Original server OCR field is missing.');
  const next=structuredClone(data);
  if(!next.assessment.originalSourceSlots){
   const evidence=(await tx.execute({sql:'SELECT original_slots FROM submission_source_evidence WHERE submission_id=?',args:[id]})).rows[0];
   next.assessment.originalSourceSlots=evidence?JSON.parse(String(evidence.original_slots)):structuredClone(data.assessment.sourceSlots);
   // Recover legacy archived values only from an already-recorded original
   // server reading. Never infer a replacement from proximity to a legal roll.
   if(!evidence){const seen=new Set();for(const c of data.substatCorrections||[]){const key=c.slot+':'+c.position;if(!seen.has(key)&&typeof c.serverOriginal==='string'){const f=next.assessment.originalSourceSlots[c.slot-1]?.substats?.[c.position-1];if(f)f.value=c.serverOriginal;seen.add(key);}}}
  }
  next.originalDisplayedSlots??=structuredClone(data.slots);
  // Score the entire canonical server array, not a mixture of display and OCR.
  next.slots=structuredClone(data.assessment.sourceSlots);
  next.slots[slot-1].substats[position-1]={...original,value:replacement};
  next.assessment.sourceSlots=structuredClone(next.slots);
  const record={slot,position,original:expected,serverOriginal:next.assessment.originalSourceSlots[slot-1].substats[position-1].value,serverRaw:next.assessment.originalSourceSlots[slot-1].substats[position-1].raw,previousServerValue:original.value,replacement,reviewer:reviewer.trim(),note:note.trim()||'Moderator attested the legal roll against original evidence.',at:new Date().toISOString(),adminVerifiedSubstat:true};
  next.substatCorrections=[...(next.substatCorrections||[]),record];
  const result=await rebuild(tx,row,next);
  await tx.execute({sql:'INSERT INTO admin_audit_events VALUES (?,?,?,?,?,?)',args:[randomUUID(),id,'substat_corrected',reviewer.trim(),JSON.stringify({...record,...result}),record.at]});
  await tx.commit();return {slot,position,original:expected,replacement,...result};
 }finally{tx.close();}
}
export async function revalidateCorrectedBuilds(db,{uid,character}={}){
 await initializeRotations(db);
 const rows=(await db.execute({sql:"SELECT id FROM submissions WHERE status IN ('pending','approved') AND json_array_length(json_extract(data,'$.substatCorrections'))>0 AND (? IS NULL OR uid=?) AND (? IS NULL OR character=?)",args:[uid||null,uid||null,character||null,character||null]})).rows;
 const results=[];
 for(const item of rows){const tx=await db.transaction('write');try{
  const row=(await tx.execute({sql:'SELECT * FROM submissions WHERE id=?',args:[String(item.id)]})).rows[0],data=JSON.parse(String(row.data));
  must(correctionLedgerVerified(data),'Historical corrections require moderator verification against original evidence.');
  const result=await rebuild(tx,row,data);
  if(result.changed)await tx.execute({sql:'INSERT INTO admin_audit_events VALUES (?,?,?,?,?,?)',args:[randomUUID(),String(row.id),'corrected_build_revalidated','system',JSON.stringify(result),new Date().toISOString()]});await tx.commit();results.push({id:String(row.id),...result});
 }catch(e){results.push({id:String(item.id),ranked:false,reason:e.message});}finally{tx.close();}}
 return results;
}

// Append a separate attestation; never rewrite a historical correction or OCR.
export async function verifyHistoricalCorrections(id,expectedCorrections,reviewer,verified,note='',db){
 if(!db){const {database}=await import('./database.ts');db=database();}
 must(verified===true,'Compare the saved corrections against original evidence and confirm verification.',400);
 must(typeof reviewer==='string'&&reviewer.trim().length>=2&&reviewer.length<=64&&typeof note==='string'&&note.length<=500,'Valid moderator and optional note required.',400);
 await initializeRotations(db);const tx=await db.transaction('write');try{
  const row=(await tx.execute({sql:"SELECT * FROM submissions WHERE id=? AND status IN ('pending','approved')",args:[id]})).rows[0];must(row,'Submission not found.',404);
  const data=JSON.parse(String(row.data)),ledger=data.substatCorrections||[];
  must(ledger.length>0,'No saved corrections require verification.',400);
  must(JSON.stringify(ledger)===JSON.stringify(expectedCorrections),'Correction history changed. Reload before verifying.',409);
  await proof(row,data,tx);
  must(ledger.every(c=>Number.isInteger(c.slot)&&c.slot>=1&&c.slot<=5&&Number.isInteger(c.position)&&c.position>=1&&c.position<=5&&allowedSubstatCorrection(c.replacement)),'Historical correction contains an invalid field or illegal roll. Review the source data first.');
  const next=structuredClone(data),at=new Date().toISOString();
  if(!correctionLedgerVerified(data))next.correctionVerifications=[...(next.correctionVerifications||[]),{corrections:structuredClone(ledger),verified:true,reviewer:reviewer.trim(),note:note.trim(),at}];
  // All other fields are validated from canonical server inputs by rebuild.
  next.slots=structuredClone(next.assessment.sourceSlots);
  const result=await rebuild(tx,row,next);
  if(result.changed)await tx.execute({sql:'INSERT INTO admin_audit_events VALUES (?,?,?,?,?,?)',args:[randomUUID(),id,'historical_corrections_verified',reviewer.trim(),JSON.stringify({corrections:ledger,note:note.trim(),...result}),at]});
  await tx.commit();return result;
 }finally{tx.close();}
}
