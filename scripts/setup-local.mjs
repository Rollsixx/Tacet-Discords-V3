import {randomBytes} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
try{
 await writeFile('.env.local',`TURSO_DATABASE_URL=file:tacet-dev.db\nTURSO_AUTH_TOKEN=\nMODERATOR_TOKEN=${randomBytes(32).toString('hex')}\nALLOW_LOCAL_DATABASE=true\n`,{flag:'wx',mode:0o600});
 console.log('Created .env.local with a private moderator token. Keep this file private; open it locally when using Moderator access.');
}catch(error){if(error.code!=='EEXIST')throw error;console.log('Existing .env.local preserved.');}
