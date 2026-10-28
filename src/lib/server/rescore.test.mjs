import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createClient} from '@libsql/client';
import {migrate} from './database.ts';
import {fixture} from './fixtures.mjs';
import {validateSubmission} from './validation.ts';
import {submit,moderate,listLeaderboard} from './store.ts';
import {rescoreStoredBuilds} from './rescore.mjs';
import {DATA_VERSION,ENGINE_VERSION,POLICY_VERSION} from './scoring.mjs';
import cases from '../game-data/scoring-cases.json' with {type:'json'};
import cards from '../../../tests/browser/user-card-expectations.json' with {type:'json'};
test('retained server evidence upgrades atomically and rescore is idempotent',async()=>{
 const db=createClient({url:'file::memory:'});
 try{
  await migrate(db);const saved=await submit(validateSubmission(fixture()),db);
  const card=cards.find(c=>c.file.startsWith('Carlotta')),golden=cases.cases.find(c=>c.character==='Carlotta');
  const slots=Array.from({length:5},(_,i)=>({slot:i+1,cost:{raw:card.fields[i*7],value:card.fields[i*7]},mainStat:{raw:card.fields[i*7+1],value:card.fields[i*7+1]},substats:card.fields.slice(i*7+2,i*7+7).map(value=>({raw:value,value}))}));
  const data={slots,assessment:{eligible:true,sourceHash:'a'.repeat(64),calculation:{character:'Carlotta',identities:golden.echoes,dataVersion:DATA_VERSION,engineVersion:'wuthering-tools-b32cdbd+tacet/1.0',policyId:'solo-permanent-s0-signature-r1/1'}}};
  await db.execute({sql:"UPDATE submissions SET character='Carlotta',data=? WHERE id=?",args:[JSON.stringify(data),saved.id]});
  await moderate(saved.id,'approved','QA','',true,db);
  assert.equal((await listLeaderboard({},db)).builds.length,0);
  assert.deepEqual(await rescoreStoredBuilds(db),{updated:1,skipped:0,failed:0});
  assert.ok(Math.abs((await listLeaderboard({},db)).builds[0].score-golden.score)<1e-6);
  const calculation=(await db.execute('SELECT engine_version,policy_id FROM calculation_results')).rows[0];
  assert.equal(calculation.engine_version,ENGINE_VERSION);assert.equal(calculation.policy_id,POLICY_VERSION);
  assert.deepEqual(await rescoreStoredBuilds(db),{updated:0,skipped:1,failed:0});
  assert.equal(Number((await db.execute("SELECT COUNT(*) AS n FROM build_events WHERE action='rescore'")).rows[0].n),1);
 }finally{db.close();}
});

test('visual recovery requires complete server validation and bounded legacy moderator proof',async()=>{
 const {recoveryMode,hasRetainedRecovery,recoverVisualEvidence}=await import('./visual-recovery.mjs');
 const slots=Array.from({length:5},(_,i)=>({slot:i+1,cost:{value:i===0?'4':i<3?'3':'1'},mainStat:{value:'ATK'},substats:[]}));
 const row={id:'test',uid:'812345678',status:'approved',identity_verified:1,reviewed_at:'2026-10-28T00:00:00.000Z'};
 const data={slots,assessment:{eligible:false,statsVerified:true,sourceUid:row.uid,sourceSlots:slots,reason:'Echo 3 is unknown or ambiguous.'}};
 assert.equal(recoveryMode(row,data),'moderated-crop-recovery/1');
 for(const change of [{status:'pending'},{identity_verified:0},{reviewed_at:null},{uid:'899999999'}])assert.equal(recoveryMode({...row,...change},data),null);
 for(const change of [{statsVerified:false},{sourceUid:'899999999'},{reason:'Max-level main-stat amount could not be confirmed in slot 3.'},{reason:'Source substat OCR does not match reviewed field 3.1.'},{sourceSlots:[]},{sourceHash:'forged'}])assert.equal(recoveryMode(row,{...data,assessment:{...data.assessment,...change}}),null);
 const canonical={...data,assessment:{...data.assessment,sourceHash:'a'.repeat(64),cropEvidenceVersion:'source-crops/1',maxMainStatsVerified:true}};
 assert.equal(recoveryMode({...row,status:'pending',identity_verified:0},canonical),'source-crops/1');
 assert.equal(recoveryMode(row,{...canonical,assessment:{...canonical.assessment,maxMainStatsVerified:false}}),null);
 assert.equal(hasRetainedRecovery({statsVerified:true,visualRecovery:{version:'moderated-crop-recovery/1',cropHash:'a'.repeat(64),correction:'unknown',approvedAt:row.reviewed_at}}),false);
 const db=createClient({url:'file::memory:'});try{await migrate(db);await assert.rejects(recoverVisualEvidence(row,data,db),/all ten/);}finally{db.close();}
});
