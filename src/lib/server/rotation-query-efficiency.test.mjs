import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createClient} from '@libsql/client';
import {migrate} from './database.ts';
import {initializeRotations} from './rotations/store.mjs';
import {refreshLeaderboardRankHistory} from './queries.ts';

function traceDatabase(client,counts){
 return new Proxy(client,{get(target,property){
  const value=Reflect.get(target,property,target);
  if(property==='execute')return async(...args)=>{
   const input=args[0],sql=typeof input==='string'?input:input?.sql||'';
   if(/^SELECT character FROM rotation_active\b/i.test(sql))counts.initializeReads++;
   if(/^SELECT v\.policy_id FROM rotation_active\b/i.test(sql))counts.perCharacterPolicyReads++;
   if(/^SELECT a\.character,v\.policy_id FROM rotation_active\b/i.test(sql))counts.batchPolicyReads++;
   return Reflect.apply(value,target,args);
  };
  if(property==='transaction')return async(...args)=>traceDatabase(await Reflect.apply(value,target,args),counts);
  return typeof value==='function'?value.bind(target):value;
 }});
}

test('rotation maintenance batches active-pointer and rank-refresh policy reads',async()=>{
 const db=createClient({url:'file::memory:'});
 try{
  await migrate(db);
  await initializeRotations(db);
  const counts={initializeReads:0,perCharacterPolicyReads:0,batchPolicyReads:0};
  const traced=traceDatabase(db,counts);
  await initializeRotations(traced);
  assert.equal(counts.initializeReads,1,'rotation initialization should read the active roster once');
  await refreshLeaderboardRankHistory(traced);
  assert.equal(counts.batchPolicyReads,1,'rank history should load all active policies in one query');
  assert.equal(counts.perCharacterPolicyReads,0,'rank history should not re-read the active policy per Resonator');
 }finally{db.close();}
});
