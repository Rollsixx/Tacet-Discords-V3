import {test} from 'node:test';import assert from 'node:assert/strict';
import {catalogCompleteness} from './catalog-completeness.mjs';
import * as engine from '../../../vendor/wuthering-tools/dist/index.mjs';
import {access} from 'node:fs/promises';
import {featuredResonators} from '../resonators.ts';
import {weaponCatalog,weaponImageUrl} from '../weapons/catalog.ts';
import {SCORING_CHARACTERS,OWNER_ROTATION_REQUIRED,benchmarkWeapon} from '../game-data/scoring-policies.mjs';
import exported from '../game-data/official-scoring.json' with {type:'json'};
test('every supported character has import, kit, benchmark weapon, rotation contract and complete equipment coverage',async()=>{const r=await catalogCompleteness();assert.deepEqual(r.errors,[]);assert.equal(r.characters.length,SCORING_CHARACTERS.length);assert.equal(r.echoes,230);assert.equal(r.sonatas,37);assert.ok(r.warnings.length>0);});
test('new unsupported roster entry fails instead of inventing integration',async()=>{const r=await catalogCompleteness({roster:[...SCORING_CHARACTERS,'FutureResonator']});assert.equal(r.ok,false);assert.ok(r.errors.some(e=>e.includes('FutureResonator')));});
test('stale exported character or Echo data fails release checks',async()=>{const tables=structuredClone(exported);tables.characters.shift();tables.echoes.shift();const r=await catalogCompleteness({tables});assert.equal(r.ok,false);assert.ok(r.errors.some(e=>e.includes('exported scoring')));assert.ok(r.errors.some(e=>e.includes('exported Echo')));});

test('the complete reference roster has local portraits and release patches',async()=>{
 assert.deepEqual([...SCORING_CHARACTERS].sort(),engine.allCharactersList.map(c=>c.key).sort());
 for(const {name,patchVersion,ownerRotationRequired} of featuredResonators){
  assert.match(patchVersion,/^\d+\.\d+$/);
  await access(new URL(`../../../public/resonators/${name}.png`,import.meta.url));
  if(ownerRotationRequired)assert.ok(OWNER_ROTATION_REQUIRED.includes(name));
 }
 assert.equal(featuredResonators.find(c=>c.name==='Lily').patchVersion,'3.8');
 assert.equal(benchmarkWeapon((await engine.getCharByName('Lily')).basic),'Lullaby');
 assert.equal(benchmarkWeapon((await engine.getCharByName('Aalto')).basic),'StaticMist');
});
test('the weapon picker covers the reference registry and serves Lullaby artwork',async()=>{
 const types={Swords:'Sword',Broadblades:'Broadblade',Gauntlets:'Gauntlets',Pistols:'Pistols',Rectifiers:'Rectifier'};
 const expected=Object.entries(types).flatMap(([reference,type])=>Object.values(engine.getWeaponsByType(reference)).flat().map(weapon=>type+':'+weapon.key)).sort();
 assert.deepEqual(weaponCatalog.map(weapon=>weapon.type+':'+weapon.key).sort(),expected);
 assert.equal(weaponImageUrl('Lullaby'),'/weapons/Lullaby.png');
 await access(new URL('../../../public/weapons/Lullaby.png',import.meta.url));
});
