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
