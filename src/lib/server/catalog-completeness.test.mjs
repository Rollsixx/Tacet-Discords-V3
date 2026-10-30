import {test} from 'node:test';import assert from 'node:assert/strict';
import {catalogCompleteness} from './catalog-completeness.mjs';
import {SCORING_CHARACTERS} from '../game-data/scoring-policies.mjs';
import exported from '../game-data/official-scoring.json' with {type:'json'};
test('every supported character has import, kit, signature, rotation contract and complete equipment coverage',async()=>{const r=await catalogCompleteness();assert.deepEqual(r.errors,[]);assert.equal(r.characters.length,SCORING_CHARACTERS.length);assert.equal(r.echoes,230);assert.equal(r.sonatas,37);assert.ok(r.warnings.length>0);});
test('new unsupported roster entry fails instead of inventing integration',async()=>{const r=await catalogCompleteness({roster:[...SCORING_CHARACTERS,'FutureResonator']});assert.equal(r.ok,false);assert.ok(r.errors.some(e=>e.includes('FutureResonator')));});
test('stale exported character or Echo data fails release checks',async()=>{const tables=structuredClone(exported);tables.characters.shift();tables.echoes.shift();const r=await catalogCompleteness({tables});assert.equal(r.ok,false);assert.ok(r.errors.some(e=>e.includes('exported scoring')));assert.ok(r.errors.some(e=>e.includes('exported Echo')));});
