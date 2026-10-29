// SPDX-License-Identifier: GPL-3.0-or-later
// Read a local copy of the pinned optimizer's src/scanner/scanner-icons.json.
// No external reference requests occur during user scans.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';import sharp from 'sharp';
import * as engine from '../vendor/wuthering-tools/dist/index.mjs';
import base from '../src/lib/game-data/fingerprints.json' with {type:'json'};
import {fingerprint} from '../src/lib/server/image-fingerprint.mjs';
if(!process.argv[2])throw Error('Pass the pinned optimizer scanner-icons.json file.');
const commit=process.argv[3]||'17f931df068b0952413c558f569ddc9ef661de24';
if(!/^[a-f0-9]{40}$/.test(commit))throw Error('Use an exact upstream commit SHA.');
const bundle=JSON.parse(await readFile(process.argv[2],'utf8'));
if(bundle.format!=='WutheringToolsScannerIcons'||bundle.version!==1||bundle.echoIcons.size!==80)throw Error('Unsupported upstream bundle.');
const echoes=[];
for(const [key,data]of Object.entries(engine.mainEchoesData)){
 if(base.echoes.some(e=>e.key===key))continue;
 const encoded=bundle.echoIcons.icons[key],source=bundle.echoIcons.sources[key];
 if(!/^data:image\/(png|webp);base64,/.test(encoded||'')||!source?.url||!/^[a-f0-9]{64}$/.test(source.sha256||''))throw Error('Missing reference provenance: '+key);
 const bytes=Buffer.from(encoded.split(',')[1],'base64');const meta=await sharp(bytes,{limitInputPixels:10000}).metadata();
 if(meta.width!==80||meta.height!==80)throw Error('Unexpected icon dimensions: '+key);
 const png=await sharp(bytes).resize(192,192).extract({left:0,top:0,width:192,height:182}).png().toBuffer();
 echoes.push({key,cost:({Calamity:4,Overlord:4,Elite:3,Common:1})[data.class],sets:data.sets,name:data.name,fingerprint:await fingerprint(png),source,iconSha256:createHash('sha256').update(bytes).digest('hex')});
}
await writeFile('src/lib/game-data/scanner-reference-supplement.json',JSON.stringify({version:'upstream-scanner-icons/1',sourceCommit:commit,source:'https://github.com/ryanbenson/wuthering-waves-optimizer/blob/'+commit+'/src/scanner/scanner-icons.json',license:'GPL-3.0-or-later',echoes},null,2)+'\n');
console.log('Supplemented '+echoes.length+' Echo references.');
