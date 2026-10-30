import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCardIdentity } from './card-identity.ts';
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
