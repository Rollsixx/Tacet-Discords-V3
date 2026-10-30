import assert from 'node:assert/strict';
import test from 'node:test';
import {createClient} from '@libsql/client';
import {migrate} from './database.ts';
import {autoApproveVerifiedPendingBuilds} from './store.ts';
import {listBuilds,listLeaderboard} from './queries.ts';
import {seedCorrection,ensureTestRotation} from '../../../tests/fixtures/corrected-build.mjs';

test('a newer eligible verified import replaces the same UID and Resonator build',async()=>{
 const db=createClient({url:'file::memory:'});
 try{
  await migrate(db);await ensureTestRotation(db,'Lucy');
  const old=await seedCorrection(db,'Lucy',{incorrect:false,uid:'833333355'});
  assert.equal((await autoApproveVerifiedPendingBuilds(old.uid,db)).approved,1);
  const first=(await listLeaderboard({character:'Lucy',search:old.uid},db)).builds[0];
  assert.equal(first.id,old.id);

  const next=await seedCorrection(db,'Lucy',{incorrect:false,uid:old.uid});
  assert.equal((await autoApproveVerifiedPendingBuilds(next.uid,db)).approved,1);
  const current=(await listLeaderboard({character:'Lucy',search:old.uid},db)).builds;
  assert.equal(current.length,1);
  assert.equal(current[0].id,next.id);
  assert.equal((await listBuilds({id:old.id},db)).builds.length,0);
  assert.equal((await db.execute({sql:'SELECT replaced_by FROM submissions WHERE id=?',args:[old.id]})).rows[0].replaced_by,next.id);
  const audit=await db.execute({sql:"SELECT action,note FROM admin_audit_events WHERE submission_id=? AND action='build_replaced'",args:[old.id]});
  assert.equal(audit.rows.length,1);assert.equal(JSON.parse(String(audit.rows[0].note)).replacedBy,next.id);
  assert.equal((await db.execute({sql:'SELECT COUNT(*) n FROM submission_source_evidence WHERE submission_id=?',args:[old.id]})).rows[0].n,1);
 }finally{db.close();}
});

test('a substat-blocked replacement stays pending until correction validates and ranks it',async()=>{
 const {correctEchoSubstat}=await import('./correction-workflow.mjs');
 const db=createClient({url:'file::memory:'});
 try{
  await migrate(db);await ensureTestRotation(db,'Lucy');
  const old=await seedCorrection(db,'Lucy',{incorrect:false,uid:'833333356'});
  assert.equal((await autoApproveVerifiedPendingBuilds(old.uid,db)).approved,1);
  const blocked=await seedCorrection(db,'Lucy',{incorrect:true,uid:old.uid});
  assert.deepEqual(await autoApproveVerifiedPendingBuilds(old.uid,db),{approved:0,checked:1});
  assert.equal((await listLeaderboard({character:'Lucy',search:old.uid},db)).builds[0].id,old.id);
  const corrected=await correctEchoSubstat(blocked.id,blocked.slot,blocked.position,'DEF 8.1%','DEF 11.8%','QA','',db);
  assert.equal(corrected.ranked,true,corrected.reason);
  assert.equal((await listLeaderboard({character:'Lucy',search:old.uid},db)).builds[0].id,blocked.id);
  assert.equal((await listBuilds({id:old.id},db)).builds.length,0);
  assert.equal((await db.execute({sql:'SELECT replaced_by FROM submissions WHERE id=?',args:[old.id]})).rows[0].replaced_by,blocked.id);
 }finally{db.close();}
});
