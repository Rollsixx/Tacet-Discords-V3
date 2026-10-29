import{test}from'node:test';import assert from'node:assert/strict';
import{assessmentReadiness}from'../scanner/scoring-readiness.ts';
const report=Array.from({length:5},(_,i)=>({slot:i+1,cost:1,echo:'GoldenJunrock',set:'FrostyResolve',problem:null}));
for(const character of ['Lucy','Lucilla','Rebecca'])test(character+' equipment readiness distinguishes missing official rotation from identity errors',()=>{
 const a={eligible:false,awaitingRotation:true,statsVerified:true,rollsVerified:true,visualReport:report,reason:'Awaiting official rotation'};
 assert.equal(assessmentReadiness(a).awaitingRotation,true);assert.equal(assessmentReadiness(a).ready,false);
 assert.equal(assessmentReadiness({...a,rollsVerified:false}).awaitingRotation,false);
 assert.equal(assessmentReadiness({...a,visualReport:report.slice(0,4)}).awaitingRotation,false);
 assert.equal(assessmentReadiness({...a,visualReport:report.map((s,i)=>i===0?{...s,echo:null}:s)}).awaitingRotation,false);
});
