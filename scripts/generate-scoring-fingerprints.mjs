import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import * as e from '../vendor/wuthering-tools/dist/index.mjs';
import {fingerprint} from '../src/lib/server/image-fingerprint.mjs';
const root=process.env.SCORING_ASSETS_DIRECTORY;
if(!root)throw Error('Set SCORING_ASSETS_DIRECTORY to the pinned wuthering-waves-assets checkout.');
const echoes=[];
for(const [key,data] of Object.entries(e.mainEchoesData)){
 const path=root+'/images/echoes/'+key+'.webp';
 if(!existsSync(path))continue;
 const png=await sharp(path).resize(192,192).extract({left:0,top:0,width:192,height:182}).png().toBuffer();
 echoes.push({key,cost:({Calamity:4,Overlord:4,Elite:3,Common:1})[data.class],sets:data.sets,name:data.name,fingerprint:await fingerprint(png)});
}
const sets=[];
for(const [key,name] of Object.entries(e.echoSetLabelMap)){
 const path=root+'/images/echoes/sets/'+e.getEchoSetIconByType(key).split('/').pop();
 if(existsSync(path)){ const icon=await sharp(path).resize(48,48).png().toBuffer(); const padded=await sharp({create:{width:56,height:56,channels:3,background:'#100d18'}}).composite([{input:icon,left:4,top:4}]).png().toBuffer(); sets.push({key,name,fingerprint:await fingerprint(padded)}); }
}
const catalog={sourceCommit:'b32cdbd3e3c6c3a838e6e5abb71fe46c79c876c5',assetCommit:'e69260313edc04ca9b8ca1d52fec1bb485c6c1b1',echoes,sets};
await writeFile(new URL('../src/lib/game-data/fingerprints.json',import.meta.url),JSON.stringify(catalog));
