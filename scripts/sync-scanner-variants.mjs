// SPDX-License-Identifier: GPL-3.0-or-later
// Generate card-render variants from the optimizer's complete, provenance-tracked icon bundle.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import * as engine from '../vendor/wuthering-tools/dist/index.mjs';
import {fingerprint} from '../src/lib/server/image-fingerprint.mjs';
import corrections from '../src/lib/game-data/fingerprint-corrections.json' with {type:'json'};
const [path,commit]=process.argv.slice(2);
if(!path||!/^[a-f0-9]{40}$/.test(commit||''))throw Error('Pass scanner-icons.json and its exact upstream commit.');
const bytes=await readFile(path),bundle=JSON.parse(bytes);
if(bundle.format!=='WutheringToolsScannerIcons'||bundle.version!==1||bundle.echoIcons.size!==80)throw Error('Unsupported scanner bundle.');
const echoes=[];
for(const [key,echo]of Object.entries(engine.mainEchoesData)){
 const encoded=bundle.echoIcons.icons[key],source=bundle.echoIcons.sources[key];
 if(!/^data:image\/(png|webp);base64,/.test(encoded||'')||!source?.url||!/^[a-f0-9]{64}$/.test(source.sha256||''))throw Error('Missing icon provenance: '+key);
 const image=Buffer.from(encoded.split(',')[1],'base64'),meta=await sharp(image).metadata();
 if(meta.width!==80||meta.height!==80)throw Error('Unexpected icon dimensions: '+key);
 // Cards render square icons into a shorter portrait box using different fit modes.
 const variants=[];
 for(const fit of corrections.echoes.some(e=>e.key===key)?[]:['fill','cover'])variants.push({render:fit,fingerprint:await fingerprint(await sharp(image).resize(192,182,{fit}).png().toBuffer(),undefined,true)});
 echoes.push({key,cost:({Calamity:4,Overlord:4,Elite:3,Common:1})[echo.class],sets:echo.sets,source,iconSha256:createHash('sha256').update(image).digest('hex'),variants});
}
for(const key of Object.keys(engine.echoSetLabelMap))if(!bundle.setIcons.icons[key]||!bundle.setIcons.sources[key]?.sha256)throw Error('Missing Sonata icon: '+key);
await writeFile('src/lib/game-data/scanner-reference-variants.json',JSON.stringify({version:'optimizer-card-render-variants/1',sourceCommit:commit,bundleSha256:createHash('sha256').update(bytes).digest('hex'),source:'https://github.com/ryanbenson/wuthering-waves-optimizer/blob/'+commit+'/src/scanner/scanner-icons.json',license:'GPL-3.0-or-later',echoes},null,2)+'\n');
console.log('Generated card-render references for '+echoes.length+' Echoes; verified '+Object.keys(engine.echoSetLabelMap).length+' Sonata icons.');
