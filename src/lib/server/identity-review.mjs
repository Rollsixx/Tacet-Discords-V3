// SPDX-License-Identifier: GPL-3.0-or-later
import {createHash,randomUUID} from 'node:crypto';
import sharp from 'sharp';
import * as engine from '../../../vendor/wuthering-tools/dist/index.mjs';
import {assessEquipment,diagnoseCrops,identitiesFromReport,DATA_VERSION,ENGINE_VERSION,SUPPORTED} from './scoring.mjs';
import {HttpError} from './validation.ts';
import {validateEchoSlot} from '../scanner/stat-validation.ts';
import {sameScoringSlotValues} from '../scanner/stat-equivalence.mjs';
import {scoreActiveRotation,recordRotationScore} from './rotations/store.mjs';
import corrections from '../game-data/fingerprint-corrections.json' with {type:'json'};
import {visualReadiness} from '../scanner/scoring-readiness.ts';
const hash=x=>createHash('sha256').update(x).digest('hex');
const must=(c,m,status=422)=>{if(!c)throw new HttpError(status,m);};
const costByClass={Calamity:4,Overlord:4,Elite:3,Common:1};
export function identityCatalog(){return Object.values(engine.mainEchoesData).map(e=>({key:e.key,name:e.name,cost:costByClass[e.class],sets:e.sets,image:corrections.echoes.find(c=>c.key===e.key)?.source||e.image}));}
export function repairEvidence(row,data){
 const a=data.assessment,source=a?.sourceSlots;
 // OCR raw text and confidence metadata can differ between the client preview
 // and server verification. Compare canonical values; the original image hash,
 // UID, max-level main stats, legal rolls and retained crop dimensions remain
 // independently checked before identity confirmation.
 return a?.statsVerified===true&&a.maxMainStatsVerified===true&&/^[a-f0-9]{64}$/.test(a.sourceHash||'')&&a.sourceUid===String(row.uid)&&data.slots?.length===5&&source?.length===5&&data.slots.every(s=>!validateEchoSlot(s).length)&&source.every(s=>!validateEchoSlot(s).length)&&sameScoringSlotValues(source,data.slots);
}
async function snapshot(db,id){const row=(await db.execute({sql:"SELECT * FROM submissions WHERE id=? AND status IN ('pending','approved')",args:[id]})).rows[0];must(row,'Submission not found.',404);return {row,data:JSON.parse(String(row.data))};}
async function cropsFor(db,row,data){
 const rows=(await db.execute({sql:'SELECT slot,kind,png FROM assets WHERE submission_id=? ORDER BY slot,kind',args:[row.id]})).rows;must(rows.length===10,'All ten retained crops are required. Reimport the original screenshot.');
 const digest=createHash('sha256');const crops=[];
 for(let i=1;i<=5;i++){const c={slot:i,cost:Number(data.slots[i-1].cost.value)};for(const kind of ['portrait','sonata']){const matches=rows.filter(r=>Number(r.slot)===i&&r.kind===kind);must(matches.length===1,'Retained crop is missing or duplicated.');const bytes=Buffer.from(matches[0].png);const m=await sharp(bytes,{limitInputPixels:40000}).metadata();must(m.width===(kind==='portrait'?192:56)&&m.height===(kind==='portrait'?182:56),'Retained crop dimensions are invalid.');c[kind]=bytes;digest.update(String(i)+kind).update(bytes);}crops.push(c);}
 return {crops,cropHash:digest.digest('hex')};
}
export async function identityWorkspace(db,id){
 const {row,data}=await snapshot(db,id);const statIssues=data.slots?.flatMap(s=>validateEchoSlot(s).map(i=>'Echo '+s.slot+': '+i.message))||[];const evidence=repairEvidence(row,data);let report=[],crops=[],cropHash=null;
 if(data.slots?.length===5){try{const retained=await cropsFor(db,row,data);report=await diagnoseCrops(retained.crops);cropHash=retained.cropHash;crops=retained.crops.map(c=>({slot:c.slot,portrait:'data:image/png;base64,'+c.portrait.toString('base64'),sonata:'data:image/png;base64,'+c.sonata.toString('base64')}));}catch{/* Keep the submission reviewable when retained images are incomplete. */}}
 return {id,revision:hash(String(row.data)),evidence,evidenceReason:statIssues.length?statIssues.join(' '):evidence?'Source UID, numeric stats, maximum main stats and canonical crops were verified.':'Verified canonical source evidence is incomplete. Reimport a clear original screenshot; identity correction cannot bypass missing proof.',supported:SUPPORTED.includes(String(row.character)),report,crops,cropHash,catalog:identityCatalog(),sets:Object.entries(engine.echoSetLabelMap).map(([key,name])=>({key,name})),readiness:{...visualReadiness(report,data.assessment?.statsVerified===true),ready:data.assessment?.eligible===true,reason:data.assessment?.reason||'No scoring evidence.'}};
}
export function validateIdentities(input,slots){
 must(Array.isArray(input)&&input.length===5,'Confirm all five ordered identities.',400);
 return input.map((s,i)=>{must(s&&s.slot===i+1&&Object.keys(s).every(k=>['slot','echo','set'].includes(k)),'Invalid identity correction fields.',400);const echo=engine.getEchoData(s.echo);must(echo&&costByClass[echo.class]===Number(slots[i].cost.value),'Selected Echo does not match the source-verified cost.',400);must(echo.sets.includes(s.set),'Selected Sonata is not supported by this Echo.',400);return {echo:s.echo,set:s.set};});
}
function sourceProofProblems(row,data){
 const a=data.assessment||{},source=a.sourceSlots;
 const issues=[];
 if(a.statsVerified!==true)issues.push('The server has not verified every numeric stat from the original screenshot.');
 if(a.maxMainStatsVerified!==true)issues.push('A maximum-level Echo main-stat amount still needs screenshot verification.');
 if(a.sourceUid!==String(row.uid))issues.push('The screenshot UID does not match this player.');
 if(!/^[a-f0-9]{64}$/.test(a.sourceHash||''))issues.push('The verified screenshot hash is missing.');
 if(!Array.isArray(source)||source.length!==5)issues.push('The server OCR readings for all five Echoes are incomplete.');
 if(!Array.isArray(data.slots)||data.slots.length!==5)issues.push('The submitted values for all five Echoes are incomplete.');
 if(Array.isArray(source)&&source.length===5){
  const sourceIssues=source.flatMap(s=>validateEchoSlot(s).map(i=>'Echo '+s.slot+': '+i.message));
  if(sourceIssues.length)issues.push('Server OCR requires review: '+sourceIssues.join(' '));
 }
 if(Array.isArray(data.slots)&&data.slots.length===5){
  const submittedIssues=data.slots.flatMap(s=>validateEchoSlot(s).map(i=>'Echo '+s.slot+': '+i.message));
  if(submittedIssues.length)issues.push('Parsed Echo values require correction: '+submittedIssues.join(' '));
 }
 if(Array.isArray(source)&&source.length===5&&Array.isArray(data.slots)&&data.slots.length===5&&!sameScoringSlotValues(source,data.slots))issues.push('Parsed stat values do not match the independent screenshot readings. Correct the affected Echo stat before ranking.');
 if(!issues.length)issues.push(a.reason||'The source evidence is incomplete; reload this review and inspect the retained screenshot.');
 return [...new Set(issues)];
}
export async function repairIdentities(db,id,input){
 must(input&&['retry','confirm'].includes(input.operation),'Choose retry or confirm.',400);
 must(typeof input.reviewer==='string'&&input.reviewer.trim().length>=2&&input.reviewer.length<=64,'Reviewer name required.',400);
 input={...input,note:input.note??''};
 must(typeof input.note==='string'&&input.note.length<=500,'Optional note must contain at most 500 characters.',400);
 const auditNote=input.note.trim()||'Retried strict equipment recognition from retained source evidence.';
 const {row,data}=await snapshot(db,id);must(input.revision===hash(String(row.data)),'This build changed. Reload its identity review.',409);
 const sourceProofComplete=repairEvidence(row,data);if(!sourceProofComplete){must(input.operation==='confirm'&&input.confirmed===true,'Compare and confirm all five retained Echo identities.',400);must(data.assessment?.sourceUid===String(row.uid),'Screenshot UID must be verified before recording manual identities.');const retained=await cropsFor(db,row,data);must(retained.crops.length===5,'All retained Echo portraits and Sonata crops are required.');const identities=validateIdentities(input.identities,data.slots);const at=new Date().toISOString();const before=data.assessment?.calculation?.identities||[];const next={...data,assessment:{...data.assessment,eligible:false,rollsVerified:false,identityReview:{version:'moderator-identity-review/unverified',confirmedAt:at,method:'manual-unverified'},visualReport:identities.map((s,i)=>({slot:i+1,echo:s.echo,set:s.set,problem:'Pending source proof; manual identity is not scoring evidence.'})),reason:'Moderator recorded equipment identities. '+sourceProofProblems(row,data).join(' ')}};const tx=await db.transaction('write');try{const fresh=(await tx.execute({sql:'SELECT data,status,identity_verified FROM submissions WHERE id=?',args:[id]})).rows[0];must(fresh&&fresh.data===row.data,'Build changed during identity review. Reload before confirming.',409);await tx.execute({sql:'UPDATE submissions SET data=? WHERE id=?',args:[JSON.stringify(next),id]});await tx.execute({sql:'INSERT INTO admin_audit_events VALUES (?,?,?,?,?,?)',args:[randomUUID(),id,'echo_identities_recorded_unverified',input.reviewer.trim(),JSON.stringify({note:input.note.trim()||'Moderator compared the retained images; source proof remains incomplete.',before,after:identities}),at]});await tx.commit();return {ok:true,id,status:row.status,eligible:false,ranked:false};}finally{tx.close();}}must(SUPPORTED.includes(String(row.character)),'This resonator does not have an integrated scoring policy.');
 const retained=await cropsFor(db,row,data),report=await diagnoseCrops(retained.crops);
 let identities;
 if(input.operation==='confirm'){must(input.confirmed===true,'Confirm visual comparison of all five Echoes and Sonatas.',400);identities=validateIdentities(input.identities,data.slots);}
 else{try{identities=identitiesFromReport(report);}catch(e){throw new HttpError(422,e.message+' Compare the retained crops and confirm their identities, or reimport a clearer screenshot.');}}
 let baseline;try{baseline=await assessEquipment(String(row.character),data.slots,identities);}catch(e){throw new HttpError(422,String(e.message)+'. Reimport a clearer original card; retained stats cannot be edited.');}const at=new Date().toISOString();
 const before=data.assessment?.calculation?.identities||report.map(s=>({echo:s.echo,set:s.set}));
 const proof={version:'moderator-identity-review/1',sourceHash:data.assessment.sourceHash,cropHash:retained.cropHash,confirmedAt:at,method:input.operation};
 const next={...data,assessment:{...data.assessment,...baseline,rollsVerified:true,visualReport:identities.map((s,i)=>({...report[i],echo:s.echo,set:s.set,problem:null,manuallyConfirmed:input.operation==='confirm'})),identityReview:proof,reason:baseline.reason||(input.operation==='confirm'?'Source-verified stats and moderator-confirmed equipment identities validated.':'Equipment identities recovered from retained canonical crops using current strict references.')}};
 const tx=await db.transaction('write');try{
  const fresh=(await tx.execute({sql:'SELECT data,status,identity_verified FROM submissions WHERE id=?',args:[id]})).rows[0];must(fresh&&fresh.data===row.data&&fresh.status===row.status&&Number(fresh.identity_verified)===Number(row.identity_verified),'Build changed during identity review. Reload before confirming.',409);
  const active=await scoreActiveRotation(tx,String(row.character),next);const calculation=active||baseline.calculation;if(active){next.assessment.eligible=true;next.assessment.awaitingRotation=false;next.assessment.calculation=active;next.assessment.reason='Source equipment verified; scored under the owner-published rotation.';}
  if(row.status==='approved'){const old=(await tx.execute({sql:'SELECT details FROM calculation_results WHERE submission_id=?',args:[id]})).rows[0];if(old)await recordRotationScore(tx,id,String(row.character),data,JSON.parse(String(old.details)),at);}
  await tx.execute({sql:'UPDATE submissions SET data=? WHERE id=?',args:[JSON.stringify(next),id]});
  if(row.status==='approved'&&next.assessment.eligible){
   await tx.execute({sql:'INSERT INTO calculation_results VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(submission_id) DO UPDATE SET score=excluded.score,engine_version=excluded.engine_version,data_version=excluded.data_version,reference_case_version=excluded.reference_case_version,verified_at=excluded.verified_at,policy_id=excluded.policy_id,details=excluded.details',args:[id,calculation.score,ENGINE_VERSION,DATA_VERSION,calculation.referenceCaseVersion,at,calculation.policyId,JSON.stringify(calculation)]});
   await recordRotationScore(tx,id,String(row.character),next,calculation,at);
  }
  const audit=JSON.stringify({note:auditNote,method:input.operation,before,after:identities,sourceHash:proof.sourceHash,cropHash:proof.cropHash});
  await tx.execute({sql:'INSERT INTO admin_audit_events VALUES (?,?,?,?,?,?)',args:[randomUUID(),id,input.operation==='confirm'?'echo_identities_confirmed':'echo_recognition_retried',input.reviewer.trim(),audit,at]});
  await tx.execute({sql:'INSERT INTO build_events VALUES (?,?,?,?,?,?)',args:[randomUUID(),id,'rescore',input.reviewer.trim(),'Identity recovery; '+input.operation+'; '+(calculation.policyId||'awaiting-owner-rotation/1'),at]});
  await tx.commit();if(next.substatCorrections?.length){const {revalidateCorrectedBuilds}=await import('./correction-workflow.mjs');await revalidateCorrectedBuilds(db,{uid:String(row.uid)});}let status=String(row.status),ranked=status==='approved'&&Number(row.identity_verified)===1&&next.assessment.eligible===true;if(status==='pending'&&Number(row.identity_verified)===1&&next.assessment.eligible===true){const {autoApproveVerifiedSubmission}=await import('./approval-workflow.mjs');ranked=await autoApproveVerifiedSubmission(id,db);if(ranked)status='approved';}return {ok:true,id,score:ranked?calculation.score:null,status,eligible:next.assessment.eligible,ranked,reason:ranked?'Equipment verified; build automatically approved and ranked.':next.assessment.reason||'Identity review saved; remaining scoring requirements are shown in the assessment.'};
 }finally{tx.close();}
}
