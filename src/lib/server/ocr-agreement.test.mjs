import {test} from 'node:test';import assert from 'node:assert/strict';
import {agreedReading,legalSubstatKey,mainStatKey} from './ocr-agreement.mjs';
test('verification retries require agreement and never prefer a requested value over a different legal image read',()=>{
 assert.equal(agreedReading('Crit. DMG 19.8%',[],'Crit DMG 19.8%',legalSubstatKey),'Crit. DMG 19.8%');
 assert.equal(agreedReading('unreadable',['Crit. DMG 19.8%','Crit DMG 19.8%'],'Crit. DMG 19.8%',legalSubstatKey),'Crit. DMG 19.8%');
 assert.equal(agreedReading('Crit. DMG 18.6%',['Crit. DMG 19.8%','Crit DMG 19.8%'],'Crit. DMG 19.8%',legalSubstatKey),null);
 assert.equal(agreedReading('unreadable',['Crit. DMG 19.8%','Crit DMG 18.6%'],'Crit. DMG 19.8%',legalSubstatKey),null);
 assert.equal(agreedReading('DEF 11.9%',['DEF 11.8%','DEF 11.8%'],'DEF 11.9%',legalSubstatKey),null);
 assert.equal(agreedReading('unreadable',['ATK 40'],'ATK 40',legalSubstatKey),null);
 assert.equal(agreedReading('unreadable',['DEF 60','DEF 60'],'DEF 60',legalSubstatKey),'DEF 60');
 assert.equal(agreedReading('ATK',['Crit. Rate','Crit Rate'],'Crit. Rate',mainStatKey),null);
 assert.equal(agreedReading('unreadable',['Crit. Rate','Crit Rate'],'Crit. Rate',mainStatKey),'Crit. Rate');
});
