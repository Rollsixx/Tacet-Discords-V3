import assert from 'node:assert/strict';
import {test} from 'node:test';
import {agreedNormalizedCorrection} from './ocr-agreement.mjs';
import {normalizeSubstatReading} from '../scanner/ocr-readings.ts';

const normalizedKey=value=>{const reading=normalizeSubstatReading(value);return reading?JSON.stringify(reading.stat):null;};
test('accepts a corrected roll only when three OCR reads agree after legal-roll normalization',()=>{
 assert.equal(agreedNormalizedCorrection('DEF 11.9%',['DEF 11.9%','DEF 11.9%'],'DEF 11.8%',normalizedKey),'DEF 11.9%');
 assert.equal(agreedNormalizedCorrection('DEF 11.9%',['DEF 11.8%','DEF 10.9%'],'DEF 11.8%',normalizedKey),null);
 assert.equal(agreedNormalizedCorrection('DEF 11.9%',['DEF 11.9%'],'DEF 11.8%',normalizedKey),null);
 assert.equal(agreedNormalizedCorrection('DEF 11.8%',['DEF 11.8%','DEF 11.8%'],'DEF 10.9%',normalizedKey),null);
});
