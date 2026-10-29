import {test} from 'node:test';import assert from 'node:assert/strict';
import {CARD_HEADERS,parseCardUid,recoverCardUid} from './card-layout.ts';
test('UID header avoids character art and supports full UID length',()=>{
 assert.equal(CARD_HEADERS.uid.x+CARD_HEADERS.uid.width,225);
 for(const uid of ['12345678','900445927','123456789012'])assert.equal(parseCardUid('UID:'+uid),uid);
 for(const line of ['UID:900445927 -','UID:900445927 LV90','UID:9OO445927'])assert.equal(parseCardUid(line),'');
});
test('UID always uses confident digit consensus, even when a polluted labelled read looks valid',async()=>{
 const read=async()=>({text:'900445927',confidence:95});
 assert.equal(await recoverCardUid('UID:1900445927',read),'900445927');
 assert.equal(await recoverCardUid('UID:900445927',async()=>({text:'1900445927',confidence:0})), '');
 assert.equal(await recoverCardUid('',async v=>({text:v?'900445928':'900445927',confidence:95})), '');
 assert.equal(await recoverCardUid('',async()=>({text:'9OO445927',confidence:95})), '');
 for(const uid of ['12345678','123456789012'])assert.equal(await recoverCardUid('',async()=>({text:uid,confidence:90})),uid);
});

test('IGN text segmentation retains long contiguous names and stops before separated artwork',async()=>{
 const {playerTextWidth}=await import('./card-layout.ts');
 const pixels=new Uint8ClampedArray(300*27*4);
 const ink=x=>{const i=(5*300+x)*4;pixels[i]=190;pixels[i+1]=170;pixels[i+2]=80;pixels[i+3]=255;};
 for(let x=5;x<240;x++)if(x%8<6)ink(x);
 assert.ok(playerTextWidth(pixels,300,27)>=240);
 pixels.fill(0);for(let x=5;x<150;x++)if(x%8<6)ink(x);for(let x=200;x<260;x++)ink(x);
 assert.ok(playerTextWidth(pixels,300,27)<175);
});

test('UID text bounds follow the whole digit run and exclude separated artwork',async()=>{
 const {uidTextWidth}=await import('./card-layout.ts');
 for(const end of [83,95,126]){
 const pixels=new Uint8ClampedArray(160*20*4);
 for(let x=0;x<=end;x++)if(x%10<7){let i=(5*160+x)*4;pixels[i]=190;pixels[i+1]=170;pixels[i+2]=80;}
 for(let x=end+18;x<160;x++){let i=(5*160+x)*4;pixels[i]=190;pixels[i+1]=170;pixels[i+2]=80;}
 const width=uidTextWidth(pixels,160,20);assert.ok(width>end-4&&width<end+10);
 }
 assert.equal(uidTextWidth(new Uint8ClampedArray(160*20*4),160,20),160);
});
