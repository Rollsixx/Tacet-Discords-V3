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
