import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { parseSubstat } from '../../src/lib/scanner/stat-validation';
import expectations from './user-card-expectations.json';
import scoringCases from '../../src/lib/game-data/scoring-cases.json';
const directory = process.env.USER_BUILD_CARDS_DIRECTORY;
for (const card of expectations) test('original uploaded card: '+card.file, async ({ page }, info) => {
  test.skip(!directory, 'Set USER_BUILD_CARDS_DIRECTORY to local private originals.');
  const file = join(directory!, card.file);
  expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe(card.sha256);
  await page.goto('/import');
  await page.getByLabel('Choose build screenshot').setInputFiles(file);
  await expect(page.locator('img[alt^="Extracted Echo portrait"]')).toHaveCount(5);
  await expect(page.locator('img[alt^="Extracted Sonata icon"]')).toHaveCount(5);
  await expect(page.getByRole('heading',{name:'5 Echo slots processed'})).toBeVisible({timeout:60000});
  const values = await page.locator('input[aria-label^="Echo "]').evaluateAll(inputs=>inputs.map(input=>(input as HTMLInputElement).value));
  expect(values).toHaveLength(35);
  await expect(page.locator(".import-character h2")).toHaveText(card.file.split("(")[0]);
  if(process.env.USER_BUILD_CARD_UID) await expect(page.getByLabel("Wuthering Waves UID",{exact:true})).toHaveValue(process.env.USER_BUILD_CARD_UID);
  const canonical = values.map((value, index) => {
    if(index % 7 < 2) return value;
    const parsed = parseSubstat(value);
    expect(parsed, 'Unparsed OCR: '+value).not.toBeNull();
    return parsed!.name+' '+parsed!.amount+(parsed!.percent ? '%' : '');
  });
  expect(canonical).toEqual(card.fields);
  await expect(page.getByText('No structural warnings',{exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  writeFileSync(info.outputPath('observed.json'),JSON.stringify({file:card.file,values,canonical},null,2));
  console.log(card.file+': 35/35 fields match; zero structural warnings.');
});

test('automatic scan fills IGN and locks UID without exposing crossed-out panels',async({page},info)=>{
 test.skip(!directory||!process.env.USER_BUILD_CARD_UID,'Private original required.');
 await page.goto('/import');
 await page.getByLabel('Choose build screenshot').setInputFiles(join(directory!,'Hiyuki(3).jpg'));
 await expect(page.getByLabel('Wuthering Waves UID',{exact:true})).toHaveValue(process.env.USER_BUILD_CARD_UID!,{timeout:60000});
 await expect(page.getByLabel('Wuthering Waves UID',{exact:true})).not.toBeEditable();
 await expect(page.getByLabel('In-game name',{exact:true})).toHaveValue('Rollsixx');
 await page.getByLabel('In-game name',{exact:true}).fill('Editable IGN');
 await expect(page.getByRole('button',{name:'Recognize Echo stats'})).toHaveCount(0);
 await expect(page.getByText('Hide my UID on all my builds')).toHaveCount(0);
 await expect(page.locator('.import-character')).toHaveText(/Hiyuki/);
 await expect(page.locator('.import-character')).not.toContainText(/LV|90/);
 await expect(page.locator('.scan-pass')).toHaveCount(7);
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('automatic-import-review.png'),fullPage:true});
});

// Private originals and UID are supplied at runtime and are never committed.
test('all five official categories score only after approval and identity verification',async({page,request},info)=>{
 test.skip(info.project.name!=='desktop','One lifecycle per original per isolated DB.');
 test.skip(!directory||!process.env.USER_BUILD_CARD_UID,'Set private original directory and matching UID.');
 const uid=process.env.USER_BUILD_CARD_UID!;
 for(const golden of scoringCases.cases){
 const character=golden.character;
 const card=expectations.find(c=>c.file.startsWith(character))!;
 await page.goto('/import');
 await page.getByLabel('Choose build screenshot').setInputFiles(join(directory!,card.file));
 await expect(page.getByText('No structural warnings',{exact:true})).toBeVisible({timeout:60000});
 await expect(page.getByLabel('Wuthering Waves UID',{exact:true})).toHaveValue(uid);
 await expect(page.getByLabel('Wuthering Waves UID',{exact:true})).not.toBeEditable();
 await page.getByLabel('In-game name',{exact:true}).fill('Scoring Browser QA');
 await page.getByRole('checkbox').check();
 const save=page.waitForResponse(r=>r.url().endsWith('/api/submissions')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Submit for moderation'}).click();
 const savedResponse=await save;
 expect(savedResponse.status(),await savedResponse.text()).toBe(201);
 expect((await(await request.get('/api/public/leaderboards?character='+character)).json()).builds).toHaveLength(0);
 await page.goto('/BlackShores');
 await page.getByLabel('Moderator token',{exact:true}).fill('browser-test-only-token-00000000000000000000');
 await page.getByRole('button',{name:'Unlock review desk'}).click();
 await expect(page.getByText('Scoring: Source image, numeric fields and scoring policy validated; moderator approval and identity verification required.',{exact:true})).toBeVisible();
 await page.getByLabel('Reviewer name (audit trail)').fill('Scoring Browser QA');
 await page.getByLabel('I manually matched this UID/IGN to the member outside the website.').check();
 await page.getByRole('button',{name:'Approve '+character,exact:true}).click();
 await expect(page.getByText('No pending submissions.',{exact:true})).toBeVisible();
 const ranked=await(await request.get('/api/public/leaderboards?character='+character)).json();
 expect(ranked.builds).toHaveLength(1);
 expect(ranked.builds[0].score).toBeCloseTo(golden.score,5);
 await page.goto('/leaderboards?character='+character);
 await expect(page.locator('.build-card').filter({hasText:character})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath(character+'-official-leaderboard.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath(character+'-official-leaderboard-mobile.png'),fullPage:true});
 await page.setViewportSize({width:1440,height:1000});
 }
});

test('unreadable initial fifth cost is recovered from real image OCR without editing',async({page},info)=>{
 test.skip(!directory,'Set USER_BUILD_CARDS_DIRECTORY to local private originals.');
 // Reproduce a decoder/OCR first-pass miss while leaving both retry reads real.
 await page.addInitScript(()=>{
  const native=Object.getOwnPropertyDescriptor(Worker.prototype,'onmessage')!;
  Object.defineProperty(Worker.prototype,'onmessage',{
   configurable:true,get:native.get,
   set(handler:Worker['onmessage']){
    let reads=0;
    native.set!.call(this,(event:MessageEvent)=>{
     let forwarded=event;
     if(event.data?.status==='resolve'&&event.data?.action==='recognize'){
      reads++;
      if(reads===32){
       forwarded=new MessageEvent('message',{data:{...event.data,data:{...event.data.data,text:'',confidence:0}}});
      }
     }
     handler?.call(this,forwarded);
    });
   },
  });
 });
 await page.goto('/import');
 await page.getByLabel('Choose build screenshot').setInputFiles(join(directory!,'Hiyuki(3).jpg'));
 await expect(page.getByRole('heading',{name:'5 Echo slots processed'})).toBeVisible({timeout:60000});
 await expect(page.getByLabel('Echo 5 cost',{exact:true})).toHaveValue('1');
 await expect(page.getByText('Cost: Unreadable (recovered from image: 1)',{exact:true})).toHaveCount(1);
 const fifth=page.getByRole('heading',{name:'Echo 5',exact:true}).locator('..');
 await fifth.locator('summary').click();
 await fifth.screenshot({path:info.outputPath('recovered-fifth-cost.png')});
 await expect(page.getByText('No structural warnings',{exact:true})).toBeVisible();
});


test('moderator can verify and revoke an approved player after initial review',async({page,request},info)=>{
 test.skip(info.project.name!=='desktop','One identity lifecycle per isolated DB.');
 test.skip(!directory||!process.env.USER_BUILD_CARD_UID,'Private source evidence required.');
 const uid=process.env.USER_BUILD_CARD_UID!;
 await page.goto('/BlackShores');
 await page.getByLabel('Moderator token',{exact:true}).fill('browser-test-only-token-00000000000000000000');
 await page.getByRole('button',{name:'Unlock review desk'}).click();
 await page.getByLabel('Review queue',{exact:true}).selectOption('approved');
 await page.getByLabel('Find UID or IGN',{exact:true}).fill(uid);
 await page.getByRole('button',{name:'Load approved players',exact:true}).click();
 await expect(page.getByRole('button',{name:'Unverify '+uid,exact:true})).toHaveCount(5);
 await page.getByLabel('Reviewer name (audit trail)').fill('Verification Browser QA');
 await page.getByRole('button',{name:'Unverify '+uid,exact:true}).first().click();
 await expect(page.getByRole('button',{name:'Verify '+uid,exact:true})).toHaveCount(5);
 for(const golden of scoringCases.cases)expect((await(await request.get('/api/public/leaderboards?character='+golden.character)).json()).builds).toHaveLength(0);
 await page.getByRole('button',{name:'Verify '+uid,exact:true}).first().click();
 await expect(page.getByRole('button',{name:'Unverify '+uid,exact:true})).toHaveCount(5);
 for(const golden of scoringCases.cases)expect((await(await request.get('/api/public/leaderboards?character='+golden.character)).json()).builds).toHaveLength(1);
});
