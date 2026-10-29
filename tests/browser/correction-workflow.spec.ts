import{test,expect}from'@playwright/test';
const token='browser-test-only-token-00000000000000000000',headers={Authorization:'Bearer '+token};
test('blank-note correction preserves original evidence and directly approves and ranks the selected build',async({page,request},info)=>{
 test.skip(process.env.CORRECTION_BROWSER_FIXTURE!=='true','Requires isolated correction fixtures.');
 const character=info.project.name==='desktop'?'Carlotta':'Rebecca',uid=info.project.name==='desktop'?'833333335':'833333337';
 const before=(await(await request.get('/api/moderation?view=player&uid='+uid,{headers})).json()).builds[0];
 const slot=before.data.slots.find((s:{substats:{value:string}[]})=>s.substats[0].value==='DEF 8.1%').slot;
 expect((await request.get('/api/admin/source-evidence?id='+before.id)).status()).toBe(401);
 await page.goto('/BlackShores');await page.getByLabel('Moderator token',{exact:true}).fill(token);await page.getByRole('button',{name:'Unlock review desk'}).click();await page.getByRole('button',{name:/Submissions/}).click();await page.getByRole('button',{name:'Review '+character+' by Synthetic correction QA',exact:true}).filter({hasText:uid}).click();
 const form=page.getByLabel('Moderator Echo substat correction');await form.getByRole('combobox').nth(0).selectOption(String(slot));await form.getByRole('combobox').nth(1).selectOption('1');await form.getByRole('combobox').nth(3).selectOption('DEF 11.8%');
 await expect(form.getByRole('textbox')).toHaveValue('');await expect(page.getByLabel('Review note',{exact:true})).toHaveValue('');await expect(form).toContainText('DEF 11.9%');await expect(form).toContainText('DEF 8.1%');await form.getByRole('button',{name:'Compare retained original screenshot',exact:true}).click();await expect(form.getByAltText('Retained original build screenshot')).toBeVisible();
 const save=form.getByRole('button',{name:'Correct roll and revalidate for ranking',exact:true});await expect(save).toBeEnabled();const done=page.waitForResponse(r=>r.url().endsWith('/api/moderation')&&r.request().method()==='PUT');await save.click();const response=await done;expect(response.status(),await response.text()).toBe(200);expect((await response.json()).ranked).toBe(true);
 const after=(await(await request.get('/api/moderation?view=player&uid='+uid,{headers})).json()).builds[0];expect(after.status).toBe('approved');expect(after.score).toBeGreaterThan(0);expect(after.identityVerified).toBe(before.identityVerified);expect(after.data.slots[slot-1].substats[0].value).toBe('DEF 11.8%');
 const board=await(await request.get('/api/public/leaderboards?character='+character+'&search='+uid)).json();expect(board.builds[0].id).toBe(before.id);await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('corrected-and-ranked.png'),fullPage:true});
});
