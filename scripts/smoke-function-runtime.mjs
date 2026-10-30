// Exercise the actual trimmed submission dependency trace outside the repository,
// so missing files cannot be resolved accidentally from development node_modules.
import {mkdtemp,readFile,mkdir,copyFile,writeFile,rm,lstat,realpath,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {resolve,dirname,join,relative} from 'node:path';import {spawnSync} from 'node:child_process';
const root=resolve('.'),traceFile=join(root,'.next/server/app/api/submissions/route.js.nft.json');
const trace=JSON.parse(await readFile(traceFile,'utf8')),target=await mkdtemp(join(tmpdir(),'tacet-function-runtime-'));
try{
 for(const file of new Set(trace.files.map(f=>resolve(dirname(traceFile),f)))){
  const path=relative(root,file);if(path.startsWith('..'))throw Error('Trace escaped project root.');const dest=join(target,path);await mkdir(dirname(dest),{recursive:true});if((await lstat(file)).isSymbolicLink()){const resolved=relative(root,await realpath(file));if(resolved.startsWith('..'))throw Error('Symlink escaped project root.');await symlink(relative(dirname(dest),join(target,resolved)),dest);}else if((await lstat(file)).isFile())await copyFile(file,dest);
 }
 const script=`const assert=require('node:assert/strict');
 const sharp=require('sharp');const {createWorker,PSM}=require('tesseract.js');const {createClient}=require('@libsql/client');
 (async()=>{
  const image=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="80"><rect width="100%" height="100%" fill="white"/><text x="15" y="55" font-family="DejaVu Sans" font-size="40">DEF 11.8%</text></svg>')).png().toBuffer();
  const w=await createWorker('eng',1,{langPath:require('node:path').join(process.cwd(),'node_modules/@tesseract.js-data/eng/4.0.0'),gzip:true,cacheMethod:'none'});
  try{await w.setParameters({tessedit_pageseg_mode:PSM.SINGLE_LINE});const r=await w.recognize(image);assert.match(r.data.text,/DEF\\s*11[.]8%/);}finally{await w.terminate();}
  const db=createClient({url:'file::memory:'});try{assert.equal(Number((await db.execute('SELECT 1 n')).rows[0].n),1);}finally{db.close();}
  console.log('Isolated trimmed runtime passed: Sharp, original English model, Node LSTM worker and database client.');
 })().catch(e=>{console.error(e);process.exitCode=1});`;
 await writeFile(join(target,'smoke.cjs'),script);
 const r=spawnSync(process.execPath,['smoke.cjs'],{cwd:target,encoding:'utf8',env:{...process.env,NODE_PATH:''},timeout:60000});
 process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');if(r.status!==0)throw Error('Isolated function smoke failed: '+(r.error?.message||r.status));
}finally{await rm(target,{recursive:true,force:true});}
