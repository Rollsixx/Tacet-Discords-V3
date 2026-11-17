import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCardIdentity } from './card-identity.ts';
import { resonatorDisplayName } from '../resonators.ts';
test('card headers extract editable IGN and exact UID without character level', () => {
 assert.deepEqual(parseCardIdentity('Carlotta LV.90','Player ID:Rollsixx','UID:900445927'),{character:'Carlotta',ign:'Rollsixx',uid:'900445927'});
 assert.equal(parseCardIdentity('Carlotta m','Player ID:Name','UID:900445927').character,'Carlotta');
 assert.equal(parseCardIdentity('Chisa LV.90','Player ID:Some Name','UID: 900 445 927').uid,'900445927');
 assert.equal(parseCardIdentity('Hiyuki LV.90','Player ID:Name','UID:9OO445927').uid,'');
 assert.equal(parseCardIdentity('Aemeath LV.90','Player ID:Name','UID:123').uid,'');
 assert.equal(parseCardIdentity('Cartethyia LV.90','Player ID:Name','UID:900445927 LV90').uid,'');
});

test('specific observed Suisui OCR confusion resolves to the canonical supported name',()=>{
 assert.equal(parseCardIdentity('Suisuli LV.90','','').character,'Suisui');
 assert.equal(parseCardIdentity('Suisui LV.90','','').character,'Suisui');
 assert.equal(parseCardIdentity('Unknown','','').character,'Unknown');
});

test('OCR-confusable character names resolve only to one roster match', () => {
 assert.equal(parseCardIdentity('luno LV.90', '', '').character, 'Iuno');
 assert.equal(parseCardIdentity('Xiangli Yao LV.90', '', '').character, 'XiangliYao');
 assert.equal(parseCardIdentity('Yangyang: Xuanling LV.90', '', '').character, 'YangyangXuanling');
 assert.equal(parseCardIdentity('Lucilla LV.90', '', '').character, 'Lucilla');
});

test('new roster headers resolve to stable canonical identity keys',()=>{
 assert.equal(parseCardIdentity('Yangyang Xuanling new','','').character,'YangyangXuanling');
 assert.equal(parseCardIdentity('Zan mw LV.90','','').character,'Zani');
 assert.equal(parseCardIdentity('Luuk Herssen LV.90','','').character,'LuukHerssen');
 assert.equal(parseCardIdentity('Unknown new LV.90','','').character,'Unknown new');
});

test('internal Resonator keys always render using their canonical public names',()=>{
 assert.equal(resonatorDisplayName('YangyangXuanling'),'Yangyang: Xuanling');
 assert.equal(resonatorDisplayName('LuukHerssen'),'Luuk Herssen');
 assert.equal(resonatorDisplayName('XiangliYao'),'Xiangli Yao');
 assert.equal(resonatorDisplayName('Zani'),'Zani');
});

test('single-character OCR loss in a roster name resolves to its canonical key', () => {
 assert.equal(parseCardIdentity('Jinhs mw LV.90', '', '').character, 'Jinhsi');
 assert.equal(parseCardIdentity('Jinhsi LV.90', '', '').character, 'Jinhsi');
 assert.equal(parseCardIdentity('Unknown Resonator LV.90', '', '').character, 'Unknown Resonator');
});


test('base and alternate forms remain distinct after expanding the roster',()=>{
 assert.equal(parseCardIdentity('Yangyang LV.90','','').character,'Yangyang');
 assert.equal(parseCardIdentity('Rover: Aero (Female) LV.90','','').character,'RoverAeroFemale');
 assert.equal(parseCardIdentity('Rover LV.90','','').character,'Rover');
});
