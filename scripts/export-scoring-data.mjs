import * as engine from '../vendor/wuthering-tools/dist/index.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {SCORING_CHARACTERS,benchmarkWeapon,scoringPreset,OWNER_ROTATION_REQUIRED} from '../src/lib/game-data/scoring-policies.mjs';
const characters=[];
const source=JSON.parse(await readFile('vendor/wuthering-tools/source-manifest.json','utf8'));
for(const key of SCORING_CHARACTERS){
 const c=await engine.getCharByName(key),w=await engine.getWeaponByName(c.basic.weapon,benchmarkWeapon(c.basic));
 characters.push({key,name:c.basic.name,element:c.basic.element,base90:c.getCharacterStatsByLevel('90'),signatureWeapon:c.basic.signatureWeapon??null,benchmarkWeapon:benchmarkWeapon(c.basic),weapon90:w.getWeaponDataByLevel('90'),weaponPassives:w.info.passiveData,rotationAvailable:Boolean(scoringPreset(key,c)),scoringPreset:scoringPreset(key,c),rotations:(c.rotations??[]).map(r=>({name:r.name,author:r.author,actions:r.data.actions})),attackTables:Object.fromEntries(['basicAttacks','skillAttacks','liberationAttacks','forteCircuitAttacks','introAttacks','outroAttacks','tuneBreakAttacks'].map(k=>[k,c[k]])),buffs:c.buffs,resonanceChains:c.resonanceChains});
}
const echoes=Object.values(engine.mainEchoesData).map(e=>({key:e.key,name:e.name,class:e.class,sets:e.sets,modifiers:e.modifiers,alwaysEnabled:e.alwaysEnabled,actions:e.actions}));
const data={source:'https://github.com/ryanbenson/wuthering-waves-optimizer',sourceCommit:source.commit,catalogOverlayCommit:source.catalogOverlay.commit,license:'GPL-3.0-or-later',policy:'solo-permanent-s0-signature-r1/2',characters,echoes,mainStats:engine.statsTable,substatRolls:engine.subStatsTable,setLabels:engine.echoSetLabelMap,setEffects:{one:engine.sets.setBonusEffectsOne,two:engine.sets.setBonusEffectsTwo,onePiece:engine.sets.setBonusEffectsOnePiece}};
const text=JSON.stringify(data);await writeFile('src/lib/game-data/official-scoring.json',text+'\n');
await writeFile('src/lib/game-data/manifest.json',JSON.stringify({version:data.sourceCommit,catalogOverlayCommit:data.catalogOverlayCommit,sha256:createHash('sha256').update(text+'\n').digest('hex'),characters:characters.length,echoes:echoes.length,sets:Object.keys(data.setLabels).length,supported:SCORING_CHARACTERS,ownerRotationRequired:OWNER_ROTATION_REQUIRED,unsupported:{}},null,2)+'\n');
console.log('Versioned scoring tables exported.');
