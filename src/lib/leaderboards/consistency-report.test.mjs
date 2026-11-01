import test from "node:test";
import assert from "node:assert/strict";
import {buildDataConsistencyReport} from "./consistency-report.mjs";

test("consistency report summarizes healthy state",()=>{
 const report=buildDataConsistencyReport({checkedAt:"2026-11-01T00:00:00.000Z"});
 assert.equal(report.ok,true);
 assert.deepEqual(report.counts,{staleScores:0,duplicateBuilds:0,medalMismatches:0});
 assert.deepEqual(report.issues,[]);
});
test("consistency report identifies stale scores, duplicate builds, and medal discrepancies",()=>{
 const report=buildDataConsistencyReport({
  staleScores:[{id:"b1",uid:"900000001",character:"Mornye",reason:"Old engine version"}],
  duplicateBuilds:[{uid:"900000002",character:"Brant",count:2}],
  medalMismatches:[{uid:"900000003",profile:{gold:1,silver:0,bronze:0},standings:{gold:0,silver:1,bronze:0}}],
  checkedAt:"2026-11-01T00:00:00.000Z"
 });
 assert.equal(report.ok,false);
 assert.deepEqual(report.counts,{staleScores:1,duplicateBuilds:1,medalMismatches:1});
 assert.deepEqual(report.issues.map(x=>x.type),["stale-score","duplicate-active-build","medal-total-mismatch"]);
});
