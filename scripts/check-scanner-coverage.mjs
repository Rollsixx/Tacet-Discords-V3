// SPDX-License-Identifier: GPL-3.0-or-later
import * as engine from '../vendor/wuthering-tools/dist/index.mjs';
import base from '../src/lib/game-data/fingerprints.json' with {type:'json'};
import supplemental from '../src/lib/game-data/scanner-reference-supplement.json' with {type:'json'};
const refs=[...base.echoes,...supplemental.echoes];
if(new Set(refs.map(x=>x.key)).size!==refs.length)throw Error('Duplicate scanner references.');
for(const [key,data]of Object.entries(engine.mainEchoesData)){
 const ref=refs.find(r=>r.key===key);
 if(!ref||JSON.stringify(ref.sets)!==JSON.stringify(data.sets))throw Error('Missing/stale Echo scanner reference: '+key);
 for(const set of data.sets)if(!base.sets.some(s=>s.key===set))throw Error('Missing Sonata scanner reference: '+set);
}
console.log('Scanner coverage checked: '+refs.length+' Echoes, '+base.sets.length+' Sonatas.');
