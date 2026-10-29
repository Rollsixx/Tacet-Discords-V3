import {test} from 'node:test';import assert from 'node:assert/strict';import sharp from 'sharp';
import base from '../game-data/fingerprints.json'with{type:'json'};import variants from '../game-data/scanner-reference-variants.json'with{type:'json'};
import {fingerprint,spatialDistance}from './image-fingerprint.mjs';import{diagnoseFingerprints}from './scoring.mjs';
test('every render reference is checked against every compatible Sonata without a wrong accepted identity',()=>{
 let total=0,accepted=0,review=0;
 for(const e of variants.echoes)for(const v of e.variants)for(const set of e.sets){const f={cost:e.cost,portrait:v.fingerprint,sonata:base.sets.find(s=>s.key===set).fingerprint},r=diagnoseFingerprints([f,f])[1];total++;
  if(r.problem){review++;continue;}accepted++;assert.equal(r.set,set);assert.ok(r.echo===e.key||r.echoMatch?.equivalentVariants?.includes(e.key),e.key+' '+set+' '+v.render+' accepted as '+r.echo);
 }
 assert.ok(accepted/total>.99);console.log('Full catalog render/compatibility audit:',total,'cases;',accepted,'recognized;',review,'explicit review; zero wrong accepted identities.');
});
test('blank/transparent colour evidence cannot disambiguate portraits and known incompatible sets are never replaced',async()=>{
 assert.equal(spatialDistance({},{}),Infinity);assert.equal(spatialDistance({spatial:'AA=='},{spatial:'AA=='}),Infinity);
 const transparent=await fingerprint(await sharp({create:{width:192,height:182,channels:4,background:'#00000000'}}).png().toBuffer(),undefined,true);assert.equal(spatialDistance(transparent,transparent),Infinity);
 const portrait=variants.echoes.find(e=>e.key==='KernelPuppetAnger').variants[0].fingerprint,sonata=base.sets.find(s=>s.key==='WishesofQuietSnowfall').fingerprint;
 const r=diagnoseFingerprints([{cost:1,portrait,sonata}])[0];assert.equal(r.echo,null);assert.equal(r.set,'WishesofQuietSnowfall');assert.ok(r.problem);
});
test('reported Kernel Puppet and green Sonata screenshot resolves jointly without changing costs or thresholds',{skip:!process.env.USER_BUILD_CARDS_DIRECTORY},async()=>{
 const path=process.env.USER_BUILD_CARDS_DIRECTORY+'/image(20261029-041830).png';
 const portrait=await fingerprint(await sharp(path).extract({left:1203,top:210,width:176,height:167}).resize(192,182).png().toBuffer(),undefined,true),sonata=await fingerprint(await sharp(path).extract({left:1396,top:338,width:40,height:40}).resize(56,56).png().toBuffer());
 const f={cost:1,portrait,sonata},r=diagnoseFingerprints([f,f])[1];assert.equal(r.echo,'KernelPuppetAnger');assert.equal(r.set,'HeartofEvilsPurge');assert.equal(r.problem,null);assert.equal(r.echoMatch.method,'foreground-colour-layout/1');assert.ok(r.echoMatch.hashDifference<=.18);assert.ok(r.echoMatch.difference<=.18);assert.ok(r.echoMatch.margin>=.025);
});
