import {test} from 'node:test';import assert from 'node:assert/strict';
import {assessmentReadiness} from './scoring-readiness.ts';
const report=Array.from({length:5},(_,i)=>({slot:i+1,cost:1,echo:'known',set:'known',problem:null}));
for(const name of ['Lucy','Lucilla','FutureSupported'])test(name+' legacy missing-rotation flag does not ask for equipment review',()=>{
 const r=assessmentReadiness({statsVerified:true,rollsVerified:true,visualReport:report,reason:"Equipment verified. Awaiting the owner's first published rotation; this build remains unranked."});assert.equal(r.equipmentReady,true);assert.equal(r.awaitingRotation,true);
});
test('numeric and identity failures are not hidden behind missing rotation',()=>{
 assert.equal(assessmentReadiness({statsVerified:true,rollsVerified:false,awaitingRotation:true,visualReport:report}).awaitingRotation,false);
 assert.equal(assessmentReadiness({statsVerified:true,rollsVerified:true,awaitingRotation:true,visualReport:report.map((r,i)=>i===0?{...r,echo:null}:r)}).equipmentReady,false);
});
test('eligible published calculation overrides stale awaiting flag',()=>{const r=assessmentReadiness({eligible:true,awaitingRotation:true,visualReport:report});assert.equal(r.ready,true);assert.equal(r.awaitingRotation,false);});
