import { build } from 'esbuild';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const vendor=resolve('vendor/wuthering-tools');
const root=resolve('.cache/scoring-reference');
const {createHash}=await import('node:crypto');
const {x:extract}=await import('tar');
const manifest=JSON.parse(await readFile(join(vendor,'source-manifest.json'),'utf8'));
const archive=join(vendor,'scoring-source.tar.gz');
if(createHash('sha256').update(await readFile(archive)).digest('hex')!==manifest.sha256)throw new Error('Scoring source archive integrity failure.');
await mkdir(root,{recursive:true});
await extract({file:archive,cwd:root,strict:true});
if(manifest.catalogOverlay){
 const overlay=join(vendor,manifest.catalogOverlay.file);
 if(createHash('sha256').update(await readFile(overlay)).digest('hex')!==manifest.catalogOverlay.sha256)throw new Error('Scoring catalog overlay integrity failure.');
 await extract({file:overlay,cwd:root,strict:true});
}

const chars=(await readdir(join(root,'src/characters'),{withFileTypes:true})).filter(e=>e.isDirectory()).map(e=>e.name);
const weapons={};
for(const type of ['Swords','Broadblades','Gauntlets','Pistols','Rectifiers']){
 try{for(const file of await readdir(join(root,'src/weapons',type)))if(file.endsWith('.ts'))weapons[type+'/'+file.slice(0,-3)]=`./${type}/${file}`;}catch{}
}
await mkdir(join(vendor,'dist'),{recursive:true});
await build({entryPoints:[join(root,'entry.ts')],outfile:join(vendor,'dist/index.mjs'),bundle:true,platform:'node',format:'esm',target:'node24',metafile:true,alias:{'@wutheringtools/formulas':join(root,'packages/formulas/src/index.ts'),'@':join(root,'src')},plugins:[{name:'host-module-maps',setup(b){b.onLoad({filter:/[\\/](characters|weapons)\.ts$/},async args=>{
 let source=await readFile(args.path,'utf8');
 if(args.path.replaceAll('\\','/').endsWith('/characters/characters.ts')){
 const map=chars.map(name=>`${JSON.stringify(name)}:()=>import(${JSON.stringify('./'+name+'/index.ts')})`).join(',');
 source='const hostLoaders={'+map+'};\n'+source.replace('await import(`@/characters/${charName}/index.ts`)','await hostLoaders[charName]()');
 }else if(args.path.replaceAll('\\','/').endsWith('/weapons/weapons.ts')){
 const map=Object.entries(weapons).map(([key,path])=>`${JSON.stringify(key)}:()=>import(${JSON.stringify(path)})`).join(',');
 source='const hostWeaponLoaders={'+map+'};\n'+source.replace('await import(`@/weapons/${type}/${weaponName}.ts`)','await hostWeaponLoaders[type+"/"+weaponName]()');
 }
 return {contents:source,loader:'ts'};
 });}}]}).then(async result=>writeFile(join(vendor,'dist/build-inputs.json'),JSON.stringify(Object.keys(result.metafile.inputs),null,2)));
console.log('Versioned GPL reference engine built.');
