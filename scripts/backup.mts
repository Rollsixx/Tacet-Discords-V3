import {resolve} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {database} from '../src/lib/server/database.ts';
const url=process.env.TURSO_DATABASE_URL||'';
if(!url.startsWith('file:'))throw Error('Use the managed database provider backup/export for a remote database.');
await mkdir('backups',{recursive:true});
const destination=resolve('backups','tacet-'+new Date().toISOString().replace(/[:.]/g,'-')+'.db');
try{await database().execute({sql:'VACUUM INTO ?',args:[destination]});console.log('Consistent database backup saved:',destination);}finally{database().close();}
