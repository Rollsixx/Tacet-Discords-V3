import {hasRetainedRecovery,recoverVisualEvidence,recoveryMode} from './visual-recovery.mjs';
import {scoreActiveRotation,recordRotationScore} from './rotations/store.mjs';
import {validateEchoSlot} from '../scanner/stat-validation.ts';
import {randomUUID} from 'node:crypto';
import {calculateStandard,ENGINE_VERSION,DATA_VERSION,POLICY_VERSION,SUPPORTED} from './scoring.mjs';
// Reuse only previously server-validated evidence from this known data snapshot.
// Old unsupported/no-evidence submissions must be resubmitted with an original.
export async function rescoreStoredBuilds(db){
 const rows=await db.execute("SELECT id,uid,character,status,identity_verified,reviewed_at,data FROM submissions WHERE status IN ('pending','approved') AND replaced_by IS NULL");
 const result={updated:0,skipped:0,failed:0};
 for(const row of rows.rows){
  const data=JSON.parse(String(row.data)),a=data.assessment,c=a?.calculation;
  const managed=(await db.execute({sql:"SELECT v.kind FROM rotation_active a JOIN rotation_versions v ON v.id=a.version_id WHERE a.character=?",args:[String(row.character)]})).rows[0];
  if(!SUPPORTED.includes(String(row.character))){result.skipped++;continue;}
  const recoverable=recoveryMode(row,data);
  if(managed?.kind==='official'&&!recoverable){result.skipped++;continue;}
  const retained=a?.eligible&&(/^[a-f0-9]{64}$/.test(a.sourceHash||'')||hasRetainedRecovery(a))&&c?.dataVersion===DATA_VERSION&&c.engineVersion?.startsWith('wuthering-tools-b32cdbd+tacet/')&&c.identities?.length===5&&c.character===String(row.character);
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
   const calculation=await calculateStandard(String(row.character),data.slots,recovered?.identities||c.identities);
   const tx=await db.transaction('write');
   try{
    data.assessment={...a,eligible:true,rollsVerified:true,calculation,...(recovered?{visualRecovery:recovered.evidence,visualReport:recovered.identities.map((s,i)=>({slot:i+1,cost:Number(data.slots[i].cost.value),echo:s.echo,set:s.set,problem:null}))}:{}),reason:recovered?'Server-verified source stats and retained visual evidence recovered after a reference-image correction.':'Source evidence retained; recalculated under the current scoring policy.'};
    const updated=await tx.execute({sql:'UPDATE submissions SET data=? WHERE id=? AND data=? AND status=? AND identity_verified=? AND reviewed_at IS ?',args:[JSON.stringify(data),String(row.id),String(row.data),String(row.status),Number(row.identity_verified),row.reviewed_at]});
    if(updated.rowsAffected!==1)throw Error('Build changed during rescore.');
    const currentCalculation=row.status==='approved'?await scoreActiveRotation(tx,String(row.character),data)||calculation:calculation;
    if(row.status==='approved')await tx.execute({sql:'INSERT INTO calculation_results(submission_id,score,engine_version,data_version,reference_case_version,verified_at,policy_id,details) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(submission_id) DO UPDATE SET score=excluded.score,engine_version=excluded.engine_version,data_version=excluded.data_version,reference_case_version=excluded.reference_case_version,verified_at=excluded.verified_at,policy_id=excluded.policy_id,details=excluded.details',args:[String(row.id),currentCalculation.score,ENGINE_VERSION,DATA_VERSION,currentCalculation.referenceCaseVersion,new Date().toISOString(),currentCalculation.policyId,JSON.stringify(currentCalculation)]});
    if(row.status==='approved')await recordRotationScore(tx,String(row.id),String(row.character),data,currentCalculation,new Date().toISOString());
    if(recovered)await tx.execute({sql:'INSERT INTO admin_audit_events VALUES (?,?,?,?,?,?)',args:[randomUUID(),String(row.id),'echo_reference_recovered','system',JSON.stringify({reason:a.reason,reference:recovered.evidence.referenceVersion,cropHash:recovered.evidence.cropHash,identities:recovered.identities}),new Date().toISOString()]});
    await tx.execute({sql:'INSERT INTO build_events VALUES (?,?,?,?,?,?)',args:[randomUUID(),String(row.id),'rescore','system',ENGINE_VERSION+'; '+currentCalculation.policyId+(recovered?'; '+recovered.evidence.version+'; '+(recovered.evidence.correction||recovered.evidence.referenceVersion):''),new Date().toISOString()]});
    await tx.commit();result.updated++;
   }finally{tx.close();}
  }catch{result.failed++;}
 }
 return result;
}
