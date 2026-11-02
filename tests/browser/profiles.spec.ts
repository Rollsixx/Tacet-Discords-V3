import {test,expect} from '@playwright/test';
test('player search, multi-player tabs, resonator stats, reload and empty/error states',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 const players=[{uid:'812345678',ign:'QA Rover',builds:1,characters:1,updatedAt:'2026-10-28'},{uid:'899999999',ign:'Second QA',builds:1,characters:1,updatedAt:'2026-10-28'}];
 const makeBuild=(uid:string)=>({id:'qa-'+uid,uid,ign:players.find(p=>p.uid===uid)?.ign,character:'Hiyuki',status:'approved',createdAt:'2026-10-28',identityVerified:true,score:234283.28,data:{assessment:{calculation:{finalStats:{totalHp:16869,totalAtk:2379,totalDef:1172,totalCritRate:.751,totalCritDMG:2.906,energyRegen:1.192},identities:[],conditions:'Standardized benchmark assumptions'}},slots:Array.from({length:5},(_,i)=>({slot:i+1,cost:{value:i===0?'4':'1'},mainStat:{value:i===0?'Crit. DMG':'ATK'},substats:[{value:'Crit. Rate 10.5%'},{value:'Crit. DMG 21%'},{value:'ATK 8.6%'},{value:'HP 9.4%'},{value:'Energy Regen 10%'}]}))}});
 await page.route('**/api/public/players?*',async route=>{const p=new URL(route.request().url()).searchParams;const uid=p.get('uid');await route.fulfill({json:uid?{builds:uid==='800000000'?[]:[makeBuild(uid)],page:1,hasMore:false}:{players:players.filter(player=>!p.get('search')||(player.ign+' '+player.uid).toLowerCase().includes(p.get('search')!.toLowerCase())),hasMore:false}});});
 await page.route('**/api/assets/*',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="192" height="182"><rect width="192" height="182" fill="#233d48"/></svg>'}));
 await page.goto('/profiles');await expect(page.getByRole('heading',{name:'Find a player'})).toBeVisible();
 await page.getByLabel('Player name or UID').fill('812345678');await expect(page.locator('.pp-player')).toHaveCount(1);await page.locator('.pp-player').click();
 await expect(page.locator('.pp-player-header')).toContainText('QA Rover');
 const rankHistoryOrder=await page.evaluate(()=>{const builds=document.querySelector('.pp-build-table'),history=document.querySelector('.pp-rank-history'),identity=document.querySelector('#identity-verification-help');return Boolean(builds&&history&&identity&&(builds.compareDocumentPosition(history)&Node.DOCUMENT_POSITION_FOLLOWING)&&(history.compareDocumentPosition(identity)&Node.DOCUMENT_POSITION_FOLLOWING));});
 expect(rankHistoryOrder).toBe(true);await page.locator('.pp-build-table .lb-player-row .lb-player-button').click();
 await expect(page.locator('.profile-build-sprite-card')).toBeVisible();await expect(page.locator('.profile-build-substats-card')).toBeVisible();await expect(page.locator('.profile-build-chain-card')).toBeVisible();await expect(page.locator('.profile-build-skills-card')).toBeVisible();await expect(page.locator('.profile-build-weapon-card')).toBeVisible();await expect(page.locator('.profile-build-cv-card')).toBeVisible();
 await expect(page.locator('.lb-echo')).toHaveCount(5);await expect(page.locator('.profile-build-substats-card')).toContainText('16,869');await expect(page.locator('.profile-build-substats-card')).toContainText('75.1%');await expect(page.locator('.pp-stats-notice')).toContainText('benchmark assumptions');
 for(const width of [360,768,1280]){await page.setViewportSize({width,height:900});await expect(width<=1100?page.locator('.pp-build-table .lb-player-row'):page.locator('.lb-score')).toBeVisible();await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.screenshot({path:info.outputPath('player-profile.png'),fullPage:true});
 await page.locator('.pp-build-table .lb-player-row .lb-player-button').click();await expect(page.locator('.lb-echo')).toHaveCount(0);
 await page.getByRole('button',{name:'Find another player'}).click();await page.getByLabel('Player name or UID').fill('Second');await expect(page.locator('.pp-player')).toHaveCount(1);await page.locator('.pp-player').filter({hasText:'Second QA'}).click();await expect(page).toHaveURL(/uid=899999999/);await expect(page.locator('.pp-player-header')).toContainText('Second QA');
 await expect(page.locator('.pp-tabs>div')).toHaveCount(2);await page.locator('.pp-tabs>div button').filter({hasText:'QA Rover'}).click();await expect(page.locator('.pp-player-header')).toContainText('QA Rover');
 await page.reload();await expect(page.locator('.pp-tabs>div')).toHaveCount(2);await page.getByRole('button',{name:'Close QA Rover profile',exact:true}).click();await expect(page.getByRole('heading',{name:'Find a player'})).toBeVisible();await expect(page.locator('.pp-tabs>div')).toHaveCount(1);
 await page.getByLabel('Player name or UID').fill('no such player');await expect(page.getByRole('heading',{name:'No players found'})).toBeVisible();
 await page.goto('/profiles?uid=800000000');await expect(page.getByRole('heading',{name:'No approved builds for this player'})).toBeVisible();
 await page.unroute('**/api/public/players?*');await page.route('**/api/public/players?*',route=>route.fulfill({status:503,json:{error:'Service unavailable'}}));await page.goto('/profiles');await expect(page.locator('.profiles-page [role=alert]')).toContainText('Service unavailable');
 await page.unroute('**/api/public/players?*');await page.getByRole('button',{name:'Try again'}).click();await expect(page.locator('.profiles-page [role=alert]')).toHaveCount(0);
 expect(errors).toEqual([]);
});

test('Top Players medals remain readable as stacked cards on mobile',async({page},info)=>{
 const players=[
  {uid:'812345678',ign:'Gold Leader',avatarCharacter:'Carlotta',character:'Carlotta',buildId:'gold',gold:3,silver:1,bronze:0,points:11,total:4,rank:1,rankMovement:null,rankSince:null,rankTrackingSince:'2026-10-01',rankDays:3,bestRank:1,bestTop1Days:0,rankHasHistory:false},
  {uid:'899999999',ign:'Silver Player',avatarCharacter:'Hiyuki',character:'Hiyuki',buildId:'silver',gold:1,silver:2,bronze:2,points:9,total:5,rank:2,rankMovement:-1,rankSince:null,rankTrackingSince:'2026-10-01',rankDays:null,bestRank:1,bestTop1Days:6,rankHasHistory:true}
 ];
 await page.route('**/api/public/players?*',route=>route.fulfill({json:{players:[],hasMore:false,topPlayers:players,topPlayersUpdatedAt:'2026-11-01T12:00:00.000Z'}}));
 await page.route('**/api/assets/*',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#233d48"/></svg>'}));
 await page.goto('/profiles');
 await expect(page.getByRole('heading',{name:'Top Players'})).toBeVisible();
 await expect(page.locator('.medal-standings-table tbody tr')).toHaveCount(2);
 await expect(page.locator('.medal-standings-updated')).toContainText('Updated');
 for(const width of [360,768,1280]){
  await page.setViewportSize({width,height:900});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await page.setViewportSize({width:360,height:800});
 await expect.poll(()=>page.locator('.medal-standings-table tbody tr').first().evaluate(row=>getComputedStyle(row).display)).toBe('grid');
 await expect(page.locator('.medal-standings-table tbody tr').first()).toContainText('Gold');
 await page.screenshot({path:info.outputPath('top-players-mobile.png'),fullPage:true});
});
