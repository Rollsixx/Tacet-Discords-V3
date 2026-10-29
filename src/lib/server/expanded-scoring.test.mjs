// SPDX-License-Identifier: GPL-3.0-or-later
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@libsql/client';
import * as engine from '../../../vendor/wuthering-tools/dist/index.mjs';
import {scoringPreset} from '../game-data/scoring-policies.mjs';
import {SUPPORTED,calculateStandard} from './scoring.mjs';
import {normalizeSpec,validateSpec} from './rotations/mechanics.mjs';
import {initializeRotations,rotationWorkspace} from './rotations/store.mjs';
import {migrate} from './database.ts';
import {listLeaderboard,listBuilds,moderate} from './store.ts';
import {parseCardIdentity} from '../scanner/card-identity.ts';
import cards from '../../../tests/browser/user-card-expectations.json' with {type:'json'};
import cases from '../game-data/scoring-cases.json' with {type:'json'};
const names=['Suoming','Jingran','Hsin','Qingxiao','Suisui','Denia','Sigrika'];
const card=cards.find(c=>c.file.startsWith('Carlotta'));
// Synthetic equipment combination, not a real player or an OCR accuracy claim.
const slots=Array.from({length:5},(_,i)=>({slot:i+1,cost:{value:card.fields[i*7]},mainStat:{value:card.fields[i*7+1]},substats:card.fields.slice(i*7+2,i*7+7).map(value=>({value}))}));
const identities=cases.cases.find(c=>c.character==='Carlotta').echoes;
test('expanded roster resolves canonical card names including the Souming alias',()=>{
 for(const name of names){assert.ok(SUPPORTED.includes(name));assert.equal(parseCardIdentity(name+' LV.90','Player ID:QA','UID:812345678').character,name);}
 assert.equal(parseCardIdentity('Souming LV.90','Player ID:QA','UID:812345678').character,'Suoming');
});
test('new benchmarks preserve pinned damage action counts and exclude healing, Echo and status-proc damage',async()=>{
 for(const name of names){
  const c=await engine.getCharByName(name),p=scoringPreset(name,c);
  const tables={basic:c.basicAttacks,skill:c.skillAttacks,forteCircuit:c.forteCircuitAttacks,liberation:c.liberationAttacks,intro:c.introAttacks,outro:c.outroAttacks,tuneBreak:c.tuneBreakAttacks};
  const allowed=c.rotations[0].data.actions.filter(a=>!a.isDisabled&&a.type!=='echoAttacks'&&tables[a.type]?.attacks?.some(t=>t.key===a.key&&!['Healing','Shield','ElementalEffect'].includes(t.type)));
  const totals=actions=>actions.reduce((m,a)=>(m[a.type+':'+a.key]=(m[a.type+':'+a.key]||0)+a.count,m),{});
  assert.deepEqual(totals(p.data.actions),totals(allowed),name);
  assert.ok(p.data.actions.every(a=>a.count<=20&&a.count>0));
  const spec=await normalizeSpec(name,{name:p.name,mode:'admin-reviewed',actions:p.data.actions.map(({type,key,count})=>({type,key,count}))});
  assert.equal((await validateSpec(name,spec)).valid,true,name);
  const result=await calculateStandard(name,slots,identities);
  assert.ok(Number.isFinite(result.score)&&result.score>0,name);
  assert.ok(Math.abs(result.score-result.actions.reduce((n,a)=>n+a.damage.expected,0))<1e-6,name+' total is expected damage');
  assert.equal(result.actions.length,p.data.actions.length);
  assert.equal(result.benchmarkMode,'legacy');
 }
});
test('new roster initializes insert-only and approved verified builds appear in their own leaderboards',async()=>{
 const db=createClient({url:'file::memory:'});try{
  await migrate(db);await initializeRotations(db);
  for(const [i,name] of names.entries()){
   const uid=String(812345670+i),id='synthetic-expanded-'+name,at=new Date().toISOString();
   const calculation=await calculateStandard(name,slots,identities);
   await db.execute({sql:'INSERT INTO players(uid,created_at,identity_verified,verified_at) VALUES (?,?,1,?)',args:[uid,at,at]});
   await db.execute({sql:"INSERT INTO submissions(id,uid,ign,character,fingerprint,data,status,created_at,identity_verified) VALUES (?,?,?,?,?,?,'pending',?,1)",args:[id,uid,'Synthetic QA',name,id,JSON.stringify({slots,assessment:{eligible:true,sourceHash:'a'.repeat(64),calculation}}),at]});
   assert.equal((await listLeaderboard({character:name},db)).builds.length,0);
   await moderate(id,'approved','QA','Synthetic test fixture',true,db);
   const rows=(await listLeaderboard({character:name},db)).builds;assert.equal(rows.length,1);assert.equal(rows[0].id,id);assert.equal(rows[0].score,calculation.score);
   assert.equal((await listBuilds({uid},db)).builds.length,1);
   const before=(await rotationWorkspace(db,name)).active;
   await initializeRotations(db);assert.deepEqual((await rotationWorkspace(db,name)).active,before);
  }
 }finally{db.close();}
});
