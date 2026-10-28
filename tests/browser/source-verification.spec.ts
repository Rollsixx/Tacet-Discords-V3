import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';import {join} from 'node:path';import sharp from 'sharp';
const directory=process.env.USER_BUILD_CARDS_DIRECTORY;
test('large screenshot scans and uploads one image, with matching preview crops and server verification',async({page,request},info)=>{
 test.skip(!directory||!process.env.USER_BUILD_CARD_UID,'Requires the local original card; no production uploads.');
 const original=await readFile(join(directory!,'Carlotta(1).jpeg'));const large=await sharp(original).png({compressionLevel:0}).toBuffer();expect(large.length).toBeGreaterThan(1_000_000);
 await page.goto('/import');const previewRequest=page.waitForRequest(r=>r.url().endsWith('/api/scan/identities')&&r.method()==='POST');await page.getByLabel('Choose build screenshot').setInputFiles({name:'large-verification-card.png',mimeType:'image/png',buffer:large});const preview=(await previewRequest).postDataJSON();
 await expect(page.getByText('No structural warnings',{exact:true})).toBeVisible({timeout:60000});await page.getByLabel('In-game name',{exact:true}).fill('Verification QA '+info.project.name);await page.getByRole('checkbox').check();const uploaded=page.waitForResponse(r=>r.url().endsWith('/api/submissions')&&r.request().method()==='POST');await page.getByRole('button',{name:'Submit for moderation',exact:true}).click();const response=await uploaded;expect(response.status()).toBe(201);const receipt=await response.json();expect(receipt.readiness.ready).toBe(true);
 const payload=response.request().postDataJSON();const bytes=Buffer.from(payload.sourceImage.split(',')[1],'base64');expect(bytes.length).toBeLessThanOrEqual(1_000_000);expect((await sharp(bytes).metadata()).format).toBe('jpeg');
 for(let i=0;i<5;i++){
  const fromSource=await sharp(bytes).extract({left:22+i*374,top:650,width:192,height:182}).removeAlpha().raw().toBuffer();const fromPreview=await sharp(Buffer.from(preview.slots[i].portrait.split(',')[1],'base64')).removeAlpha().raw().toBuffer();expect(fromPreview.length).toBe(fromSource.length);const error=fromSource.reduce((sum,n,j)=>sum+Math.abs(n-fromPreview[j]),0)/fromSource.length;expect(error).toBeLessThan(1.1);
 }
 await expect(page.getByLabel('Submission confirmation')).toBeVisible();await expect(page.getByLabel('Submission confirmation')).toContainText('Source verified');
 const forged=structuredClone(payload);forged.slots[0].substats[0]={raw:'Crit. DMG 21%',value:'Crit. DMG 21%'};const denied=await request.post('/api/submissions',{data:forged});expect(denied.status()).toBe(400);expect((await denied.json()).error).toMatch(/Echo stats.*Echo 1.*substat 1/);
 await page.screenshot({path:info.outputPath('large-image-verification.png'),fullPage:true});
 const cleanup=await request.post('/api/moderation',{headers:{Authorization:'Bearer browser-test-only-token-00000000000000000000'},data:{id:receipt.id,action:'rejected',reviewer:'Verification QA',note:'Remove isolated verification test',identityVerified:false}});expect(cleanup.status()).toBe(200);
});
