import {ENGINE_VERSION,DATA_VERSION} from './scoring-versions.mjs';
export function isRankableUnderActiveRotation(calculation,rotation){
 return Boolean(calculation&&rotation&&rotation.kind!=='baseline'&&calculation.rotationVersion===rotation.id&&calculation.policyId===rotation.policy_id&&calculation.engineVersion===ENGINE_VERSION&&calculation.dataVersion===DATA_VERSION&&Number.isFinite(calculation.score)&&calculation.score>0);
}

export function isAutomaticApprovalReady({identityVerified,assessment,calculation,rotation,hasCorrections=false}){
 return Boolean(identityVerified&&assessment?.eligible===true&&!hasCorrections&&isRankableUnderActiveRotation(calculation,rotation));
}
