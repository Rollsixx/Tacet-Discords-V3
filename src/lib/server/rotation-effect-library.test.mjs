import {test} from 'node:test';import assert from 'node:assert/strict';
import * as engine from '../../../vendor/wuthering-tools/dist/index.mjs';
import {modifierCatalog,modifierLibrary,echoBuffDefinitions,normalizeEffects,compileReviewed} from './rotations/configuration.mjs';
import {ROTATION_ROSTER} from '../game-data/rotation-mechanics.mjs';
test('reference library exposes every engine Echo by cost and every Main Echo buff without permitting fixed overrides',async()=>{
 for(const character of ROTATION_ROSTER){
  const editable=await modifierCatalog(character),library=await modifierLibrary(character);
  assert.equal(library.mainEchoes.length,Object.keys(engine.mainEchoesData).length);
  for(const echo of library.mainEchoes){const source=engine.mainEchoesData[echo.key];assert.equal(echo.cost,({Calamity:4,Overlord:4,Elite:3,Common:1})[source.class]);assert.equal(echo.effectCount,echoBuffDefinitions(source).length);
   for(const buff of echoBuffDefinitions(source))assert.equal([...editable,...library.referenceModifiers].filter(m=>m.category==='mainEchoBuff'&&m.scope===echo.key&&m.key===buff.key).length,1,character+' '+echo.key+' '+buff.key);
  }
  for(const ref of library.referenceModifiers){assert.ok(ref.automatic||ref.unavailableReason);assert.ok(!editable.some(m=>m.id===ref.id));assert.throws(()=>normalizeEffects([{id:ref.id,isEnabled:false}],editable),e=>e.status===400);}
 }
});
test('conditional Main Echo effects still apply only to their equipped main slot',async()=>{
 const catalog=await modifierCatalog('Hsin');const effect=catalog.find(m=>m.scope==='ReminiscenceSuhsintheInevitable');assert.ok(effect);assert.equal(effect.echoCost,4);
 const action={type:'basic',key:'synthetic-test-only',count:1,effects:[{id:effect.id,isEnabled:true}]};
 const identities=Array.from({length:5},(_,i)=>({echo:i===0?'ReminiscenceSuhsintheInevitable':'KernelPuppetJoy',set:'HeartofSwornVigil'}));
 assert.equal(compileReviewed({actions:[action]},catalog,identities).trace[0].applied.length,1);
 identities[0].echo='ImpermanenceHeron';const inactive=compileReviewed({actions:[action]},catalog,identities);assert.equal(inactive.trace[0].applied.length,0);assert.equal(inactive.trace[0].inactive.length,1);
});
