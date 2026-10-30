import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {catalogCompleteness} from '../src/lib/server/catalog-completeness.mjs';
const result=await catalogCompleteness();
const manifest=JSON.parse(await readFile('src/lib/game-data/manifest.json','utf8'));
if(createHash('sha256').update(await readFile('src/lib/game-data/official-scoring.json')).digest('hex')!==manifest.sha256)result.errors.push('Exported scoring data hash does not match its manifest.');
if(result.errors.length)throw Error('Catalog completeness failed:\n'+result.errors.join('\n'));
console.log(`Catalog coverage verified: ${result.characters.length} supported Resonators, ${result.echoes} Echoes, ${result.sonatas} Sonatas. ${result.warnings.length} upstream main-slot effect gaps reported. Unverified sequential mechanics remain explicitly identified; no characters or rotations are auto-published.`);
