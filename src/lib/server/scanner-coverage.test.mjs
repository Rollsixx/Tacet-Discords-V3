import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import * as engine from '../../../vendor/wuthering-tools/dist/index.mjs';
import base from '../game-data/fingerprints.json' with {type:'json'};
import supplement from '../game-data/scanner-reference-supplement.json' with {type:'json'};
import {diagnoseSlots} from './scoring.mjs';
test('every engine Echo and Sonata has a local reference',()=>{
 const refs=[...base.echoes,...supplement.echoes];assert.equal(new Set(refs.map(r=>r.key)).size,refs.length);
 for(const [key,data]of Object.entries(engine.mainEchoesData)){const ref=refs.find(r=>r.key===key);assert.ok(ref,key);assert.deepEqual(ref.sets,data.sets);for(const set of data.sets)assert.ok(base.sets.some(s=>s.key===set),set);}
 for(const ref of supplement.echoes){assert.match(ref.iconSha256,/^[a-f0-9]{64}$/);assert.match(ref.source.sha256,/^[a-f0-9]{64}$/);}
});
test('Hsin original resolves all five equipment identities at strict thresholds',{skip:!process.env.USER_BUILD_CARDS_DIRECTORY},async()=>{
 const rows=await diagnoseSlots(await readFile(process.env.USER_BUILD_CARDS_DIRECTORY+'/Hsin(1).jpeg'),[4,3,3,1,1]);
 assert.deepEqual(rows.map(r=>r.echo),['ReminiscenceSuhsintheInevitable','Formrender','Soulfrayer','KernelPuppetJoy','BloomburstPuppet']);assert.ok(rows.every(r=>!r.problem&&r.set==='HeartofSwornVigil'));
});
test('Hsin original independently verifies UID, every stat and scoring evidence',{skip:!process.env.USER_BUILD_CARDS_DIRECTORY,timeout:60000},async()=>{
 const {assessSource}=await import('./source-evidence.mjs');const {default:cards}=await import('../../../tests/browser/user-card-expectations.json',{with:{type:'json'}});const card=cards.find(c=>c.file==='Hsin(1).jpeg');
 const slots=Array.from({length:5},(_,i)=>({slot:i+1,cost:{value:card.fields[i*7]},mainStat:{value:card.fields[i*7+1]},substats:card.fields.slice(i*7+2,i*7+7).map(value=>({value}))}));
 const result=await assessSource({character:'Hsin',uid:process.env.USER_BUILD_CARD_UID,sourceImage:await readFile(process.env.USER_BUILD_CARDS_DIRECTORY+'/'+card.file),slots});assert.equal(result.eligible,true,result.reason);assert.equal(result.sourceUid,process.env.USER_BUILD_CARD_UID);assert.equal(result.statsVerified,true);assert.equal(result.rollsVerified,true);assert.ok(result.calculation.score>0);
});
