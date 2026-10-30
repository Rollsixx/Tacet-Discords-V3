import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ENGINE_VERSION,DATA_VERSION} from './scoring-versions.mjs';
import {isAutomaticApprovalReady,isRankableUnderActiveRotation} from './approval-policy.mjs';
import {featuredResonators} from '../resonators.ts';
const active={id:'rotation-2',kind:'official',policy_id:'policy-3'};
const valid={rotationVersion:'rotation-2',policyId:'policy-3',engineVersion:ENGINE_VERSION,dataVersion:DATA_VERSION,score:123};
test('ranking requires a current official rotation and matching score provenance',()=>{
 assert.equal(isRankableUnderActiveRotation(valid,active),true);
 assert.equal(isRankableUnderActiveRotation({...valid,rotationVersion:'old-rotation'},active),false);
 assert.equal(isRankableUnderActiveRotation({...valid,policyId:'old-policy'},active),false);
 assert.equal(isRankableUnderActiveRotation({...valid,dataVersion:'old-data'},active),false);
 assert.equal(isRankableUnderActiveRotation({...valid,score:0},active),false);
 assert.equal(isRankableUnderActiveRotation(valid,{...active,kind:'baseline'}),false);
 assert.equal(isRankableUnderActiveRotation(valid,null),false);
});

test('verified, fully scoring-ready submissions use one automatic approval gate for the whole roster',()=>{
 for(const resonator of featuredResonators){
  assert.equal(isAutomaticApprovalReady({identityVerified:true,assessment:{eligible:true},calculation:valid,rotation:active}),true,`automatic approval supports ${resonator.displayName||resonator.name}`);
 }
 assert.equal(isAutomaticApprovalReady({identityVerified:false,assessment:{eligible:true},calculation:valid,rotation:active}),false);
 assert.equal(isAutomaticApprovalReady({identityVerified:true,assessment:{eligible:false},calculation:valid,rotation:active}),false);
 assert.equal(isAutomaticApprovalReady({identityVerified:true,assessment:{eligible:true},calculation:valid,rotation:null}),false);
 assert.equal(isAutomaticApprovalReady({identityVerified:true,assessment:{eligible:true},calculation:valid,rotation:active,hasCorrections:true}),false);
});
