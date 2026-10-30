import {test,expect} from '@playwright/test';import {join} from 'node:path';
test('trimmed browser OCR assets scan an original card while public and health endpoints remain operational',async({page,request})=>{
 test.skip(!process.env.USER_BUILD_CARDS_DIRECTORY,'Requires local original; no production uploads.');
 for(const core of ['tesseract-core-lstm','tesseract-core-simd-lstm','tesseract-core-relaxedsimd-lstm'])expect((await request.get('/ocr/core/'+core+'.wasm.js')).status()).toBe(200);
 expect((await request.get('/ocr/core/tesseract-core.wasm.js')).status()).toBe(404);
 await page.goto('/import');await page.getByLabel('Choose build screenshot').setInputFiles(join(process.env.USER_BUILD_CARDS_DIRECTORY!,'Carlotta(1).jpeg'));
 await expect(page.locator('.import-character h2')).toHaveText('Carlotta',{timeout:60000});await expect(page.getByLabel('Wuthering Waves UID',{exact:true})).toHaveValue(process.env.USER_BUILD_CARD_UID!,{timeout:60000});
 await expect(page.locator('img[alt^="Extracted Echo portrait"]')).toHaveCount(5);await expect(page.locator('input[aria-label^="Echo "],textarea[aria-label^="Echo "]')).toHaveCount(35);
 for(const path of ['/api/health','/api/public/leaderboards?character=Carlotta','/api/public/builds','/api/public/home','/api/public/players'])expect((await request.get(path)).status(),path).toBe(200);
 expect((await request.get('/api/moderation')).status()).toBe(401);expect((await request.get('/api/admin/identities')).status()).toBe(401);
});
