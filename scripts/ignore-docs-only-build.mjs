import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import {resolve} from 'node:path';
export const documentationOnly=files=>files.length>0&&files.every(f=>/^(?:README\.md|THIRD_PARTY_NOTICES\.md|LICENSE(?:\.md)?|docs\/.*\.(?:md|mdx))$/.test(f));
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 // Exit 0 means skip on Vercel. Missing history/provider always builds.
 if(!process.env.VERCEL_GIT_PROVIDER)process.exit(1);
 try{const files=execFileSync('git',['diff','--name-only','HEAD^','HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);const skip=documentationOnly(files);console.log(skip?'Documentation-only commit: no runtime deployment needed.':'Runtime changes detected: build required.');process.exit(skip?0:1);}catch{console.log('Diff unavailable: build required.');process.exit(1);}
}
