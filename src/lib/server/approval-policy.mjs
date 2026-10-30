import {ENGINE_VERSION,DATA_VERSION,POLICY_VERSION} from './scoring-versions.mjs';

export function isRankableUnderActiveRotation(calculation,rotation){
 const scoreIsCurrent=Boolean(calculation&&calculation.engineVersion===ENGINE_VERSION&&calculation.dataVersion===DATA_VERSION&&Number.isFinite(calculation.score)&&calculation.score>0);
 if(!scoreIsCurrent)return false;
 if(rotation&&rotation.kind!=='baseline')return calculation.rotationVersion===rotation.id&&calculation.policyId===rotation.policy_id;
 if(rotation?.kind==='baseline')return rotation.policy_id===POLICY_VERSION&&calculation.policyId===POLICY_VERSION&&(!calculation.rotationVersion||calculation.rotationVersion===rotation.id);
 return calculation.policyId===POLICY_VERSION&&!calculation.rotationVersion;
}

export function isAutomaticApprovalReady({identityVerified,assessment,calculation,rotation}){
 // Corrections are safe here only after the shared assessment has revalidated
 // every corrected roll and rebuilt the calculation from retained source data.
 return Boolean(identityVerified&&assessment?.eligible===true&&isRankableUnderActiveRotation(calculation,rotation));
}
