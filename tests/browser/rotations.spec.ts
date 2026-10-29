import {test,expect} from '@playwright/test';
const token='browser-test-only-token-00000000000000000000';const headers={Authorization:'Bearer '+token};
test('rotation drafts autosave, reorder and survive reload; blank optional notes validate and preview without bypassing publication guards',async({page,request},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 expect((await request.get('/api/admin/rotations')).status()).toBe(401);
 await page.goto('/BlackShores');await page.getByLabel('Moderator token',{exact:true}).fill(token);await page.getByRole('button',{name:'Unlock review desk'}).click();await page.getByRole('button',{name:'Rotations',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Rotation draft',exact:true})).toBeVisible();await expect(page.getByText('Optimizer connected · Owner-reviewed benchmark',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Resonator',{exact:true}).locator('option')).toHaveCount(15);
 await page.getByLabel('Evaluation mode').selectOption('admin-reviewed');await page.getByLabel('Starting conditions & combat review notes').fill('');
 await page.getByLabel('Rotation name',{exact:true}).fill('Browser draft '+info.project.name);
 await expect(page.getByText(/Saved · revision/)).toBeVisible({timeout:10000});
 await page.getByLabel('Repeat action 1',{exact:true}).fill('2');await expect(page.getByText(/Saved · revision/)).toBeVisible({timeout:10000});
 const name=await page.locator('.rotation-actions li').first().locator('strong').textContent();await page.getByRole('button',{name:'Move action 1 down',exact:true}).click();await expect(page.locator('.rotation-actions li').first().locator('strong')).not.toHaveText(name!);await expect(page.getByText(/Saved · revision/)).toBeVisible({timeout:10000});
 await page.getByLabel('Add verified attack data').selectOption('skill:ArtofViolenceDMG');const count=await page.locator('.rotation-actions li').count();await page.getByRole('button',{name:'Add attack',exact:true}).click();await expect(page.locator('.rotation-actions li')).toHaveCount(count+1);await expect(page.getByText(/Saved · revision/)).toBeVisible({timeout:10000});await page.getByRole('button',{name:'Remove action '+(count+1),exact:true}).click();await expect(page.locator('.rotation-actions li')).toHaveCount(count);await expect(page.getByText(/Saved · revision/)).toBeVisible({timeout:10000});
 await page.getByRole('button',{name:'Validate draft',exact:true}).click();await expect(page.getByText('Passed · optimizer configuration checked; owner review required',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Preview leaderboard changes',exact:true})).toBeEnabled();
 const workspace=await(await request.get('/api/admin/rotations?character=Carlotta',{headers})).json();expect(workspace.draft.spec.name).toBe('Browser draft '+info.project.name);expect(workspace.draft.spec.conditions).toBe('');
 const conflict=await request.post('/api/admin/rotations',{headers,data:{operation:'save',character:'Carlotta',revision:0,spec:workspace.draft.spec}});expect(conflict.status()).toBe(409);
 const forged=await request.post('/api/admin/rotations',{headers,data:{operation:'save',character:'Carlotta',revision:workspace.draft.revision,spec:{...workspace.draft.spec,actions:[{type:'skill',key:'ArtofViolenceDMG',count:1,buffs:[{modifier:'ATK',modifierValue:999}]}]}}});expect(forged.status()).toBe(400);

 await page.locator('.rotation-effects').first().locator('summary').click();await page.getByLabel('Optimizer effect for action 1',{exact:true}).selectOption('buffs:Deconstruction');await page.locator('.rotation-effects').first().getByRole('button',{name:'Add effect',exact:true}).click();
 await expect(page.getByText(/Saved · revision/)).toBeVisible({timeout:10000});await page.getByRole('button',{name:'Validate draft',exact:true}).click();await expect(page.getByText('Passed · optimizer configuration checked; owner review required',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Preview leaderboard changes',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Test against builds',exact:true}).click();await expect(page.getByRole('heading',{name:'Optimizer build comparison'})).toBeVisible();
 if(info.project.name==='desktop'){
  await expect(page.getByLabel('Starting conditions & combat review notes')).toHaveValue('');await page.getByRole('button',{name:'Preview leaderboard changes',exact:true}).click();await expect(page.getByRole('button',{name:'Review publication confirmation'})).toBeEnabled({timeout:30000});await page.getByRole('button',{name:'Review publication confirmation'}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('checkbox').check();await dialog.getByLabel('Publication confirmation').fill((await dialog.locator('strong').textContent())!);await dialog.getByRole('button',{name:'Confirm publication',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('at least one approved build');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 }
 await expect.poll(()=>page.locator('.rotation-actions li').nth(1).locator('div').first().evaluate(el=>el.getBoundingClientRect().width)).toBeGreaterThan(120);
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('rotation-editor.png'),fullPage:true});
 await page.reload();await page.getByLabel('Moderator token',{exact:true}).fill(token);await page.getByRole('button',{name:'Unlock review desk'}).click();await page.getByRole('button',{name:'Rotations',exact:true}).click();await expect(page.getByLabel('Rotation name',{exact:true})).toHaveValue('Browser draft '+info.project.name);expect(errors).toEqual([]);
});

test('expanded leaderboard categories load with local portraits',async({page},info)=>{
 await page.goto('/leaderboards');
 for(const name of ['Suoming','Jingran','Hsin','Qingxiao','Suisui','Lucy','Lucilla','Rebecca','Denia','Sigrika']){
  const response=page.waitForResponse(r=>r.url().includes('/api/public/leaderboards?')&&new URL(r.url()).searchParams.get('character')===name);
  await page.locator('.lb-character-tabs button').filter({hasText:name}).click();expect((await response).status()).toBe(200);
  await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
  const portrait=page.locator('.lb-character-tabs button').filter({hasText:name}).locator('img');await expect.poll(()=>portrait.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
 }
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('expanded-roster.png'),fullPage:true});
});

test('effect editor separates categories, groups every Echo by cost and preserves draft configuration',async({page,request},info)=>{
 await page.goto('/BlackShores');await page.getByLabel('Moderator token',{exact:true}).fill(token);await page.getByRole('button',{name:'Unlock review desk'}).click();await page.getByRole('button',{name:'Rotations',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Rotation draft',exact:true})).toBeVisible();
 await page.getByLabel('Evaluation mode').selectOption('admin-reviewed');
 const effects=page.locator('.rotation-effects').first();await effects.locator('summary').click();
 const categories=page.getByRole('group',{name:'Effect category for action 1',exact:true});
 await expect(categories.getByRole('button')).toHaveCount(4);
 await categories.getByRole('button',{name:/Signature weapon/}).click();await expect(page.getByLabel('Optimizer effect for action 1',{exact:true}).locator('optgroup')).toHaveCount(0);
 await categories.getByRole('button',{name:/Sonata/}).click();await expect(page.getByLabel('Sonata set for action 1',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Sonata set for action 1',{exact:true}).locator('option')).toHaveCount(38);
 await page.getByLabel('Sonata set for action 1',{exact:true}).selectOption('HeartofEvilsPurge');
 const sonataReference=effects.getByRole('region',{name:'Selected Sonata reference'});
 await expect(sonataReference.getByText('2-piece bonus',{exact:true})).toBeVisible();await expect(sonataReference.getByText('5-piece bonus',{exact:true})).toBeVisible();
 await expect(sonataReference).toContainText('Crit. DMG');
 await categories.getByRole('button',{name:/Main Echo/}).click();const costs=page.getByRole('group',{name:'Main Echo cost for action 1',exact:true});await expect(costs.getByRole('button')).toHaveCount(3);
 const workspace=await(await request.get('/api/admin/rotations?character=Carlotta',{headers})).json();let count=0;
 for(const cost of [4,3,1]){await costs.getByRole('button',{name:new RegExp('^'+cost+' cost')}).click();const options=page.getByLabel('Main Echo for action 1',{exact:true}).locator('option');const expected=workspace.mainEchoes.filter((e:{cost:number})=>e.cost===cost).length;await expect(options).toHaveCount(expected+1);count+=expected;}
 expect(count).toBe(230);
 await costs.getByRole('button',{name:/^1 cost/}).click();await page.getByLabel('Main Echo for action 1',{exact:true}).selectOption('KernelPuppetJoy');await expect(effects.getByRole('region',{name:'Selected Echo reference'})).toContainText('Compatible Sonata sets');await expect(effects.getByText('This Echo has no Main Echo stat buff',{exact:false})).toBeVisible();
 await costs.getByRole('button',{name:/^3 cost/}).click();await page.getByLabel('Main Echo for action 1',{exact:true}).selectOption('Formrender');await expect(effects.locator('.rotation-fixed-effect')).not.toHaveCount(0);await expect(effects.locator('.rotation-fixed-effect input')).toHaveCount(0);
 await costs.getByRole('button',{name:/^4 cost/}).click();await page.getByLabel('Main Echo for action 1',{exact:true}).selectOption('ReminiscenceSuhsintheInevitable');
 const modifier=workspace.modifiers.find((m:{category:string;scope:string})=>m.category==='mainEchoBuff'&&m.scope==='ReminiscenceSuhsintheInevitable');
 await page.getByLabel('Optimizer effect for action 1',{exact:true}).selectOption(modifier.id);await effects.getByRole('button',{name:'Add effect',exact:true}).click();await expect(effects.locator('.rotation-effect')).toContainText('Reminiscence');
 await expect(page.getByText(/Saved · revision/)).toBeVisible({timeout:10000});
 await categories.getByRole('button',{name:/^Resonator/}).click();await expect(page.getByLabel('Main Echo for action 1',{exact:true})).toHaveCount(0);await categories.getByRole('button',{name:/Main Echo/}).click();await expect(effects.locator('.rotation-effect')).toContainText('Reminiscence');
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('effect-library.png'),fullPage:true});
 const saved=await(await request.get('/api/admin/rotations?character=Carlotta',{headers})).json();expect(saved.draft.spec.actions[0].effects.some((e:{id:string})=>e.id===modifier.id)).toBe(true);
 // Remove the local fixture effect so another viewport can exercise the same picker.
 await effects.locator('.rotation-effect').getByRole('button',{name:/^Remove /}).click();await expect(page.getByText(/Saved · revision/)).toBeVisible({timeout:10000});
});

test('owner-first resonators expose clear unranked categories and editable empty rotation workspaces',async({page,request},info)=>{
 for(const name of ['Lucy','Lucilla','Rebecca']){
  await page.goto('/leaderboards?character='+name);await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();await expect(page.getByRole('status').filter({hasText:'Rankings are awaiting'})).toBeVisible();
  const data=await(await request.get('/api/public/leaderboards?character='+name)).json();expect(data.rotationReady).toBe(false);expect(data.builds).toHaveLength(0);
 }
 await page.goto('/BlackShores');await page.getByLabel('Moderator token',{exact:true}).fill(token);await page.getByRole('button',{name:'Unlock review desk'}).click();await page.getByRole('button',{name:'Rotations',exact:true}).click();
 for(const name of ['Lucy','Lucilla','Rebecca']){
  await page.getByLabel('Resonator',{exact:true}).selectOption(name);await expect(page.getByText('Official rotation required',{exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Awaiting owner rotation · '+name,exact:true})).toBeVisible();
  const data=await(await request.get('/api/admin/rotations?character='+name,{headers})).json();expect(data.active.policy_id).toBe('awaiting-owner-rotation/1');expect(data.active.spec.actions).toHaveLength(0);expect(data.catalog.length).toBeGreaterThan(0);
 }
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('owner-first-rotation.png'),fullPage:true});
});

test('shared rotation defaults inherit into moves, overrides reset, paste expands and range edits preserve defaults',async({page,request},info)=>{
 await page.goto('/BlackShores');await page.getByLabel('Moderator token',{exact:true}).fill(token);await page.getByRole('button',{name:'Unlock review desk'}).click();await page.getByRole('button',{name:'Rotations',exact:true}).click();await page.getByLabel('Resonator',{exact:true}).selectOption('Chisa');await expect(page.getByRole('heading',{name:'Rotation draft',exact:true})).toBeVisible();
 const get=async()=>await(await request.get('/api/admin/rotations?character=Chisa',{headers})).json();let w=await get();
 // Each viewport starts from an explicit empty shared setup in the local fixture.
 const original=w.active.spec;await request.post('/api/admin/rotations',{headers,data:{operation:'save',character:'Chisa',revision:w.draft?.revision||0,spec:{...original,mode:'admin-reviewed',conditions:'Browser fixture only',defaults:[],actions:original.actions.map((a:{type:string;key:string;count:number})=>({type:a.type,key:a.key,count:a.count,effects:[]}))}}});
 await page.getByRole('button',{name:'Reload saved draft',exact:true}).click();await expect(page.locator('.rotation-defaults')).toBeVisible();
 w=await get();const thread=w.modifiers.find((m:{scope:string})=>m.scope==='Thread of Severed Fate 3 Set'),glow=w.modifiers.find((m:{scope:string})=>m.scope==='Rejuvenating Glow 5 Set');const defaults=page.locator('.rotation-defaults');await defaults.locator(':scope > summary').click();
 await page.getByRole('group',{name:'Effect category for rotation defaults',exact:true}).getByRole('button',{name:/Sonata/}).click();
 for(const [set,modifier]of [['ThreadofSeveredFate',thread],['RejuvenatingGlow',glow]] as const){await page.getByLabel('Sonata set for rotation defaults',{exact:true}).selectOption(set);await page.getByLabel('Optimizer effect for rotation defaults',{exact:true}).selectOption(modifier.id);await defaults.getByRole('button',{name:'Add effect',exact:true}).click();}
 await expect.poll(async()=>(await get()).draft.spec.defaults.length).toBe(2);
 const first=page.locator('.rotation-effects').first();await first.locator(':scope > summary').click();await first.getByRole('group',{name:'Effect category for action 1',exact:true}).getByRole('button',{name:/Sonata/}).click();await expect(first.locator('.rotation-inherited article')).toHaveCount(2);
 await first.locator('.rotation-inherited article').filter({hasText:'Thread of Severed Fate'}).getByRole('button').click();await first.locator('.rotation-effect input[type=checkbox]').uncheck();await expect.poll(async()=>(await get()).draft.spec.actions[0].effects[0]?.isEnabled).toBe(false);
 await page.getByLabel('Search moves',{exact:true}).fill('SerratedLoopDMG');await page.getByLabel('Add verified attack data',{exact:true}).selectOption('skill:SerratedLoopDMG');await page.getByRole('button',{name:'Add attack',exact:true}).click();await page.getByLabel('Search moves',{exact:true}).fill('');
 await page.getByText('Paste a moveset',{exact:true}).click();await page.getByLabel('Paste moveset',{exact:true}).fill('liberation: MomentofNihilityDMG x25');await page.getByRole('button',{name:'Add pasted moves',exact:true}).click();await expect.poll(async()=>{const a=(await get()).draft.spec.actions;return a.slice(-2).map((x:{count:number})=>x.count).join(',');}).toBe('20,5');
 await page.getByText('Advanced overrides for a range of moves',{exact:true}).click();await page.getByLabel('Copy from move',{exact:true}).fill('1');await page.getByLabel('Range start',{exact:true}).fill('2');await page.getByLabel('Range end',{exact:true}).fill('3');await page.getByRole('button',{name:'Copy overrides to range',exact:true}).click();await expect.poll(async()=>(await get()).draft.spec.actions[2].effects[0]?.isEnabled).toBe(false);await page.getByRole('button',{name:'Reset range to defaults',exact:true}).click();await expect.poll(async()=>(await get()).draft.spec.actions[2].effects.length).toBe(0);
 await first.locator('.rotation-effect').getByRole('button',{name:/^Remove /}).click();await expect(first.locator('.rotation-inherited article')).toHaveCount(2);await expect.poll(async()=>(await get()).draft.spec.actions[0].effects.length).toBe(0);expect((await get()).draft.spec.defaults.every((e:{isEnabled:boolean})=>e.isEnabled)).toBe(true);
 await page.getByRole('button',{name:'Validate draft',exact:true}).click();await expect(page.getByText('Passed · optimizer configuration checked; owner review required',{exact:true})).toBeVisible();await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('shared-defaults.png'),fullPage:true});
 await page.reload();await page.getByLabel('Moderator token',{exact:true}).fill(token);await page.getByRole('button',{name:'Unlock review desk'}).click();await page.getByRole('button',{name:'Rotations',exact:true}).click();await page.getByLabel('Resonator',{exact:true}).selectOption('Chisa');await expect(page.locator('.rotation-defaults>summary')).toHaveText('Rotation defaults · 2 configured');
});
