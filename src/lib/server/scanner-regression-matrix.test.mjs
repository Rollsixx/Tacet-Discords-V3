// Generated, non-player image fixtures keep these OCR checks runnable in every release.
import {test} from 'node:test';import assert from 'node:assert/strict';
import sharp from 'sharp';import {createWorker,PSM} from 'tesseract.js';
import {featuredResonators} from '../resonators.ts';
import {parseCardIdentity} from '../scanner/card-identity.ts';
import {recoverCardUid} from '../scanner/card-layout.ts';
import {legalSubstatKey,agreedReading} from './ocr-agreement.mjs';
import rolls from '../game-data/substat-rolls.json' with {type:'json'};
const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
async function crop(text){return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="70"><rect width="100%" height="100%" fill="#191021"/><text x="12" y="48" fill="#ffffff" font-family="DejaVu Sans" font-size="38">${xml(text)}</text></svg>`)).png().toBuffer();}
async function withOcr(run){const worker=await createWorker('eng',1,{langPath:'node_modules/@tesseract.js-data/eng/4.0.0',gzip:true,cacheMethod:'none'});try{await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_LINE});await run(async text=>(await worker.recognize(await crop(text))).data);}finally{await worker.terminate();}}
test('image OCR covers every supported Resonator header, including future roster additions',{timeout:60000},async()=>{
 await withOcr(async read=>{for(const c of featuredResonators){const r=await read(c.name+' LV.90');assert.equal(parseCardIdentity(r.text,'Player ID:Scanner QA','UID:833333333').character,c.name,c.name+': '+r.text);}});
});
test('image OCR preserves flat/percent rolls, decimal distinctions and 4/3/1 cost readings',{timeout:60000},async()=>{
 await withOcr(async read=>{for(const text of ['DEF 11.8%','DEF 11.9%','DEF 8.1%','ATK 40','HP 540','Crit. Rate 6.9%','Crit. DMG 19.8%']){const r=await read(text);if(text==='DEF 11.9%'){assert.equal(legalSubstatKey(r.text),null);assert.equal(agreedReading(r.text,[],'DEF 11.8%',legalSubstatKey),null);}else assert.equal(legalSubstatKey(r.text),legalSubstatKey(text),text+': '+r.text);}
 for(const cost of ['4','3','1'])assert.equal((await read(cost)).text.trim(),cost);
 });
});
test('image UID reads require two confident matching reads and exclude polluted header digits',{timeout:60000},async()=>{
 await withOcr(async read=>{for(const uid of ['12345678','833333333','123456789012']){const r=await read(uid);assert.equal(await recoverCardUid('UID:1'+uid,async()=>({text:r.text,confidence:r.confidence})),uid);}});
});
test('all pinned legal rolls agree exactly; every distinct legal alternative stays a conflict',()=>{
 for(const [key,values]of Object.entries(rolls.values)){const [name,unit]=key.split(':');for(const [i,value]of values.entries()){const text=name+' '+value+(unit==='percent'?'%':'');assert.ok(legalSubstatKey(text),text);assert.equal(agreedReading('unreadable',[text,text],text,legalSubstatKey),text);const other=name+' '+values[(i+1)%values.length]+(unit==='percent'?'%':'');if(other!==text)assert.equal(agreedReading(other,[text,text],text,legalSubstatKey),null);}}
});
