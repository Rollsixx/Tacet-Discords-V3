import {test} from 'node:test';import assert from 'node:assert/strict';
import {CARD_HEADERS,parseCardUid,recoverCardUid} from './card-layout.ts';
test('UID header avoids character art and supports full UID length',()=>{
 assert.equal(CARD_HEADERS.uid.x+CARD_HEADERS.uid.width,225);
 for(const uid of ['12345678','900445927','123456789012'])assert.equal(parseCardUid('UID:'+uid),uid);
 for(const line of ['UID:900445927 -','UID:900445927 LV90','UID:9OO445927'])assert.equal(parseCardUid(line),'');
});
test('UID retry requires two exact independent reads without replacing digits',async()=>{
 let calls=0;assert.equal(await recoverCardUid('UID:900445927',async()=>{calls++;return '';}),'900445927');assert.equal(calls,0);
 assert.equal(await recoverCardUid('',async()=> '900445927'),'900445927');
 assert.equal(await recoverCardUid('',async v=>v?'900445928':'900445927'),'');
 assert.equal(await recoverCardUid('',async()=> '9OO445927'),'');
});
