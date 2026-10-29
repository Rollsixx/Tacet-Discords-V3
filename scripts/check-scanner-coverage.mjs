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
const {default:variants}=await import('../src/lib/game-data/scanner-reference-variants.json',{with:{type:'json'}});
const {default:corrections}=await import('../src/lib/game-data/fingerprint-corrections.json',{with:{type:'json'}});
if(variants.echoes.length!==Object.keys(engine.mainEchoesData).length||new Set(variants.echoes.map(e=>e.key)).size!==variants.echoes.length)throw Error('Incomplete render variant catalog. Regenerate from the pinned optimizer icon bundle.');
for(const [key,data]of Object.entries(engine.mainEchoesData)){
 const ref=variants.echoes.find(e=>e.key===key),cost=({Calamity:4,Overlord:4,Elite:3,Common:1})[data.class];
 if(!ref||ref.cost!==cost||JSON.stringify(ref.sets)!==JSON.stringify(data.sets)||!/^[a-f0-9]{64}$/.test(ref.iconSha256)||!/^[a-f0-9]{64}$/.test(ref.source?.sha256||''))throw Error('Stale/incomplete render reference: '+key);
 if(corrections.echoes.some(e=>e.key===key)){if(ref.variants.length)throw Error('Unreviewed variant would bypass corrected portrait: '+key);}
 else if(ref.variants.length!==2||ref.variants.some(v=>Buffer.from(v.fingerprint.spatial||'','base64').length!==2304))throw Error('Missing render/colour references: '+key);
}
for(const [key,name]of Object.entries(engine.echoSetLabelMap)){
 if(!base.sets.some(s=>s.key===key))throw Error('Missing Sonata reference: '+key);
 if(![engine.sets.setBonusEffectsOnePiece,engine.sets.setBonusEffectsOne,engine.sets.setBonusEffectsTwo].some(group=>Object.values(group).some(d=>d.name===name&&d.details)))throw Error('Missing Sonata effect description: '+key);
}
console.log('Echo render variants, compatible sets and all Sonata effect definitions checked.');
