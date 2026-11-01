import {test,expect} from '@playwright/test';
test('Home Top 5 panels, player links, beta navigation and local portraits',async({page,request},info)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 const boards=['Hiyuki','Aemeath','Chisa'].map((character,i)=>({character,players:i===0?Array.from({length:5},(_,n)=>({id:'home-qa-'+n,uid:'88776655'+n,ign:'QA Player '+n,rank:n+1,score:234283-n*1000})):i===1?[{id:'home-qa-a',uid:'899999999',ign:'QA Aemeath',rank:1,score:200000}]:[]}));
 await page.route('**/api/public/home',route=>route.fulfill({json:{boards}}));
 await page.route('**/api/public/leaderboards?*',route=>{const character=new URL(route.request().url()).searchParams.get('character')||'Carlotta';return route.fulfill({json:{builds:[{id:'lb-qa-1',uid:'887766550',ign:'QA Player 0',character,status:'approved',createdAt:'2026-10-28',identityVerified:true,score:123456.78,rank:1,rankDays:3,rankTrackingSince:'2026-10-28T00:00:00.000Z',rankHasHistory:true,data:{assessment:{calculation:{finalStats:{totalHp:16000,totalAtk:2300,totalDef:1100,totalCritRate:.55,totalCritDMG:2.2},identities:[]}},slots:Array.from({length:5},(_,i)=>({slot:i+1,cost:{value:'1'},mainStat:{value:'ATK'},substats:[]}))}}],page:1,hasMore:false}});});
 await page.route('**/api/public/players?*',route=>{
  const uid=new URL(route.request().url()).searchParams.get('uid');
  if(!uid)return route.fulfill({json:{players:[],hasMore:false}});
  const aemeath=uid==='899999999';
  return route.fulfill({json:{builds:[{id:aemeath?'home-qa-a':'home-qa-0',uid,ign:aemeath?'QA Aemeath':'QA Player 0',character:aemeath?'Aemeath':'Hiyuki',status:'approved',createdAt:'2026-10-28',identityVerified:true,score:200000,data:{assessment:{calculation:{finalStats:{totalHp:16000,totalAtk:2300,totalDef:1100},identities:[]}},slots:Array.from({length:5},(_,i)=>({slot:i+1,cost:{value:'1'},mainStat:{value:'ATK'},substats:[]}))}}],page:1,hasMore:false}});
 });
 await page.route('**/api/assets/home-qa-*',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="192" height="182"/>'}));
 await page.goto('/');await expect(page.getByRole('heading',{name:'See where your build stands.'})).toBeVisible();
 await expect(page.getByText('Recently approved builds',{exact:true})).toHaveCount(0);await expect(page.getByText('Featured Resonators',{exact:true})).toHaveCount(0);
 await expect(page.locator('.home-ranking-card')).toHaveCount(3);await expect(page.getByRole('article',{name:'Hiyuki Top 5'}).locator('.home-top-players li')).toHaveCount(5);
 await expect(page.getByRole('article',{name:'Aemeath Top 5'}).locator('.home-top-players li')).toHaveCount(1);await expect(page.getByRole('article',{name:'Chisa Top 5'})).toContainText('No verified scores yet.');
 await expect(page.getByRole('link',{name:"View QA Player 0's Hiyuki build"})).toHaveAttribute('href','/profiles?uid=887766550&build=home-qa-0');
 await expect(page.locator('.version-label')).toHaveText('V3 / BETA');await expect(page.locator('.version-label')).toBeVisible();await expect(page.locator('.nav-links a[aria-current=page]')).toHaveText('Home');
 await expect.poll(()=>page.locator('.home-character-art').evaluateAll(images=>images.length===3&&images.every(image=>(image as HTMLImageElement).naturalWidth>0))).toBe(true);
 for(const name of ['Carlotta','Cartethyia','Hiyuki','Aemeath','Chisa'])expect((await request.get('/resonators/'+name+'.png')).status()).toBe(200);
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 for(const width of [768,1024,1440,390]){await page.setViewportSize({width,height:950});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('.version-label')).toBeVisible();}
 await page.setViewportSize(info.project.name==='mobile'?{width:390,height:844}:{width:1440,height:1000});await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,0);});await page.screenshot({path:info.outputPath('home-top-five.png'),fullPage:true});
 await page.getByRole('link',{name:"View QA Player 0's Hiyuki build",exact:true}).click();
 await expect(page.locator('.lb-echo')).toHaveCount(5);await expect(page.locator('.lb-expanded-heading')).toContainText('Hiyuki');
 await page.locator('.nav-links a').filter({hasText:'Home'}).click();
 await page.getByRole('link',{name:"View QA Aemeath's Aemeath build",exact:true}).click();
 await expect(page.locator('.pp-player-header')).toContainText('QA Aemeath');await expect(page.locator('.lb-echo')).toHaveCount(5);await expect(page.locator('.lb-expanded-heading')).toContainText('Aemeath');
 await page.locator('.nav-links a').filter({hasText:'Home'}).click();
 await page.getByLabel('Looking for someone?').fill('Rover Test');await page.getByRole('button',{name:'Search players',exact:true}).click();await expect(page).toHaveURL(/profiles\?search=Rover\+Test/);await expect(page.locator('.nav-links a[aria-current=page]')).toHaveText('Profiles');
 await page.locator('.nav-links a').filter({hasText:'Import'}).click();await expect(page.locator('.nav-links a[aria-current=page]')).toHaveText('Import');
 await page.locator('.nav-links a').filter({hasText:'Leaderboards'}).click();await expect(page.locator('.nav-links a[aria-current=page]')).toHaveText('Leaderboards');
 const patchPickers=['1','2','3'].map(patch=>page.getByRole('button',{name:`Choose a ${patch}.x Resonator`}));
 await expect(page.locator('.lb-patch-picker')).toHaveCount(3);
 for(const picker of patchPickers) await expect(picker).toBeVisible();
 await patchPickers[0].click();
 const characterMenu=page.getByRole('listbox',{name:'Choose a 1.x Resonator'});
 await expect(characterMenu).toBeVisible();
 await expect(characterMenu.locator('.lb-patch-option-avatar').first()).toBeVisible();
 await page.keyboard.press('Escape');
 await expect.poll(()=>page.locator('img.lb-board-mark').evaluate((image:HTMLImageElement)=>image.complete&&image.naturalWidth>0)).toBe(true);
 await expect(page.locator('.lb-player-row')).toHaveCount(1);
 await expect(page.locator('.lb-score')).toContainText('123,457');
 for(const width of [360,768,1280]){await page.setViewportSize({width,height:900});await expect(width<=1100?page.locator('.lb-mobile-rank-card'):page.locator('.lb-score')).toBeVisible();await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 expect(errors).toEqual([]);
});
test('Home ranking failures offer retry and missing portraits fall back cleanly',async({page})=>{
 await page.route('**/api/public/home',route=>route.fulfill({status:503,json:{error:'Unavailable'}}));await page.route('**/resonators/Hiyuki.png',route=>route.abort());
 await page.goto('/');await expect(page.locator('.home-ranking-card [role=alert]')).toHaveCount(3);await expect(page.getByRole('img',{name:'Hiyuki portrait unavailable',exact:true})).toBeVisible();
 await page.unroute('**/api/public/home');await page.route('**/api/public/home',route=>route.fulfill({json:{boards:['Hiyuki','Aemeath','Chisa'].map(character=>({character,players:[]}))}}));
 await page.getByRole('button',{name:'Try again',exact:true}).first().click();await expect(page.locator('.home-ranking-card [role=alert]')).toHaveCount(0);await expect(page.getByText('No verified scores yet.',{exact:true})).toHaveCount(3);
});
