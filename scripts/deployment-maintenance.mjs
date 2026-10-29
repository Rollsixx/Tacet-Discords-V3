import {spawnSync} from 'node:child_process';
if(process.env.VERCEL_ENV!=='production'){
 console.log('Preview build: production database maintenance skipped.');
}else{
 for(const task of ['db:migrate','db:rescore']){
  const result=spawnSync('npm',['run',task],{stdio:'inherit',env:process.env});
  if(result.status!==0)process.exit(result.status||1);
 }
}
