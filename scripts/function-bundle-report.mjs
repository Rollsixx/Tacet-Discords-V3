import {readdir,readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,dirname,relative} from 'node:path';
const root=resolve('.'),api=join(root,'.next/server/app/api');
async function walk(dir){const found=[];for(const f of await readdir(dir,{withFileTypes:true})){const path=join(dir,f.name);if(f.isDirectory())found.push(...await walk(path));else if(f.name.endsWith('.nft.json'))found.push(path);}return found;}
const rows=[],errors=[];
for(const file of await walk(api)){
 const trace=JSON.parse(await readFile(file,'utf8')),route='/api/'+relative(api,dirname(file)).replaceAll('\\','/');
 const files=[...new Set(trace.files.map(f=>resolve(dirname(file),f)))];let bytes=0,ocrBytes=0;const names=[];
 for(const file of files){const name=relative(root,file).replaceAll('\\','/'),info=await stat(file),size=info.isFile()?info.size:0;bytes+=size;names.push(name);if(/node_modules\/(?:tesseract|@tesseract)/.test(name))ocrBytes+=size;}
 const light=route==='/api/health'||route.startsWith('/api/public/');
 if(light&&names.some(n=>/node_modules\/(?:tesseract|@tesseract|sharp\/|@img\/)|vendor\/wuthering-tools\/dist/.test(n)))errors.push(route+': read-only endpoint traces OCR, image processing or the scoring engine.');
 if(route==='/api/submissions'){
  for(const name of ['tesseract-core','tesseract-core-simd','tesseract-core-relaxedsimd','tesseract-core-lstm','tesseract-core-simd-lstm','tesseract-core-relaxedsimd-lstm'])for(const ext of ['js','wasm'])if(!names.includes('node_modules/tesseract.js-core/'+name+'.'+ext))errors.push('Submission OCR fallback missing: '+name+'.'+ext);
  if(!names.includes('node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz'))errors.push('Original English verification model missing.');
  if(names.some(n=>n.includes('tesseract.js-core/')&&n.endsWith('.wasm.js')))errors.push('Node submission bundle contains unused browser OCR cores.');
 }
 rows.push({route,bytes,ocrBytes,files:files.length});
}
await mkdir('.cache',{recursive:true});await writeFile('.cache/function-bundle-report.json',JSON.stringify({kind:'Next file-trace footprint, not Vercel billing or compressed deployment size',routes:rows,errors},null,2)+'\n');
console.log('Function trace footprint (uncompressed, per route):');for(const r of rows)console.log(`${r.route}: ${(r.bytes/1048576).toFixed(2)} MiB; OCR ${(r.ocrBytes/1048576).toFixed(2)} MiB`);
if(process.argv.includes('--check')&&errors.length)throw Error(errors.join('\n'));
