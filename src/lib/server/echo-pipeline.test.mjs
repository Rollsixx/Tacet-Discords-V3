import {test} from 'node:test';import assert from 'node:assert/strict';import sharp from 'sharp';import {readFile} from 'node:fs/promises';
import {decodeFingerprintSource,fingerprint} from './image-fingerprint.mjs';import {diagnoseSlots} from './scoring.mjs';
const directory=process.env.USER_BUILD_CARDS_DIRECTORY;
const files=['Hiyuki(3).jpg','Carlotta(1).jpeg','Cartethyia(1).jpeg','Aemeath(1).jpeg','Chisa(1).jpeg','Hsin(2).jpeg','suoming.jpeg'];
test('shared decoding supports grayscale/transparency without invalid channel arithmetic',async()=>{
 for(const image of [await sharp({create:{width:192,height:182,channels:3,background:'white'}}).grayscale().png().toBuffer(),await sharp({create:{width:192,height:182,channels:4,background:'#10203080'}}).png().toBuffer()]){
  const decoded=await decodeFingerprintSource(image);assert.equal(decoded.info.channels,4);assert.equal(await decodeFingerprintSource(decoded),decoded);
  const f=await fingerprint(decoded);assert.match(f.hash,/^[a-f0-9]{16}$/);assert.equal(f.hist.length,24);assert.ok(f.hist.every(Number.isFinite));
 }
});
test('one decoded card produces exactly the same crop fingerprints as individual image decoding',{skip:!directory},async()=>{
 for(const file of files){const image=await readFile(directory+'/'+file),decoded=await decodeFingerprintSource(image);
  for(let i=0;i<5;i++)for(const region of [{left:22+i*374,top:650,width:192,height:182},{left:264+i*374,top:660,width:56,height:56}])assert.deepEqual(await fingerprint(decoded,region),await fingerprint(image,region),file);
 }
});
test('compressed and mildly softened cards keep exact identities or explicitly require review',{skip:!directory},async()=>{
 let accepted=0,review=0;
 for(const file of files){const original=await readFile(directory+'/'+file),baseline=await diagnoseSlots(original,[4,3,3,1,1]);
  for(const variant of [await sharp(original).jpeg({quality:75}).toBuffer(),await sharp(original).jpeg({quality:55}).toBuffer(),await sharp(original).blur(.35).jpeg({quality:80}).toBuffer()]){
   const rows=await diagnoseSlots(variant,[4,3,3,1,1]);
   for(let i=0;i<5;i++){const current=rows[i],expected=baseline[i];if(current.problem){review++;continue;}accepted++;assert.equal(current.set,expected.set,file+' Sonata');assert.ok(current.echo===expected.echo||current.echoMatch?.equivalentVariants?.includes(expected.echo),file+' Echo '+(i+1));}
  }
 }
 assert.ok(accepted>=90);console.log('Degraded card identities:',accepted,'accepted safely;',review,'require review.');
});
