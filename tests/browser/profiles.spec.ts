import {test,expect} from '@playwright/test';
test('player search, multi-player tabs, resonator stats, reload and empty/error states',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 const players=[{uid:'812345678',ign:'QA Rover',builds:1,characters:1,updatedAt:'2026-10-28'},{uid:'899999999',ign:'Second QA',builds:1,characters:1,updatedAt:'2026-10-28'}];
 const makeBuild=(uid:string)=>({id:'qa-'+uid,uid,ign:players.find(p=>p.uid===uid)?.ign,character:'Hiyuki',status:'approved',createdAt:'2026-10-28',identityVerified:true,score:234283.28,data:{assessment:{calculation:{finalStats:{totalHp:16869,totalAtk:2379,totalDef:1172,totalCritRate:.751,totalCritDMG:2.906,energyRegen:1.192},identities:[],conditions:'Standardized benchmark assumptions'}},slots:Array.from({length:5},(_,i)=>({slot:i+1,cost:{value:i===0?'4':'1'},mainStat:{value:i===0?'Crit. DMG':'ATK'},substats:[{value:'Crit. Rate 10.5%'},{value:'Crit. DMG 21%'},{value:'ATK 8.6%'},{value:'HP 9.4%'},{value:'Energy Regen 10%'}]}))}});
 await page.route('**/api/public/players?*',async route=>{const p=new URL(route.request().url()).searchParams;const uid=p.get('uid');await route.fulfill({json:uid?{builds:uid==='800000000'?[]:[makeBuild(uid)],page:1,hasMore:false}:{players:players.filter(player=>!p.get('search')||(player.ign+' '+player.uid).toLowerCase().includes(p.get('search')!.toLowerCase())),hasMore:false}});});
 await page.route('**/api/assets/*',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="192" height="182"><rect width="192" height="182" fill="#233d48"/></svg>'}));
 await page.goto('/profiles');await expect(page.getByRole('heading',{name:'Find a player'})).toBeVisible();
 await page.getByLabel('Player name or UID').fill('812345678');await expect(page.locator('.pp-player')).toHaveCount(1);await page.locator('.pp-player').click();
 await expect(page.locator('.pp-player-header')).toContainText('QA Rover');await page.getByRole('button',{name:'View Hiyuki stats',exact:true}).click();
 await expect(page.locator('.lb-echo')).toHaveCount(5);await expect(page.locator('.lb-stat-chips')).toContainText('16,869');await expect(page.locator('.lb-stat-chips')).toContainText('75.1%');await expect(page.locator('.pp-stats-notice')).toContainText('benchmark assumptions');
 for(const width of [360,768,1280]){await page.setViewportSize({width,height:900});await expect(page.locator('.lb-score')).toBeVisible();await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.screenshot({path:info.outputPath('player-profile.png'),fullPage:true});
 await page.getByRole('button',{name:'Hide Hiyuki stats',exact:true}).click();await expect(page.locator('.lb-echo')).toHaveCount(0);
 await page.getByRole('button',{name:'Find another player'}).click();await page.getByLabel('Player name or UID').fill('Second');await page.locator('.pp-player').filter({hasText:'Second QA'}).click();await expect(page.locator('.pp-player-header')).toContainText('Second QA');
 await expect(page.locator('.pp-tabs>div')).toHaveCount(2);await page.locator('.pp-tabs>div button').filter({hasText:'QA Rover'}).click();await expect(page.locator('.pp-player-header')).toContainText('QA Rover');
 await page.reload();await expect(page.locator('.pp-tabs>div')).toHaveCount(2);await page.getByRole('button',{name:'Close QA Rover profile',exact:true}).click();await expect(page.getByRole('heading',{name:'Find a player'})).toBeVisible();await expect(page.locator('.pp-tabs>div')).toHaveCount(1);
 await page.getByLabel('Player name or UID').fill('no such player');await expect(page.getByRole('heading',{name:'No players found'})).toBeVisible();
 await page.goto('/profiles?uid=800000000');await expect(page.getByRole('heading',{name:'No approved builds for this player'})).toBeVisible();
 await page.unroute('**/api/public/players?*');await page.route('**/api/public/players?*',route=>route.fulfill({status:503,json:{error:'Service unavailable'}}));await page.goto('/profiles');await expect(page.locator('.profiles-page [role=alert]')).toContainText('Service unavailable');
 await page.unroute('**/api/public/players?*');await page.getByRole('button',{name:'Try again'}).click();await expect(page.locator('.profiles-page [role=alert]')).toHaveCount(0);
 expect(errors).toEqual([]);
});
