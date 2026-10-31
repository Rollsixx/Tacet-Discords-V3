import assert from 'node:assert/strict';
import {test} from 'node:test';
import {isValidHomeFeatured,resolveHomeFeatured} from './home-featured.mjs';

const supported=['Hiyuki','Carlotta','Lynae','Chisa'];
const fallback=['Hiyuki','Carlotta','Chisa'];
test('accepts exactly three distinct supported Home Resonators',()=>{
 assert.equal(isValidHomeFeatured(['Lynae','Carlotta','Hiyuki'],supported),true);
});
test('rejects duplicates, missing names, unsupported names, and wrong counts',()=>{
 for(const value of [['Hiyuki','Hiyuki','Chisa'],['Hiyuki','Chisa'],['Hiyuki','Chisa','Future'],[],null])assert.equal(isValidHomeFeatured(value,supported),false);
});
test('invalid stored settings safely fall back to the configured default',()=>{
 assert.deepEqual(resolveHomeFeatured(['Hiyuki','Hiyuki','Chisa'],supported,fallback),fallback);
});
