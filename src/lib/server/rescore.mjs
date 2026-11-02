import {hasRetainedRecovery,recoverVisualEvidence,recoveryMode} from './visual-recovery.mjs';
import {initializeRotations,scoreActiveRotation} from './rotations/store.mjs';
import {validateEchoSlot} from '../scanner/stat-validation.ts';
import {randomUUID} from 'node:crypto';
import {assessEquipment,ENGINE_VERSION,DATA_VERSION,POLICY_VERSION,SUPPORTED} from './scoring.mjs';
import {correctionLedgerVerified} from './correction-workflow.mjs';
import {recordRescoreSkip} from './rescore-report.mjs';
// Reuse only previously server-validated evidence from this known data snapshot.
// Old unsupported/no-evidence submissions must be resubmitted with an original.
export async function rescoreStoredBuilds(db){
 await initializeRotations(db);
 const rows=await db.execute("SELECT s.id,s.uid,s.character,s.status,s.identity_verified,s.reviewed_at,s.data,v.id AS active_rotation_id,v.kind AS active_rotation_kind,v.policy_id AS active_policy_id,v.spec AS active_rotation_spec,v.engine_version AS active_rotation_engine_version,v.data_version AS active_rotation_data_version,v.mechanics_version AS active_rotation_mechanics_version FROM submissions s LEFT JOIN rotation_active a ON a.character=s.character LEFT JOIN rotation_versions v ON v.id=a.version_id WHERE s.status IN ('pending','approved') AND s.replaced_by IS NULL");
 const result={updated:0,skipped:0,skippedReasons:{},failed:0,awaitingRotationRecords:[],failedRecords:[]};
 for(const row of rows.rows){
  const data=JSON.parse(String(row.data)),a=data.assessment,c=a?.calculation;
  const managed=row.active_rotation_id?{id:String(row.active_rotation_id),kind:String(row.active_rotation_kind),policy_id:String(row.active_policy_id),spec:String(row.active_rotation_spec),engine_version:String(row.active_rotation_engine_version),data_version:String(row.active_rotation_data_version),mechanics_version:String(row.active_rotation_mechanics_version)}:null;
  if(!SUPPORTED.includes(String(row.character))){recordRescoreSkip(result,"unsupported_character");continue;}
  if((data.substatCorrections||[]).length&&!correctionLedgerVerified(data)){recordRescoreSkip(result,"correction_ledger_unverified");continue;}
  if(a?.statsVerified!==true||a?.maxMainStatsVerified!==true){recordRescoreSkip(result,"stats_or_main_stats_unverified");continue;}
  const recoverable=recoveryMode(row,data);
  const retained=a?.eligible&&(/^[a-f0-9]{64}$/.test(a.sourceHash||'')||hasRetainedRecovery(a))&&c?.dataVersion===DATA_VERSION&&c.engineVersion?.startsWith('wuthering-tools-b32cdbd+tacet/')&&c.identities?.length===5&&c.character===String(row.character);
  if(managed?.kind==='official'&&!recoverable&&!retained){recordRescoreSkip(result,'official_rotation_evidence_unavailable');continue;}
  if(!retained&&!recoverable){recordRescoreSkip(result,"source_evidence_unavailable");continue;}
  const scoreMatchesActivePolicy=managed?.kind==='official'
   ?c?.policyId===managed.policy_id&&c?.rotationVersion===managed.id&&c?.mechanicsVersion===managed.mechanics_version&&managed.engine_version===ENGINE_VERSION&&managed.data_version===DATA_VERSION
   :c?.policyId===POLICY_VERSION;
  if(retained&&c.engineVersion===ENGINE_VERSION&&scoreMatchesActivePolicy&&c.displayStats&&typeof c.displayStats==='object'){recordRescoreSkip(result,'score_already_current');continue;}
  try{
   const recovered=recoverable?await recoverVisualEvidence(row,data,db):null;
   if(recoverable&&!recovered){recordRescoreSkip(result,"visual_recovery_unavailable");continue;}
   const numericIssues=data.slots.flatMap(s=>validateEchoSlot(s).map(issue=>({slot:s.slot,...issue})));
   if(recovered&&numericIssues.length){
    const next={...data,assessment:{...a,eligible:false,rollsVerified:false,visualRecovery:recovered.evidence,previousIdentityFailure:a.reason,visualReport:recovered.identities.map((s,i)=>({slot:i+1,cost:Number(data.slots[i].cost.value),echo:s.echo,set:s.set,problem:null})),scoringIssues:numericIssues,reason:'Echo '+numericIssues[0].slot+': '+numericIssues[0].message}};
    const tx=await db.transaction('write');try{
     const update=await tx.execute({sql:'UPDATE submissions SET data=? WHERE id=? AND data=? AND status=? AND identity_verified=? AND reviewed_at IS ?',args:[JSON.stringify(next),String(row.id),String(row.data),String(row.status),Number(row.identity_verified),row.reviewed_at]});if(update.rowsAffected!==1)throw Error('Build changed during diagnosis.');
     await tx.execute({sql:'INSERT INTO admin_audit_events VALUES (?,?,?,?,?,?)',args:[randomUUID(),String(row.id),'echo_identity_recovered_scoring_blocked','system',JSON.stringify({reason:next.assessment.reason,reference:recovered.evidence.referenceVersion,cropHash:recovered.evidence.cropHash,identities:recovered.identities}),new Date().toISOString()]});
     await tx.commit();result.updated++;
    }finally{tx.close();}continue;
   }
   const equipment=await assessEquipment(String(row.character),data.slots,recovered?.identities||c.identities);
   const tx=await db.transaction('write');
   try{
    const verifiedInputs={...data,assessment:{...a,...equipment,rollsVerified:true}};
    if(managed?.kind==='official'){
     const activeCalculation=await scoreActiveRotation(tx,String(row.character),verifiedInputs,managed);
     if(!activeCalculation)throw Error('Published rotation did not produce a scoring calculation.');
     equipment.calculation=activeCalculation;equipment.eligible=true;equipment.awaitingRotation=false;
    }else if(equipment.awaitingRotation){
     const reason='Equipment verified. Awaiting the owner’s first published rotation; this build remains unranked.';
     data.assessment={...a,...equipment,eligible:false,awaitingRotation:true,reason};
     const txResult=await tx.execute({sql:'UPDATE submissions SET data=? WHERE id=? AND data=? AND status=? AND identity_verified=? AND reviewed_at IS ?',args:[JSON.stringify(data),String(row.id),String(row.data),String(row.status),Number(row.identity_verified),row.reviewed_at]});
     if(txResult.rowsAffected!==1)throw Error('Build changed during awaiting-rotation update.');
     if(row.status==='approved')await tx.execute({sql:'DELETE FROM calculation_results WHERE submission_id=?',args:[String(row.id)]});
     await tx.execute({sql:'INSERT INTO build_events VALUES (?,?,?,?,?,?)',args:[randomUUID(),String(row.id),'awaiting_rotation','system',reason,new Date().toISOString()]});
     await tx.commit();result.awaitingRotationRecords.push({id:String(row.id),character:String(row.character),reason});continue;
    }
    const currentCalculation=equipment.calculation;
    data.assessment={...a,...equipment,eligible:true,awaitingRotation:false,rollsVerified:true,calculation:currentCalculation,...(recovered?{visualRecovery:recovered.evidence,visualReport:recovered.identities.map((s,i)=>({slot:i+1,cost:Number(data.slots[i].cost.value),echo:s.echo,set:s.set,problem:null}))}:{}),reason:recovered?'Server-verified source stats and retained visual evidence recovered after a reference-image correction.':'Source evidence retained; recalculated under the current scoring policy.'};
    const rotationGuard=managed?.kind==='official'?" AND EXISTS (SELECT 1 FROM rotation_active WHERE character=? AND version_id=?)":'';
    const rotationArgs=managed?.kind==='official'?[String(row.character),managed.id]:[];
    const updated=await tx.execute({sql:`UPDATE submissions SET data=? WHERE id=? AND data=? AND status=? AND identity_verified=? AND reviewed_at IS ?${rotationGuard}`,args:[JSON.stringify(data),String(row.id),String(row.data),String(row.status),Number(row.identity_verified),row.reviewed_at,...rotationArgs]});
    if(updated.rowsAffected!==1)throw Error('Build changed during rescore.');
    if(row.status==='approved')await tx.execute({sql:'INSERT INTO calculation_results(submission_id,score,engine_version,data_version,reference_case_version,verified_at,policy_id,details) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(submission_id) DO UPDATE SET score=excluded.score,engine_version=excluded.engine_version,data_version=excluded.data_version,reference_case_version=excluded.reference_case_version,verified_at=excluded.verified_at,policy_id=excluded.policy_id,details=excluded.details',args:[String(row.id),currentCalculation.score,ENGINE_VERSION,DATA_VERSION,currentCalculation.referenceCaseVersion,new Date().toISOString(),currentCalculation.policyId,JSON.stringify(currentCalculation)]});
    if(recovered)await tx.execute({sql:'INSERT INTO admin_audit_events VALUES (?,?,?,?,?,?)',args:[randomUUID(),String(row.id),'echo_reference_recovered','system',JSON.stringify({reason:a.reason,reference:recovered.evidence.referenceVersion,cropHash:recovered.evidence.cropHash,identities:recovered.identities}),new Date().toISOString()]});
    await tx.execute({sql:'INSERT INTO build_events VALUES (?,?,?,?,?,?)',args:[randomUUID(),String(row.id),'rescore','system',ENGINE_VERSION+'; '+currentCalculation.policyId+(recovered?'; '+recovered.evidence.version+'; '+(recovered.evidence.correction||recovered.evidence.referenceVersion):''),new Date().toISOString()]});
    await tx.commit();result.updated++;
   }finally{tx.close();}
  }catch(error){result.failed++;result.failedRecords.push({id:String(row.id),character:String(row.character),reason:(error instanceof Error?error.message:String(error)).slice(0,500)});}
 }
 return result;
}
