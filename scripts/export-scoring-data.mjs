import * as engine from '../vendor/wuthering-tools/dist/index.mjs';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {SCORING_CHARACTERS,scoringPreset} from '../src/lib/game-data/scoring-policies.mjs';
const characters=[];
for(const key of ['Hiyuki','Chisa','Aemeath','Carlotta','Cartethyia']){
 const c=await engine.getCharByName(key),w=await engine.getWeaponByName(c.basic.weapon,c.basic.signatureWeapon);
 characters.push({key,name:c.basic.name,element:c.basic.element,base90:c.getCharacterStatsByLevel('90'),signatureWeapon:c.basic.signatureWeapon,weapon90:w.getWeaponDataByLevel('90'),weaponPassives:w.info.passiveData,rotationAvailable:Boolean(scoringPreset(key,c)),scoringPreset:scoringPreset(key,c),rotations:c.rotations.map(r=>({name:r.name,author:r.author,actions:r.data.actions})),attackTables:Object.fromEntries(['basicAttacks','skillAttacks','liberationAttacks','forteCircuitAttacks','introAttacks','outroAttacks','tuneBreakAttacks'].map(k=>[k,c[k]])),buffs:c.buffs,resonanceChains:c.resonanceChains});
}
const echoes=Object.values(engine.mainEchoesData).map(e=>({key:e.key,name:e.name,class:e.class,sets:e.sets,modifiers:e.modifiers,alwaysEnabled:e.alwaysEnabled,actions:e.actions}));
const data={source:'https://github.com/ryanbenson/wuthering-waves-optimizer',sourceCommit:'b32cdbd3e3c6c3a838e6e5abb71fe46c79c876c5',license:'GPL-3.0-or-later',policy:'solo-permanent-s0-signature-r1/2',characters,echoes,mainStats:engine.statsTable,substatRolls:engine.subStatsTable,setLabels:engine.echoSetLabelMap,setEffects:{one:engine.sets.setBonusEffectsOne,two:engine.sets.setBonusEffectsTwo,onePiece:engine.sets.setBonusEffectsOnePiece}};
const text=JSON.stringify(data);await writeFile('src/lib/game-data/official-scoring.json',text+'\n');
await writeFile('src/lib/game-data/manifest.json',JSON.stringify({version:data.sourceCommit,sha256:createHash('sha256').update(text+'\n').digest('hex'),characters:characters.length,echoes:echoes.length,sets:Object.keys(data.setLabels).length,supported:SCORING_CHARACTERS,unsupported:{}},null,2)+'\n');
console.log('Versioned scoring tables exported.');
