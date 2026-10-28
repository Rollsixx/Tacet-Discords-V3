import {hasRetainedRecovery,recoverVisualEvidence,recoveryMode} from './visual-recovery.mjs';
import {randomUUID} from 'node:crypto';
import {calculateStandard,ENGINE_VERSION,DATA_VERSION,POLICY_VERSION,SUPPORTED} from './scoring.mjs';
// Reuse only previously server-validated evidence from this known data snapshot.
// Old unsupported/no-evidence submissions must be resubmitted with an original.
export async function rescoreStoredBuilds(db){
 const rows=await db.execute("SELECT id,uid,character,status,identity_verified,reviewed_at,data FROM submissions WHERE status IN ('pending','approved')");
 const result={updated:0,skipped:0,failed:0};
 for(const row of rows.rows){
  const data=JSON.parse(String(row.data)),a=data.assessment,c=a?.calculation;
  if(!SUPPORTED.includes(String(row.character))){result.skipped++;continue;}
  const recoverable=recoveryMode(row,data);
  const retained=a?.eligible&&(/^[a-f0-9]{64}$/.test(a.sourceHash||'')||hasRetainedRecovery(a))&&c?.dataVersion===DATA_VERSION&&c.engineVersion?.startsWith('wuthering-tools-b32cdbd+tacet/')&&c.identities?.length===5&&c.character===String(row.character);
  if(!retained&&!recoverable){result.skipped++;continue;}
  if(retained&&c.engineVersion===ENGINE_VERSION&&c.policyId===POLICY_VERSION){result.skipped++;continue;}
  try{
   const recovered=recoverable?await recoverVisualEvidence(row,data,db):null;
   if(recoverable&&!recovered){result.skipped++;continue;}
   const calculation=await calculateStandard(String(row.character),data.slots,recovered?.identities||c.identities);
   const tx=await db.transaction('write');
   try{
    data.assessment={...a,eligible:true,calculation,...(recovered?{visualRecovery:recovered.evidence}:{}),reason:recovered?'Server-verified source stats and retained visual evidence recovered after a reference-image correction.':'Source evidence retained; recalculated under the current scoring policy.'};
    const updated=await tx.execute({sql:'UPDATE submissions SET data=? WHERE id=? AND data=? AND status=? AND identity_verified=? AND reviewed_at IS ?',args:[JSON.stringify(data),String(row.id),String(row.data),String(row.status),Number(row.identity_verified),row.reviewed_at]});
    if(updated.rowsAffected!==1)throw Error('Build changed during rescore.');
    if(row.status==='approved')await tx.execute({sql:'INSERT INTO calculation_results(submission_id,score,engine_version,data_version,reference_case_version,verified_at,policy_id,details) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(submission_id) DO UPDATE SET score=excluded.score,engine_version=excluded.engine_version,data_version=excluded.data_version,reference_case_version=excluded.reference_case_version,verified_at=excluded.verified_at,policy_id=excluded.policy_id,details=excluded.details',args:[String(row.id),calculation.score,ENGINE_VERSION,DATA_VERSION,calculation.referenceCaseVersion,new Date().toISOString(),POLICY_VERSION,JSON.stringify(calculation)]});
    await tx.execute({sql:'INSERT INTO build_events VALUES (?,?,?,?,?,?)',args:[randomUUID(),String(row.id),'rescore','system',ENGINE_VERSION+'; '+POLICY_VERSION+(recovered?'; '+recovered.evidence.version+'; '+(recovered.evidence.correction||recovered.evidence.referenceVersion):''),new Date().toISOString()]});
    await tx.commit();result.updated++;
   }finally{tx.close();}
  }catch{result.failed++;}
 }
 return result;
}
