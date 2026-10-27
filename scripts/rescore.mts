import {database,migrate} from '../src/lib/server/database.ts';
import {rescoreStoredBuilds} from '../src/lib/server/rescore.mjs';
try{await migrate();console.log(await rescoreStoredBuilds(database()));}finally{database().close();}
