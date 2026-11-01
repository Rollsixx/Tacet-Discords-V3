import assert from 'node:assert/strict';
import {test} from 'node:test';
import {recoverEchoCost} from './cost-recovery.ts';
test('missing cost recovers only from agreeing confident image reads, retaining raw OCR',async()=>{
 const attempts=[];
 assert.deepEqual(await recoverEchoCost({raw:'',value:''},async variant=>{attempts.push(variant);return {text:'1\n',confidence:95};}),{raw:'',value:'1',autoRecovered:true});
 assert.deepEqual(attempts,[0,1]);
});
test('cost retries never replace a valid cost or infer an unknown digit',async()=>{
 for(const digit of ['1','3','4'])assert.deepEqual(await recoverEchoCost({raw:digit,value:digit},()=>{throw Error('Must not retry');}),{raw:digit,value:digit});
 for(const reads of [[['1',95],['3',95]],[['1',64],['1',99]],[['',99],['',99]],[['7',99],['7',99]],[['11',99],['11',99]]]){
 const original={raw:'?',value:'?'};
 assert.equal(await recoverEchoCost(original,async i=>({text:reads[i][0],confidence:reads[i][1]})),original);
 }
});

test('a legal but conflicting first read is retried and corrected only by two confident matching reads',async()=>{
 const attempts=[];
 const result=await recoverEchoCost({raw:'3',value:'3'},async variant=>{attempts.push(variant);return {text:'4',confidence:variant===0?92:88};},'4');
 assert.deepEqual(result,{raw:'3',value:'4',autoRecovered:true});
 assert.deepEqual(attempts,[0,1]);
});
test('a conflicting legal read remains locked unless both independent reads match the scan',async()=>{
 for(const reads of [[['3',95],['4',95]],[['4',64],['4',95]],[['1',95],['1',95]]]){
  const original={raw:'3',value:'3'};
  const result=await recoverEchoCost(original,async i=>({text:reads[i][0],confidence:reads[i][1]}),'4');
  assert.equal(result,original);
 }
});
