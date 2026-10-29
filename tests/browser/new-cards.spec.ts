import{test,expect}from'@playwright/test';import{join}from'node:path';
const directory=process.env.NEW_BUILD_CARDS_DIRECTORY,uid=process.env.NEW_BUILD_CARD_UID;
for(const [name,file]of[['Lucilla','Lucilla.jpeg'],['Lucy','Lucy(1).jpeg'],['Rebecca','Rebecca.jpeg']])test(name+' import keeps source identity and separates equipment from rotation readiness',async({page,request},info)=>{
 test.skip(!directory||!uid,'Requires the private original cards supplied at runtime.');
 await page.goto('/import');await page.getByLabel('Choose build screenshot').setInputFiles(join(directory!,file));
 await expect(page.getByRole('heading',{name:'5 Echo slots processed'})).toBeVisible({timeout:90000});
 await expect(page.getByLabel('Wuthering Waves UID',{exact:true})).toHaveValue(uid!);await expect(page.getByLabel('Wuthering Waves UID',{exact:true})).not.toBeEditable();
 await expect(page.locator('.import-character h2')).toHaveText(name);
 if(name==='Rebecca'){
 await expect(page.getByText('does not match the pinned optimizer', {exact:false}).first()).toBeVisible();
 await expect(page.getByLabel('Echo 3 substat 3',{exact:true})).toHaveValue('DEF 11.9%');
 }else{
 await expect(page.getByText('No structural warnings',{exact:true})).toBeVisible();
 }
 await page.getByLabel('In-game name',{exact:true}).fill('Card regression QA');await page.getByRole('checkbox').check();
 const response=page.waitForResponse(r=>r.url().endsWith('/api/submissions')&&r.request().method()==='POST');await page.getByRole('button',{name:'Submit for moderation',exact:true}).click();const saved=await response;expect([201,409]).toContain(saved.status());if(saved.status()===409)expect((await saved.json()).error).toBe('This build has already been submitted.');
 await page.goto('/BlackShores');await page.getByLabel('Moderator token',{exact:true}).fill('browser-test-only-token-00000000000000000000');await page.getByRole('button',{name:'Unlock review desk',exact:true}).click();await page.getByRole('button',{name:/Submissions/}).click();
 await page.getByRole('button',{name:'Review '+name+' by Card regression QA'}).click();
 for(let i=0;i<4;i++){await page.getByLabel('Review note',{exact:true}).pressSequentially('Test');await page.getByLabel('I understand this build cannot rank.',{exact:false}).setChecked(i%2===0);await expect(page.getByLabel('Equipment identity recovery')).toHaveCount(0);}
 if(name==='Rebecca'){const details=await(await request.get('/api/moderation?view=player&uid='+uid,{headers:{Authorization:'Bearer browser-test-only-token-00000000000000000000'}})).json();const build=details.builds.find((b:{character:string})=>b.character==='Rebecca');expect(build.data.assessment.statsVerified).toBe(true);expect(build.data.assessment.rollsVerified).toBe(false);expect(build.data.assessment.eligible).toBe(false);expect(build.score).toBeNull();expect(build.data.slots[2].substats[2].value).toBe('DEF 11.9%');await expect(page.getByLabel('Original screenshot required')).toBeVisible();await expect(page.getByLabel('Scoring readiness')).toContainText('Source data review');}else{
 await expect(page.getByLabel('Official rotation required',{exact:true})).toBeVisible();await expect(page.getByLabel('Scoring readiness')).toContainText('Equipment verified · awaiting official rotation');
 await expect(page.getByRole('button',{name:'Review Echo identities',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Open '+name+' rotation',exact:true}).click();await expect(page.getByLabel('Resonator',{exact:true})).toHaveValue(name);
 }
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath(name+'.png'),fullPage:true});
});
