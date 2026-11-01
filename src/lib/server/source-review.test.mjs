import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {prepareManualSourceReview} from './source-review.mjs';

const slots=Array.from({length:5},(_,i)=>({slot:i+1,cost:{raw:'3',value:'3'},mainStat:{raw:'ATK',value:'ATK'},substats:[
 {raw:'Crit. Rate 6.3%',value:'Crit. Rate 6.3%'},{raw:'Crit. DMG 12.6%',value:'Crit. DMG 12.6%'},{raw:'ATK 7.1%',value:'ATK 7.1%'},{raw:'Energy Regen 6.8%',value:'Energy Regen 6.8%'},{raw:'DEF 40',value:'DEF 40'}
]}));
const image=Buffer.from('original card');
const row={uid:'9004004309',data:JSON.stringify({slots,character:'Luuk',assessment:{failure:{code:'SOURCE_FIELD_MISMATCH',slot:3,field:'cost'}}})};
const evidence={image,source_hash:createHash('sha256').update(image).digest('hex'),original_slots:JSON.stringify(slots)};

test('manual review requires screenshot UID and explicit confirmation',()=>{
 const base={confirmed:true,confirmedUid:row.uid,reviewer:'Moderator',manualCost:'4'};
 assert.throws(()=>prepareManualSourceReview(row,evidence,{...base,confirmed:false}),/confirm all five/i);
 assert.throws(()=>prepareManualSourceReview(row,evidence,{...base,confirmedUid:'123'}),/UID entered/i);
});
test('manual cost correction changes only flagged cost and records the correction',()=>{
 const result=prepareManualSourceReview(row,evidence,{confirmed:true,confirmedUid:row.uid,reviewer:'Moderator',note:'Checked card',manualCost:'4'});
 assert.equal(result.data.slots[2].cost.value,'4');
 assert.equal(result.data.slots[2].cost.raw,'3');
 assert.equal(result.data.assessment.sourceSlots[2].cost.value,'4');
 assert.deepEqual(result.costChange,{slot:3,from:'3',to:'4'});
 assert.equal(result.data.assessment.statsVerified,true);
 assert.equal(result.data.assessment.maxMainStatsVerified,undefined);
 assert.equal(result.sourceHash,evidence.source_hash);
});
test('manual review may confirm the currently parsed cost without inventing an edit',()=>{
 const result=prepareManualSourceReview(row,evidence,{confirmed:true,confirmedUid:row.uid,reviewer:'Moderator',manualCost:'3'});
 assert.equal(result.data.slots[2].cost.value,'3');
 assert.equal(result.costChange,null);
 assert.equal(result.manualCost,'3');
});
