import assert from 'node:assert/strict';
import {test} from 'node:test';
import {validateSubmission} from './validation.ts';
import {fixture} from './fixtures.mjs';

test('profile avatar is an explicit opt-in on import',()=>{
 const imported=fixture();
 assert.equal(validateSubmission(imported).avatarCharacter,undefined);
 assert.equal(validateSubmission({...fixture(),avatarCharacter:'Hiyuki'}).avatarCharacter,'Hiyuki');
 assert.throws(()=>validateSubmission({...fixture(),avatarCharacter:'Unknown Resonator'}),/supported Resonator portrait/);
});
