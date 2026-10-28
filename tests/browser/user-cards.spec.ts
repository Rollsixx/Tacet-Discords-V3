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
  await page.goto('/import',{waitUntil:'networkidle'});
  await page.getByLabel('Choose build screenshot').setInputFiles(file);
  await expect(page.getByRole('heading',{name:'5 Echo slots processed'})).toBeVisible({timeout:60000});
  await expect(page.locator('img[alt^="Extracted Echo portrait"]')).toHaveCount(5);
  await expect(page.locator('img[alt^="Extracted Sonata icon"]')).toHaveCount(5);
  const values = await page.locator('input[aria-label^="Echo "],textarea[aria-label^="Echo "]').evaluateAll(inputs=>inputs.map(input=>(input as HTMLInputElement).value));
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
 await page.goto('/import',{waitUntil:'networkidle'});
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
 const stats=page.locator('input[aria-label^="Echo "],textarea[aria-label^="Echo "]');
 await expect(stats).toHaveCount(35);
 for(const field of await stats.all()) await expect(field).not.toBeEditable();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>new Promise<void>(resolve=>{window.scrollTo(0,0);requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()));}));
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
 await page.goto('/import',{waitUntil:'networkidle'});
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
 if(character === 'Carlotta') {
  const forged=savedResponse.request().postDataJSON();
  forged.slots[0].substats[0]={raw:'Crit. DMG 21%',value:'Crit. DMG 21%'};
  const blocked=await request.post('/api/submissions',{data:forged});
  expect(blocked.status()).toBe(400);expect((await blocked.json()).error).toContain('Echo stats');
 }
 expect((await(await request.get('/api/public/leaderboards?character='+character)).json()).builds).toHaveLength(0);
 await page.goto('/BlackShores');
 await page.getByLabel('Moderator token',{exact:true}).fill('browser-test-only-token-00000000000000000000');
 await page.getByRole('button',{name:'Unlock review desk'}).click();
 await expect(page.getByText('Scoring: Source image, numeric fields and scoring policy validated; moderator approval and identity verification required.',{exact:true})).toBeVisible();
 await page.getByLabel('Reviewer name (audit trail)').fill('Scoring Browser QA');
 const manualVerification=page.getByLabel('I manually matched this UID/IGN to the member outside the website.');
 if(await manualVerification.count())await manualVerification.check();
 else await expect(page.locator('.bs-inherited')).toContainText('Automatically inherited');
 await page.getByRole('button',{name:'Approve '+character,exact:true}).click();
 await expect(page.getByText('No pending submissions.',{exact:true})).toBeVisible();
 const ranked=await(await request.get('/api/public/leaderboards?character='+character)).json();
 expect(ranked.builds).toHaveLength(1);
 expect(ranked.builds[0].score).toBeCloseTo(golden.score,5);
 await page.goto('/leaderboards?character='+character);
 await expect(page.locator('.lb-player-row')).toHaveCount(1);
 await expect(page.locator('.lb-rank')).toHaveText('1');
 await expect(page.locator('.lb-expanded')).toHaveCount(0);
 await page.getByRole('button',{name:'View Scoring Browser QA Echoes',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Equipped Echoes',exact:true})).toBeVisible();
 await expect(page.locator('.lb-echo')).toHaveCount(5);
 await expect.poll(()=>page.locator('.lb-portrait').evaluateAll(images=>images.every(image=>(image as HTMLImageElement).naturalWidth===192))).toBe(true);
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,0);});
 await page.screenshot({path:info.outputPath(character+'-official-leaderboard.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await expect.poll(()=>page.locator('.lb-character-tabs').evaluate(container=>{
  const selected=container.querySelector('[aria-pressed="true"]')!;
  const a=selected.getBoundingClientRect(),b=container.getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1;
 })).toBe(true);
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath(character+'-official-leaderboard-mobile.png'),fullPage:true});
 await page.getByRole('button',{name:'Hide Scoring Browser QA Echoes',exact:true}).click();
 await expect(page.locator('.lb-expanded')).toHaveCount(0);
 await page.getByLabel('Search UID or in-game name',{exact:true}).fill('NoSuchPlayer');
 await expect(page.getByRole('heading',{name:'No matching players',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Clear search',exact:true}).first().click();
 await expect(page.locator('.lb-player-row')).toHaveCount(1);
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
 await page.goto('/import',{waitUntil:'networkidle'});
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
 await page.getByRole('button',{name:'Apply filters',exact:true}).click();
 await expect(page.getByRole('button',{name:'Unverify '+uid,exact:true})).toHaveCount(1);
 await page.getByLabel('Reviewer name (audit trail)').fill('Verification Browser QA');
 await page.getByRole('button',{name:'Unverify '+uid,exact:true}).first().click();
 await expect(page.getByRole('button',{name:'Verify '+uid,exact:true})).toHaveCount(1);
 for(const golden of scoringCases.cases)expect((await(await request.get('/api/public/leaderboards?character='+golden.character)).json()).builds).toHaveLength(0);
 await page.getByRole('button',{name:'Verify '+uid,exact:true}).first().click();
 await expect(page.getByRole('button',{name:'Unverify '+uid,exact:true})).toHaveCount(1);
 for(const golden of scoringCases.cases)expect((await(await request.get('/api/public/leaderboards?character='+golden.character)).json()).builds).toHaveLength(1);
});


test('verified UID inherits review status and admin groups every build under one player',async({page,request},info)=>{
 test.skip(info.project.name!=='desktop','One verified UID lifecycle per isolated DB.');
 test.skip(!directory||!process.env.USER_BUILD_CARD_UID,'Private originals required locally.');
 const uid=process.env.USER_BUILD_CARD_UID!;
 const headers={Authorization:'Bearer browser-test-only-token-00000000000000000000'};
 const publicBuilds=(await(await request.get('/api/public/builds?search='+uid)).json()).builds;
 expect(publicBuilds).toHaveLength(5);
 const hiyuki=publicBuilds.find((build:{character:string})=>build.character==='Hiyuki');
 expect((await request.delete('/api/moderation',{headers,data:{id:hiyuki.id,confirm:true,reviewer:'Grouped QA',note:'Create a local pending import for a verified UID'}})).status()).toBe(200);
 await page.goto('/import',{waitUntil:'networkidle'});
 await page.getByLabel('Choose build screenshot').setInputFiles(join(directory!,'Hiyuki(3).jpg'));
 await expect(page.getByText('No structural warnings',{exact:true})).toBeVisible({timeout:60000});
 await page.getByLabel('In-game name',{exact:true}).fill('Scoring Browser QA');await page.getByRole('checkbox').check();
 const response=page.waitForResponse(r=>r.url().endsWith('/api/submissions')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Submit for moderation',exact:true}).click();expect((await response).status()).toBe(201);
 const pending=(await(await request.get('/api/moderation?status=pending&search='+uid,{headers})).json()).builds;
 expect(pending).toHaveLength(1);expect(pending[0].identityVerified).toBe(true);
 expect((await request.get('/api/moderation?view=players')).status()).toBe(401);
 expect((await request.get('/api/moderation?view=player&uid='+uid)).status()).toBe(401);
 await page.goto('/BlackShores',{waitUntil:'networkidle'});await page.getByLabel('Moderator token',{exact:true}).fill('browser-test-only-token-00000000000000000000');await page.getByRole('button',{name:'Unlock review desk',exact:true}).click();
 await expect(page.locator('.bs-inherited')).toContainText('Only build approval');
 await expect(page.getByLabel('I manually matched this UID/IGN to the member outside the website.')).toHaveCount(0);
 await page.getByRole('button',{name:'Players & builds',exact:true}).click();
 await expect(page.getByRole('button',{name:'Open player Scoring Browser QA UID '+uid,exact:true})).toHaveCount(1);
 await page.getByRole('button',{name:'Open player Scoring Browser QA UID '+uid,exact:true}).click();
 await expect(page.getByLabel('All imported builds').getByRole('button')).toHaveCount(5);
 await expect(page.getByLabel('Player build collection')).toContainText('4 approved · 1 pending');
 await page.getByRole('button',{name:'Review Hiyuki by Scoring Browser QA',exact:true}).click();
 await expect(page.locator('.bs-inherited')).toBeVisible();
 await page.getByRole('button',{name:'Approve Hiyuki',exact:true}).click();
 await expect(page.getByLabel('Player build collection')).toContainText('5 approved · 0 pending');
 expect((await(await request.get('/api/public/leaderboards?character=Hiyuki')).json()).builds).toHaveLength(1);
 await page.getByRole('button',{name:'Unverify '+uid,exact:true}).click();
 await expect(page.getByRole('button',{name:'Verify '+uid,exact:true})).toBeVisible();
 const revoked=(await(await request.get('/api/moderation?view=player&uid='+uid,{headers})).json()).builds;
 expect(revoked).toHaveLength(5);expect(revoked.every((build:{identityVerified:boolean})=>!build.identityVerified)).toBe(true);
 await page.getByRole('button',{name:'Verify '+uid,exact:true}).click();await expect(page.getByRole('button',{name:'Unverify '+uid,exact:true})).toBeVisible();
 await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,0);});await page.screenshot({path:info.outputPath('grouped-admin-player.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('grouped-admin-player-mobile.png'),fullPage:true});
});
