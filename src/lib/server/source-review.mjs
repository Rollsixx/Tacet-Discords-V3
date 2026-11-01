// SPDX-License-Identifier: GPL-3.0-or-later
import {createHash,randomUUID} from 'node:crypto';
import {HttpError} from './validation.ts';
import {validateEchoSlot} from '../scanner/stat-validation.ts';
import {decodeFingerprintSource} from './image-fingerprint.mjs';
import {diagnoseSlots} from './scoring.mjs';

const must=(condition,message,status=422)=>{if(!condition)throw new HttpError(status,message);};

/** Validate an explicit human review against the retained, immutable screenshot. */
export function prepareManualSourceReview(row,evidence,input){
 must(row&&evidence,'Submission or retained source evidence is missing.',404);
 must(input&&input.confirmed===true,'Compare the original card and confirm all five Echoes before resolving this blocker.',400);
 must(typeof input.reviewer==='string'&&input.reviewer.trim().length>=2&&input.reviewer.length<=64,'Reviewer name is required.',400);
 const note=input.note??'';
 must(typeof note==='string'&&note.length<=500,'Review note must contain at most 500 characters.',400);
 must(String(input.confirmedUid||'').trim()===String(row.uid),'The UID entered does not match the submitted player.',400);
 const image=Buffer.from(evidence.image);
 const sourceHash=createHash('sha256').update(image).digest('hex');
 must(sourceHash===String(evidence.source_hash),'The retained screenshot failed its integrity check.',409);
 const data=JSON.parse(String(row.data)),assessment=data.assessment||{},failure=assessment.failure||{};
 must(assessment.statsVerified!==true,'Echo stats are already verified. Reload this submission.',409);
 must(Array.isArray(data.slots)&&data.slots.length===5,'The five submitted Echo records are unavailable.',409);
 const slots=structuredClone(data.slots);
 let costChange=null;
 if(failure.field==='cost'){
  const slotNumber=Number(failure.slot);
  must(Number.isInteger(slotNumber)&&slotNumber>=1&&slotNumber<=5,'The flagged cost slot is invalid.',409);
  const requested=String(input.manualCost||'');
  must(['1','3','4'].includes(requested),'Choose the cost you can read on the original card.',400);
  const target=slots[slotNumber-1];
  must(target?.cost,'The flagged Echo cost is unavailable.',409);
  if(String(target.cost.value)!==requested){
   costChange={slot:slotNumber,from:String(target.cost.value),to:requested};
   target.cost={...target.cost,value:requested};
  }
 } else {
  must(input.manualCost===undefined||input.manualCost===null||input.manualCost==='','A manual cost can only be changed for a flagged cost mismatch.',400);
 }
 const issues=slots.flatMap((slot,index)=>validateEchoSlot(slot).map(issue=>({slot:index+1,code:issue.code,message:issue.message})));
 const nextAssessment={...assessment,statsVerified:true,rollsVerified:issues.length===0,sourceUid:String(row.uid),sourceHash,sourceSlots:slots,originalSourceSlots:assessment.originalSourceSlots||JSON.parse(String(evidence.original_slots)),manualSourceReview:{version:'moderator-source-review/1',sourceHash,reviewedAt:new Date().toISOString(),reviewer:input.reviewer.trim(),note:note.trim(),costChange},eligible:false,reason:issues.length?'Echo values were visually confirmed by a moderator; legal-roll review is still required.':'Echo values were visually confirmed by a moderator; verify the five maximum main-stat amounts next.'};
 delete nextAssessment.failure;
 return {data:{...data,assessment:nextAssessment,slots},sourceHash,costChange,manualCost:failure.field==='cost'?String(input.manualCost):null,issues,reviewer:input.reviewer.trim(),note:note.trim()};
}

export async function confirmSourceStatsManually(db,id,input){
 must(typeof id==='string'&&id.length>=8&&id.length<=100,'Invalid submission ID.',400);
 const tx=await db.transaction('write');
 try{
  const row=(await tx.execute({sql:"SELECT * FROM submissions WHERE id=? AND status IN ('pending','approved')",args:[id]})).rows[0];
  must(row,'Submission not found.',404);
  const evidence=(await tx.execute({sql:'SELECT image,source_hash,original_slots FROM submission_source_evidence WHERE submission_id=?',args:[id]})).rows[0];
  const prepared=prepareManualSourceReview(row,evidence,input);
  const decoded=await decodeFingerprintSource(Buffer.from(evidence.image));
  prepared.data.assessment.visualReport=await diagnoseSlots(decoded,prepared.data.slots.map(slot=>Number(slot.cost.value)));
  const fresh=(await tx.execute({sql:'SELECT data FROM submissions WHERE id=?',args:[id]})).rows[0];
  must(fresh&&fresh.data===row.data,'Submission changed during review. Reload before confirming.',409);
  const at=new Date().toISOString();
  await tx.execute({sql:'UPDATE submissions SET data=? WHERE id=?',args:[JSON.stringify(prepared.data),id]});
  await tx.execute({sql:'INSERT INTO admin_audit_events VALUES (?,?,?,?,?,?)',args:[randomUUID(),id,'source_stats_manually_verified',prepared.reviewer,JSON.stringify({note:prepared.note,sourceHash:prepared.sourceHash,manualCost:prepared.manualCost,costChange:prepared.costChange,remainingRollIssues:prepared.issues}),at]});
  await tx.commit();
  return {ok:true,id,statsVerified:true,rollsVerified:prepared.issues.length===0,costChange:prepared.costChange,remainingRollIssues:prepared.issues,reason:prepared.data.assessment.reason};
 }finally{tx.close();}
}
