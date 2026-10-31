import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';

const rolls=JSON.parse(readFileSync(new URL('../game-data/substat-rolls.json',import.meta.url),'utf8'));
function loadTs(path,dependencies){
 const source=readFileSync(path,'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const context={exports:{},require(name){if(!(name in dependencies))throw new Error('Unexpected dependency '+name);return dependencies[name];}};
 vm.runInNewContext(compiled,context);return context.exports;
}
const validation=loadTs(new URL('./stat-validation.ts',import.meta.url),{'../game-data/substat-rolls.json':{default:rolls}});
const readings=loadTs(new URL('./ocr-readings.ts',import.meta.url),{'./stat-validation.ts':validation,'../game-data/substat-rolls.json':{default:rolls}});

test('recovers known DEF 11.9 OCR slip while preserving the raw reading',()=>{
 const result=readings.normalizeSubstatReading('DEF 11.9%');
 assert.equal(result.value,'DEF 11.8%');assert.equal(result.corrected,true);
 return readings.recoverStatReading({raw:'DEF 11.9%',value:'DEF 11.9%'},async()=>{throw new Error('Legal correction should not need another OCR pass.');},readings.legalSubstatKey).then(field=>{assert.equal(field.raw,'DEF 11.9%');assert.equal(field.value,'DEF 11.8%');assert.equal(field.autoRecovered,true);});
});
test('uses reference Crit Rate repairs for every character',()=>{
 assert.equal(readings.normalizeSubstatReading('Crit. Rate 17.5%').value,'Crit. Rate 7.5%');
 assert.equal(readings.normalizeSubstatReading('Crit. Rate 1.5%').value,'Crit. Rate 7.5%');
});
test('recovers a short OCR artifact appended to a substat label',()=>{
 const result=readings.normalizeSubstatReading('Crit. DMG PAR 21%');
 assert.equal(result.value,'Crit. DMG 21%');
});
test('does not fuzzy-correct short ambiguous stat labels',()=>{
 assert.equal(validation.parseSubstat('ATE 5.6%'),null);
});
test('normalizes every entry in the pinned roll table and refuses unsafe guesses',()=>{
 for(const [key,values] of Object.entries(rolls.values)){
  const split=key.lastIndexOf(':');const name=key.slice(0,split),percent=key.slice(split+1)==='percent';
  for(const amount of values){const result=readings.normalizeSubstatReading(`${name} ${amount}${percent?'%':''}`);assert.ok(result,`${key} ${amount}`);assert.equal(result.stat.amount,amount);}
 }
 assert.equal(readings.normalizeSubstatReading('DEF 61'),null);
 assert.equal(readings.normalizeSubstatReading('DEF 11.4%'),null);
});
