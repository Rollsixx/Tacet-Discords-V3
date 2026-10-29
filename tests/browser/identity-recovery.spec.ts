import {test,expect} from '@playwright/test';
const token='browser-test-only-token-00000000000000000000';const headers={Authorization:'Bearer '+token};
test('identity recovery is private, guarded and preserves an approved player build',async({page,request},info)=>{
 test.skip(process.env.IDENTITY_RECOVERY_BROWSER_FIXTURE!=='true','Requires isolated synthetic identity fixture.');
 expect((await request.get('/api/admin/identities?id=00000000-0000-0000-0000-000000000000')).status()).toBe(401);
 const uid=info.project.name==='desktop'?'822222223':'822222222';
 const before=(await(await request.get('/api/moderation?view=player&uid='+uid,{headers})).json()).builds[0];
 await page.goto('/BlackShores');await page.getByLabel('Moderator token',{exact:true}).fill(token);await page.getByRole('button',{name:'Unlock review desk',exact:true}).click();await page.getByRole('button',{name:'Players & builds',exact:true}).click();await page.getByRole('button',{name:'Open player Identity Review QA UID '+uid,exact:true}).click();
 if(before.status==='pending'){await expect(page.getByRole('button',{name:'Approve as unranked Carlotta',exact:true})).toBeDisabled();const denied=await request.post('/api/moderation',{headers,data:{id:before.id,action:'approved',reviewer:'Browser QA',note:'No explicit unranked consent',identityVerified:true}});expect(denied.status()).toBe(422);}
 for(let i=0;i<6;i++){await page.getByLabel('Review note',{exact:true}).pressSequentially('Test');if(before.status==='pending')await page.getByLabel('I understand this build cannot rank.',{exact:false}).setChecked(i%2===0);await expect(page.getByLabel('Equipment identity recovery')).toHaveCount(1);}
 await page.getByRole('button',{name:'Review Echo identities',exact:true}).click();await expect(page.getByLabel('Echo 1 identity',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Retry strict recognition',exact:true})).toBeEnabled();
 await expect(page.getByText('To confirm, enter an audit note',{exact:false})).toBeVisible();
 const retryResponse=page.waitForResponse(r=>r.url().endsWith('/api/admin/identities')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Retry strict recognition',exact:true}).click();
 expect((await retryResponse).status()).toBe(422);await expect(page.getByLabel('Equipment identity recovery').getByRole('alert')).toContainText('retained crops');
 const pairs=[['SentryConstruct','FrostyResolve'],['QuestlessKnight','FrostyResolve'],['AbyssalMercator','FrostyResolve'],['ChopChopLeftless','FrostyResolve'],['GoldenJunrock','FrostyResolve']];
 for(let i=0;i<5;i++){await page.getByLabel('Echo '+(i+1)+' identity',{exact:true}).selectOption(pairs[i][0]);await page.getByLabel('Echo '+(i+1)+' Sonata',{exact:true}).selectOption(pairs[i][1]);}
 const save=page.getByRole('button',{name:'Confirm identities & recalculate',exact:true});await expect(save).toBeDisabled();await page.getByLabel('Identity review note (required)',{exact:true}).fill('Compared all five source portraits and Sonata icons with the equipment catalog.');await page.getByLabel('I compared all five retained portraits',{exact:false}).check();await expect(save).toBeEnabled();
 await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,0);});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('identity-review.png'),fullPage:true});
 await save.click();await expect(page.getByText('Equipment identities recovered.',{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'Review Echo identities',exact:true})).toHaveCount(0);await expect(page.getByLabel('Scoring readiness')).toContainText('5/5 confirmed');
 const after=(await(await request.get('/api/moderation?view=player&uid='+uid,{headers})).json()).builds[0];expect(after.id).toBe(before.id);expect(after.uid).toBe(before.uid);expect(after.status).toBe(before.status);expect(after.identityVerified).toBe(before.identityVerified);expect(after.data.slots).toEqual(before.data.slots);expect(after.data.assessment.eligible).toBe(true);
 if(after.status==='approved'){expect(after.score).toBeGreaterThan(0);expect((await(await request.get('/api/public/leaderboards?character=Carlotta&search='+uid)).json()).builds).toHaveLength(1);}else{expect(after.score).toBeNull();await expect(page.getByRole('button',{name:'Approve Carlotta',exact:true})).toBeEnabled();}
 const audit=await(await request.get('/api/moderation?view=audit&search='+before.id,{headers})).json();expect(audit.events.some((e:{action:string})=>e.action==='echo_identities_confirmed')).toBe(true);
 await page.route('**/api/health',route=>route.fulfill({json:{ok:true,release:'future-test-release'}}));await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await expect(page.getByRole('button',{name:'Reload updated admin',exact:true})).toBeVisible();
});
