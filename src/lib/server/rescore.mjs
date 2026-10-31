import {hasRetainedRecovery,recoverVisualEvidence,recoveryMode} from './visual-recovery.mjs';
import {initializeRotations,scoreActiveRotation} from './rotations/store.mjs';
import {validateEchoSlot} from '../scanner/stat-validation.ts';
import {randomUUID} from 'node:crypto';
import {assessEquipment,ENGINE_VERSION,DATA_VERSION,POLICY_VERSION,SUPPORTED} from './scoring.mjs';
import {correctionLedgerVerified} from './correction-workflow.mjs';
// Reuse only previously server-validated evidence from this known data snapshot.
// Old unsupported/no-evidence submissions must be resubmitted with an original.
export async function rescoreStoredBuilds(db){
 await initializeRotations(db);
 const rows=await db.execute("SELECT id,uid,character,status,identity_verified,reviewed_at,data FROM submissions WHERE status IN ('pending','approved') AND replaced_by IS NULL");
 const result={updated:0,skipped:0,failed:0,awaitingRotationRecords:[],failedRecords:[]};
 for(const row of rows.rows){
  const data=JSON.parse(String(row.data)),a=data.assessment,c=a?.calculation;
  const managed=(await db.execute({sql:"SELECT v.id,v.kind,v.policy_id FROM rotation_active a JOIN rotation_versions v ON v.id=a.version_id WHERE a.character=?",args:[String(row.character)]})).rows[0];
  if(!SUPPORTED.includes(String(row.character))){result.skipped++;continue;}
  if((data.substatCorrections||[]).length&&!correctionLedgerVerified(data)){result.skipped++;continue;}
  if(a?.statsVerified!==true||a?.maxMainStatsVerified!==true){result.skipped++;continue;}
  const recoverable=recoveryMode(row,data);
  const retained=a?.eligible&&(/^[a-f0-9]{64}$/.test(a.sourceHash||'')||hasRetainedRecovery(a))&&c?.dataVersion===DATA_VERSION&&c.engineVersion?.startsWith('wuthering-tools-b32cdbd+tacet/')&&c.identities?.length===5&&c.character===String(row.character);
  if(managed?.kind==='official'&&!recoverable&&!retained){result.skipped++;continue;}
  if(!retained&&!recoverable){result.skipped++;continue;}
  if(retained&&c.engineVersion===ENGINE_VERSION&&c.policyId===POLICY_VERSION&&c.displayStats&&typeof c.displayStats==='object'){result.skipped++;continue;}
  try{
   const recovered=recoverable?await recoverVisualEvidence(row,data,db):null;
   if(recoverable&&!recovered){result.skipped++;continue;}
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
     const activeCalculation=await scoreActiveRotation(tx,String(row.character),verifiedInputs);
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
    const updated=await tx.execute({sql:'UPDATE submissions SET data=? WHERE id=? AND data=? AND status=? AND identity_verified=? AND reviewed_at IS ?',args:[JSON.stringify(data),String(row.id),String(row.data),String(row.status),Number(row.identity_verified),row.reviewed_at]});
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
