import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createClient} from '@libsql/client';
import sharp from 'sharp';
import * as engine from '../../../vendor/wuthering-tools/dist/index.mjs';
import cases from '../game-data/scoring-cases.json' with {type:'json'};
import baseCases from '../game-data/upstream-base-cases.json' with {type:'json'};
import manifest from '../game-data/manifest.json' with {type:'json'};
import {identifySlots,calculateStandard,matchVisual,ENGINE_VERSION,DATA_VERSION,POLICY_VERSION} from './scoring.mjs';
import {migrate} from './database.ts';
import {submit,moderate,listLeaderboard,listBuilds} from './store.ts';
import {validateSubmission} from './validation.ts';
import {fixture} from './fixtures.mjs';
import {assessSource} from './source-evidence.mjs';
const originals=process.env.USER_BUILD_CARDS_DIRECTORY;
const cards=JSON.parse(await readFile(new URL('../../../tests/browser/user-card-expectations.json',import.meta.url),'utf8'));
function inputFor(card){return {uid:process.env.USER_BUILD_CARD_UID||'812355555',ign:'Scoring QA',character:card.file.split('(')[0],slots:Array.from({length:5},(_,i)=>({slot:i+1,cost:{raw:card.fields[i*7],value:card.fields[i*7]},mainStat:{raw:card.fields[i*7+1],value:card.fields[i*7+1]},substats:card.fields.slice(i*7+2,i*7+7).map(v=>({raw:v,value:v}))}))};}
test('scoring catalog integrity and 18 upstream full-calculator base cases',async()=>{
 const bytes=await readFile(new URL('../game-data/official-scoring.json',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);
 const built=await engine.buildCharacterCalculationContext('Carlotta',{Carlotta:{}},{enemyLevel:90,enemyResist:.1,enemyType:'Calamity'});
 const output=Object.values(engine.calcDamages(built.context)).flat().filter(x=>x?.damage);
 for(const [label,normal,average,critical] of baseCases.cases){const attack=output.find(x=>x.label===label);assert.ok(attack,label);assert.deepEqual([Math.ceil(attack.damage.totalDamage),Math.ceil(attack.damage.avgDamage),Math.ceil(attack.damage.critDamage)],[+normal,+average,+critical]);}
});
for(const golden of cases.cases)test('frozen rotation calculation: '+golden.character,async()=>{
 const card=cards.find(c=>c.file.startsWith(golden.character));
 const result=await calculateStandard(golden.character,inputFor(card).slots,golden.echoes);
 assert.ok(Math.abs(result.score-golden.score)<1e-6);
 assert.equal(result.actions.length,golden.actionCount);
 assert.equal(result.weapon,golden.weapon);
});
test('unknown images and forged/missing evidence do not obtain scores',async()=>{
 assert.equal((await assessSource({character:'Carlotta',slots:[]})).eligible,false);
 const noise=await sharp({create:{width:1920,height:1080,channels:3,background:'#101010'}}).png().toBuffer();
 await assert.rejects(identifySlots(noise,[4,3,3,1,1]));
 assert.equal(matchVisual({hash:'0'.repeat(16),hist:Array(24).fill(0)},[],.18,.025),null);
 assert.equal((await assessSource({character:'Hiyuki',sourceImage:noise,slots:[]})).eligible,false);
});
test('only approved, identity-verified and current-version calculations enter rankings',async()=>{
 const db=createClient({url:'file::memory:'});
 try{
  await migrate(db);const saved=await submit(validateSubmission(fixture()),db);
  const calculation={...cases.cases[0],policyId:POLICY_VERSION,engineVersion:ENGINE_VERSION,dataVersion:DATA_VERSION,referenceCaseVersion:'reference-cases/1'};
  // Seed the server assessment directly in the isolated DB; clients have no such API.
  const row=await db.execute({sql:'SELECT data FROM submissions WHERE id=?',args:[saved.id]});const data=JSON.parse(row.rows[0].data);data.assessment={eligible:true,reason:'test server assessment',calculation};
  await db.execute({sql:"UPDATE submissions SET character='Carlotta',data=? WHERE id=?",args:[JSON.stringify(data),saved.id]});
  assert.equal((await listLeaderboard({},db)).builds.length,0);
  await moderate(saved.id,'approved','QA','',false,db);
  assert.equal((await listLeaderboard({},db)).builds.length,0);
  await db.execute({sql:'UPDATE submissions SET identity_verified=1 WHERE id=?',args:[saved.id]});
  assert.equal((await listLeaderboard({},db)).builds[0].score,calculation.score);
  await db.execute({sql:"UPDATE calculation_results SET engine_version='stale' WHERE submission_id=?",args:[saved.id]});
  assert.equal((await listLeaderboard({},db)).builds.length,0);
  assert.equal((await listBuilds({id:saved.id},db)).builds[0].score,null);
 }finally{db.close();}
});
for(const golden of cases.cases)test('original source evidence and official lifecycle: '+golden.character,{skip:!originals||!process.env.USER_BUILD_CARD_UID,timeout:60000},async()=>{
 const card=cards.find(c=>c.file.startsWith(golden.character));const image=await readFile(originals+'/'+card.file);const input=inputFor(card);
 const result=await assessSource({...input,sourceImage:image});assert.equal(result.eligible,true,result.reason);
 assert.ok(Math.abs(result.calculation.score-golden.score)<1e-6);
});

test('client-supplied score and assessment cannot issue a calculation',async()=>{
 const db=createClient({url:'file::memory:'});
 try{await migrate(db);const body=fixture();body.character='Carlotta';body.score=999999;body.assessment={eligible:true,calculation:{score:999999}};
 const saved=await submit(validateSubmission(body),db);
 await moderate(saved.id,'approved','QA','',true,db);
 assert.equal((await listBuilds({id:saved.id},db)).builds[0].score,null);
 assert.equal((await listLeaderboard({},db)).builds.length,0);
 }finally{db.close();}
});
test('a source card with a different UID cannot obtain scoring evidence',{skip:!originals,timeout:60000},async()=>{
 const card=cards.find(c=>c.file.startsWith('Carlotta'));
 const result=await assessSource({...inputFor(card),uid:'00000000',sourceImage:await readFile(originals+'/'+card.file)});
 assert.equal(result.eligible,false);assert.match(result.reason,/UID/);
 const db=createClient({url:'file::memory:'});
 try {
  await migrate(db);
  const forged={...validateSubmission(fixture('00000000')),character:'Carlotta',sourceImage:await readFile(originals+'/'+card.file)};
  await assert.rejects(submit(forged,db,true),e=>e.status===400&&/UID/.test(e.message));
  assert.equal((await listBuilds({pending:true},db)).builds.length,0);
 }finally{db.close();}
});

test('Tacet windows agree with the independent hit core and explicit level-10 kit coefficients',async()=>{
 const {evaluateHit}=await import('./damage-core.ts');
 // Transcribed from the pinned level-10 kit tables, not derived from the adapter.
 const windows={Hiyuki:[[.4927,'lib',1],[.8004,'lib',1],[1.6772,'lib',1],[1.4965,'lib',1],[1.2164,'lib',1],[2.6404,'skill',1],[4.7306,'lib',3],[6.1633,'lib',1],[9.9405,'lib',1]],Chisa:[[9.5429,'lib',1],[1.396,'skill',1],[.8512,'lib',1],[1.2784,'lib',1],[2.5767,'lib',1]]};
 for(const [name,hits]of Object.entries(windows)){
  const card=cards.find(c=>c.file.startsWith(name)),golden=cases.cases.find(c=>c.character===name);
  const result=await calculateStandard(name,inputFor(card).slots,golden.echoes),f=result.finalStats;
  let total=0;
  for(const [i,[coefficient,type,count]]of hits.entries()){
   const independent=evaluateHit({characterLevel:90,enemyLevel:90,attack:f.totalAtk,coefficient,damageBonus:(f.dmgBonus+(name==='Hiyuki'?f.glacio:f.havoc)+(type==='lib'?f.resonanceLiberationDMGBonus:f.resonanceSkillDMGBonus))/100,amplify:f.totalDeepenEffect/100,specialMultiplier:0,totalDamageBonus:0,endgameDamageBonus:0,defenseIgnore:f.DefIgnore/100,defenseReduction:0,enemyResistance:.1,resistanceReduction:f.resistReduction/100,resistanceIgnore:0,critRate:Math.min(1,f.totalCritRate),critDamage:f.totalCritDMG});
   assert.ok(Math.abs(independent.expected*count-result.actions[i].damage.expected)<1e-6,name+' action '+i);total+=independent.expected*count;
  }
  assert.ok(Math.abs(total-result.score)<1e-6,name+' total');
  assert.match(result.rotationOrigin,/Tacet-authored/);assert.ok(result.startState.length>80);
 }
});
