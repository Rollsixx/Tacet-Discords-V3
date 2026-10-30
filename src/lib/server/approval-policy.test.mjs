import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ENGINE_VERSION,DATA_VERSION,POLICY_VERSION} from './scoring-versions.mjs';
import {isAutomaticApprovalReady,isRankableUnderActiveRotation} from './approval-policy.mjs';
import {featuredResonators} from '../resonators.ts';
const active={id:'rotation-2',kind:'official',policy_id:'policy-3'};
const valid={rotationVersion:'rotation-2',policyId:'policy-3',engineVersion:ENGINE_VERSION,dataVersion:DATA_VERSION,score:123};
const standard={policyId:POLICY_VERSION,engineVersion:ENGINE_VERSION,dataVersion:DATA_VERSION,score:456};
test('ranking accepts current shared benchmark policy and requires matching provenance for official rotations',()=>{
 assert.equal(isRankableUnderActiveRotation(valid,active),true);
 assert.equal(isRankableUnderActiveRotation({...valid,rotationVersion:'old-rotation'},active),false);
 assert.equal(isRankableUnderActiveRotation({...valid,policyId:'old-policy'},active),false);
 assert.equal(isRankableUnderActiveRotation({...valid,dataVersion:'old-data'},active),false);
 assert.equal(isRankableUnderActiveRotation({...valid,score:0},active),false);
 assert.equal(isRankableUnderActiveRotation(standard,{id:'baseline-Carlotta',kind:'baseline',policy_id:POLICY_VERSION}),true);
 assert.equal(isRankableUnderActiveRotation(standard,null),true);
 assert.equal(isRankableUnderActiveRotation(standard,{id:'baseline-Lucilla',kind:'baseline',policy_id:'awaiting-owner-rotation/1'}),false);
 assert.equal(isRankableUnderActiveRotation(standard,{...active,kind:'official'}),false);
 assert.equal(isRankableUnderActiveRotation({...standard,rotationVersion:'stale'},null),false);
});

test('verified, fully scoring-ready submissions use the same automatic approval gate for current supported and future Resonators',()=>{
 for(const resonator of featuredResonators){
  assert.equal(isAutomaticApprovalReady({identityVerified:true,assessment:{eligible:true},calculation:valid,rotation:active}),true,`automatic approval supports ${resonator.displayName||resonator.name}`);
 }
 assert.equal(isAutomaticApprovalReady({identityVerified:true,assessment:{eligible:true},calculation:standard,rotation:{id:'baseline-Hiyuki',kind:'baseline',policy_id:POLICY_VERSION}}),true);
 assert.equal(isAutomaticApprovalReady({identityVerified:true,assessment:{eligible:true},calculation:standard,rotation:null}),true);
 assert.equal(isAutomaticApprovalReady({identityVerified:false,assessment:{eligible:true},calculation:valid,rotation:active}),false);
 assert.equal(isAutomaticApprovalReady({identityVerified:true,assessment:{eligible:false},calculation:valid,rotation:active}),false);
 assert.equal(isAutomaticApprovalReady({identityVerified:true,assessment:{eligible:true},calculation:{...standard,engineVersion:'old'},rotation:null}),false);
 assert.equal(isAutomaticApprovalReady({identityVerified:true,assessment:{eligible:true},calculation:standard,rotation:{id:'baseline-Lucilla',kind:'baseline',policy_id:'awaiting-owner-rotation/1'}}),false);
 assert.equal(isAutomaticApprovalReady({identityVerified:true,assessment:{eligible:true},calculation:valid,rotation:active}),true,'a corrected build may rank after its server assessment passes');
 assert.equal(isAutomaticApprovalReady({identityVerified:true,assessment:{eligible:true},calculation:valid,rotation:active,hasCorrections:true}),true,'saved corrections do not block approval after full server revalidation');
});
