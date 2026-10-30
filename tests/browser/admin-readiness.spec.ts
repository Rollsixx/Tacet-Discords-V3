import {test,expect} from '@playwright/test';
const token='browser-test-only-token-00000000000000000000',headers={Authorization:'Bearer '+token};
test('historical correction verification requires confirmation but no note and preserves history',async({page,request},info)=>{
 test.skip(process.env.CORRECTION_BROWSER_FIXTURE!=='true','Requires isolated fixtures.');
 const uid=info.project.name==='desktop'?'833333340':'833333341';
 const before=(await(await request.get('/api/moderation?view=player&uid='+uid,{headers})).json()).builds[0];
 await page.goto('/BlackShores');await page.getByLabel('Moderator token',{exact:true}).fill(token);await page.getByRole('button',{name:'Unlock review desk'}).click();await page.getByRole('button',{name:/Submissions/}).click();await page.getByRole('button',{name:'Review '+before.character+' by Synthetic correction QA',exact:true}).filter({hasText:uid}).click();
 const form=page.getByLabel('Historical correction verification'),button=form.getByRole('button',{name:'Verify existing corrections and revalidate'});
 await expect(page.getByLabel('Resolve equipment identities')).toHaveCount(0);await expect(button).toBeDisabled();await form.getByRole('checkbox').check();await expect(button).toBeEnabled();
 const done=page.waitForResponse(r=>r.url().endsWith('/api/moderation')&&r.request().method()==='PUT');await button.click();const response=await done;expect(response.status(),await response.text()).toBe(200);expect((await response.json()).ranked).toBe(true);
 const after=(await(await request.get('/api/moderation?view=player&uid='+uid,{headers})).json()).builds[0];expect(after.data.substatCorrections).toEqual(before.data.substatCorrections);expect(after.status).toBe('approved');expect(after.data.correctionVerifications).toHaveLength(1);
 const board=await(await request.get('/api/public/leaderboards?character='+before.character+'&search='+uid)).json();expect(board.builds[0].id).toBe(before.id);
});
test('awaiting rotation shows an actionable rotation link, no identity review duplication, and catalog source gaps',async({page})=>{
 test.skip(process.env.CORRECTION_BROWSER_FIXTURE!=='true','Requires isolated fixtures.');
 await page.goto('/BlackShores');await page.getByLabel('Moderator token',{exact:true}).fill(token);await page.getByRole('button',{name:'Unlock review desk'}).click();await page.getByRole('button',{name:/Submissions/}).click();await page.getByRole('button',{name:'Review Lucilla by Synthetic correction QA',exact:true}).filter({hasText:'833333342'}).click();
 await expect(page.getByLabel('Official rotation required')).toBeVisible();await expect(page.getByRole('button',{name:'Review Echo identities',exact:true})).toHaveCount(0);
 await page.getByLabel('Review note',{exact:true}).fill('typing should never duplicate panels');await page.getByRole('checkbox',{name:/This build still has unresolved/}).check();await page.getByRole('checkbox',{name:/This build still has unresolved/}).uncheck();await expect(page.getByLabel('Official rotation required')).toHaveCount(1);await expect(page.getByRole('button',{name:'Review Echo identities',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:/System status/}).click();await expect(page.getByLabel('Catalog completeness')).toContainText('230 Echoes');await expect(page.getByLabel('Catalog completeness')).toContainText('37 Sonatas');await expect(page.getByText('Upstream main-slot effect gaps (22)',{exact:true})).toBeVisible();
});
