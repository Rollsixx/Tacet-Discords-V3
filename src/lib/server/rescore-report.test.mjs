import test from 'node:test';
import assert from 'node:assert/strict';
import {recordRescoreSkip} from './rescore-report.mjs';
test('rescore skip report keeps aggregate and reason counts in sync',()=>{
 const result={skipped:0,skippedReasons:{}};
 recordRescoreSkip(result,'source_evidence_unavailable');
 recordRescoreSkip(result,'source_evidence_unavailable');
 recordRescoreSkip(result,'score_already_current');
 assert.equal(result.skipped,3);
 assert.deepEqual(result.skippedReasons,{source_evidence_unavailable:2,score_already_current:1});
});
