import {test} from 'node:test';import assert from 'node:assert/strict';
import {recoverStatReading,legalSubstatKey} from './ocr-readings.ts';
test('invalid numeric OCR is recovered only from two agreeing legal image reads and keeps the raw evidence',async()=>{
 const primary={raw:'ATK RR',value:'ATK RR'};
 assert.deepEqual(await recoverStatReading(primary,async()=> 'ATK 7.9%',legalSubstatKey),{raw:'ATK RR',value:'ATK 7.9%',autoRecovered:true});
 for(const readings of [['ATK 7.9%','ATK 8.6%'],['DEF 11.9%','DEF 11.9%'],['ATK 7.9%','ATK RR']])assert.equal(await recoverStatReading(primary,async i=>readings[i],legalSubstatKey),primary);
 const legal={raw:'ATK 8.6%',value:'ATK 8.6%'};assert.equal(await recoverStatReading(legal,async()=>{throw Error('Must not replace a legal value');},legalSubstatKey),legal);
});
