import { clickAdminNavigation, openAdminMenu } from './admin-navigation';
import { test, expect } from "@playwright/test";
import { existsSync, writeFileSync } from "node:fs";
const fixture = process.env.REFERENCE_CARD_PATH || ".cache/reference-four-slot.jpeg";
test("four pages render without overflow or browser errors", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const route of ["/", "/import", "/profiles", "/leaderboards"]) {
    await page.goto(route);
    await expect(page.locator("h1")).toBeVisible();
    if (route !== "/import") await expect(page.locator(".build-card, .placeholder, .lb-table, .lb-loading, .lb-empty, .pp-player-list, .home-ranking-card, .home-ranking-loading, .home-ranking-empty").first()).toBeVisible();
    if(route === '/leaderboards') {
      await expect(page.locator('.lb-patch-picker')).toHaveCount(3);
      await expect(page.getByRole('button',{name:'Choose a 1.x Resonator'})).toBeVisible();
      await expect(page.getByRole('button',{name:'Choose a 2.x Resonator'})).toBeVisible();
      await expect(page.getByRole('button',{name:'Choose a 3.x Resonator'})).toBeVisible();
      await page.getByRole('button',{name:'Choose a 1.x Resonator'}).click();
      await expect(page.getByRole('listbox',{name:'Choose a 1.x Resonator'})).toBeVisible();
      await expect(page.locator('.popover-listbox-menu .lb-patch-option-avatar').first()).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button',{name:'Choose a 1.x Resonator'})).toHaveAttribute('aria-expanded','false');
      await expect(page.locator('.placeholder,.lb-table').first()).toBeVisible();
    }
    await expect(page.locator('nav[aria-label="Main navigation"] a')).toHaveCount(5);
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.screenshot({ path: testInfo.outputPath(route.slice(1) || "home") + ".png", fullPage: true });
  }
  expect(errors).toEqual([]);
});
const occupiedFields = [
  ["4", "Crit. DMG", "DEF 10%", "ATK 10.9%", "DEF 60", "Crit. DMG 15%", "Crit. Rate 6.3%"],
  ["3", "Electro DMG Bonus", "HP 8.6%", "Crit. DMG 15%", "ATK 7.9%", "Crit. Rate 9.3%", "HP 320"],
  ["1", "ATK", "Crit. Rate 6.3%", "Energy Regen 12.4%", "Crit. DMG 13.8%", "HP 470", "Heavy Attack DMG Bonus 7.9%"],
  ["1", "ATK", "ATK 9.4%", "ATK 40", "Crit. DMG 15%", "HP 7.9%", "Crit. Rate 6.3%"],
];
test("real reference card produces four occupied slots and blocks invented fifth-slot submission", async ({ page }, testInfo) => {
  test.skip(!existsSync(fixture), "Run npm run test:reference or set REFERENCE_CARD_PATH.");
  const external: string[] = [];
  page.on("pageerror", error => console.log("OCR browser error:", error.message));
  page.on("response", response => { if (response.url().includes("/ocr/")) console.log("OCR resource", response.status(), response.url()); });
  page.on("request", request => { if (!request.url().startsWith("http://127.0.0.1:3100") && !/^(blob:|data:)/.test(request.url())) external.push(request.url()); });
  await page.goto("/import");
  await page.getByLabel("Choose build screenshot").setInputFiles(fixture);
  await expect(page.getByRole("heading", { name: "5 Echo slots processed" })).toBeVisible({ timeout: 150000 });
  await expect(page.locator('img[alt^="Extracted Echo portrait"]')).toHaveCount(5);
  await expect(page.locator('img[alt^="Extracted Sonata icon"]')).toHaveCount(5);
  await expect(page.getByRole("heading", { name: "Echo 5 — No equipped Echo detected" })).toBeVisible();
  const costs = ["4", "3", "1", "1"];
  for (let slot = 1; slot <= 4; slot++) await expect(page.getByRole("textbox", { name: `Echo ${slot} cost`, exact: true })).toHaveValue(costs[slot - 1]);
  await expect(page.getByRole("textbox", { name: "Echo 5 cost", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Submit for moderation" })).toBeDisabled();
  const values = await page.locator('input[aria-label^="Echo "],textarea[aria-label^="Echo "]').evaluateAll(inputs => inputs.map(input => ({ label: input.getAttribute("aria-label"), value: (input as HTMLInputElement).value })));
  expect(values.slice(0, 28).map(item => item.value)).toEqual(occupiedFields.flat());
  writeFileSync(testInfo.outputPath("ocr-observation.json"), JSON.stringify(values, null, 2));
  await testInfo.attach("actual-ocr-output", { body: JSON.stringify(values, null, 2), contentType: "application/json" });
  await page.evaluate(() => new Promise<void>(resolve => { window.scrollTo(0, 0); requestAnimationFrame(() => requestAnimationFrame(() => resolve())); }));
  await page.screenshot({ path: testInfo.outputPath("real-card-ocr.png"), fullPage: true });
  expect(external).toEqual([]);
});


test("derived five-slot fixture completes automatic scan, deletion and approval in private admin page", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One submission lifecycle per isolated database.");
  test.skip(!existsSync(fixture), "Real source fixture is required.");
  await page.goto("/import");
  await page.getByLabel("Choose build screenshot").setInputFiles(fixture);
  await expect(page.locator('img[alt="Selected build screenshot"]')).toBeAttached();
  await expect(page.getByRole("heading", { name: "5 Echo slots processed" })).toBeVisible({ timeout: 60000 });
  const evidenceLayout = await page.evaluate(() => {
    const screenshot = document.querySelector(".source-preview")!.getBoundingClientRect();
    const echoes = document.querySelector(".import-results-heading")!.getBoundingClientRect();
    const workspace = document.querySelector(".import-workspace")!.getBoundingClientRect();
    return { screenshotBottom: screenshot.bottom, echoesTop: echoes.top, screenshotWidth: screenshot.width, centerOffset: Math.abs((screenshot.left + screenshot.right) / 2 - (workspace.left + workspace.right) / 2) };
  });
  expect(evidenceLayout.screenshotBottom).toBeLessThanOrEqual(evidenceLayout.echoesTop);
  expect(evidenceLayout.screenshotWidth).toBeGreaterThan(500);
  expect(evidenceLayout.centerOffset).toBeLessThanOrEqual(2);
  // Duplicate slot 4 into slot 5 for workflow coverage only. This is a derived
  // test image, never described as an authentic complete five-Echo game card.
  const dataUrl = await page.locator('img[alt="Selected build screenshot"]').evaluate(image => {
    const source = image as HTMLImageElement;
    const canvas = document.createElement("canvas"); canvas.width = 1920; canvas.height = 1080;
    const context = canvas.getContext("2d")!;
    context.drawImage(source, 0, 0);
    context.drawImage(source, 1144, 650, 374, 430, 1518, 650, 374, 430);
    // This reference has an unreadable UID. Give the derived QA fixture an
    // explicitly synthetic header; never manufacture a UID for a real import.
    context.fillStyle = "#100d18"; context.fillRect(0,0,750,145);
    context.fillStyle = "white"; context.font = "54px sans-serif"; context.fillText("Hsin",65,70);
    context.font = "20px sans-serif"; context.fillText("Player ID:Browser QA",20,100); context.fillText("UID:812341441",20,130);
    return canvas.toDataURL("image/png");
  });
  await page.getByLabel("Choose build screenshot").setInputFiles({ name: "derived-five-slot.png", mimeType: "image/png", buffer: Buffer.from(dataUrl.split(",")[1], "base64") });
  await expect(page.getByRole("heading", { name: "5 Echo slots processed" })).toBeVisible({ timeout: 60000 });
  const fields = [...occupiedFields, occupiedFields[3]];
  for (let index = 0; index < 5; index++) {
    const [cost, main, ...stats] = fields[index];
    await expect(page.getByRole("textbox", { name: `Echo ${index + 1} cost`, exact: true })).toHaveValue(cost);
    await expect(page.getByRole("textbox", { name: `Echo ${index + 1} main stat`, exact: true })).toHaveValue(main);
    for (let stat = 0; stat < 5; stat++) await expect(page.getByRole("textbox", { name: `Echo ${index + 1} substat ${stat + 1}`, exact: true })).toHaveValue(stats[stat]);
  }
  const uid = await page.getByLabel("Wuthering Waves UID", { exact: true }).inputValue();
  expect(uid).toMatch(/^[0-9]{8,12}$/);
  await expect(page.getByLabel("Wuthering Waves UID", { exact: true })).not.toBeEditable();
  await page.getByLabel("In-game name", { exact: true }).fill("Browser Test Rover");
  await page.getByRole("checkbox").check();
  const save = page.waitForResponse(response => response.url().endsWith("/api/submissions") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Submit for moderation" }).click();
  const response = await save; expect(response.status()).toBe(201);
  let saved = await response.json();
  const submittedBody = response.request().postDataJSON();
  await expect(page.getByText("Build saved · Pending moderation")).toBeVisible();
  await expect(page.getByLabel("In-game name", {exact:true})).toHaveCount(0);
  await expect(page.getByRole("button", {name:"Copy submission ID",exact:true})).toBeVisible();
  for(const field of await page.locator(".echo-fields input,.echo-fields textarea").all()) await expect(field).not.toBeEditable();
  await page.getByLabel("Submission confirmation").screenshot({path:testInfo.outputPath("saved-build-receipt.png")});
  expect((await (await request.get("/api/public/builds?search=" + uid)).json()).builds).toHaveLength(0);
  let failedCrop=false;
  await page.route('**/api/assets/*-1-portrait',async route=>{
    if(!failedCrop){failedCrop=true;await route.fulfill({status:503,body:'Temporary image failure'});}else await route.continue();
  });
  await page.goto("/BlackShores");
  await page.getByLabel("Black Shores access token", { exact: true }).fill("browser-test-only-token-00000000000000000000");
  await page.getByRole("button", { name: "Continue to workspace" }).click();
  await expect(page.getByRole('button',{name:'Retry image',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Retry image',exact:true}).click();
  await expect(page.locator(".moderation-panel .echo-crop")).toHaveCount(5);
  await expect.poll(() => page.locator(".moderation-panel .echo-crop").evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth === 192))).toBe(true);
  await page.getByLabel("Reviewer name (audit trail)").clear();
  await expect(page.getByRole('button',{name:'Approve as unranked Hsin',exact:true})).toBeDisabled();
  await page.getByLabel('I understand this build cannot rank.',{exact:false}).check();
  await page.getByLabel('Review note',{exact:true}).fill('Publish this unsupported fixture as unranked.');
  await expect(page.getByRole('button',{name:'Approve as unranked Hsin',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Approve as unranked Hsin',exact:true}).click();
  await expect(page.locator('.bs-error')).toContainText('Enter a reviewer name');
  await page.getByLabel("Reviewer name (audit trail)").fill("Browser QA");
  await page.evaluate(()=>new Promise<void>(resolve=>{document.documentElement.style.scrollBehavior="auto";window.scrollTo(0,0);requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()));}));
  await page.screenshot({path:testInfo.outputPath('admin-submission-review.png'),fullPage:true});
  await page.getByLabel("Review note", { exact: true }).fill("Inspected derived workflow fixture");
  await page.getByRole("button", { name: /^Reject & delete / }).click();
  await page.getByRole("button", { name: "Confirm rejection & delete", exact: true }).click();
  await expect(page.getByText("No pending submissions.", { exact: true })).toBeVisible();
  expect((await request.get('/api/assets/'+saved.id+'-1-portrait')).status()).toBe(404);
  const resubmitted = await request.post('/api/submissions',{data:submittedBody});
  expect(resubmitted.status()).toBe(201); saved = await resubmitted.json();
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.getByLabel('I understand this build cannot rank.',{exact:false}).check();await page.getByLabel('Review note',{exact:true}).fill('Explicit unranked workflow publication.');
  await page.getByRole("button", { name: /^Approve as unranked / }).click();
  await expect(page.getByText("No pending submissions.", { exact: true })).toBeVisible();
  await page.goto("/profiles");
  await expect(page.getByText("Moderator access", {exact:true})).toHaveCount(0);
  await page.getByLabel("Player name or UID").fill(uid);
  await page.locator('.pp-player').filter({hasText:uid}).click();
  await expect(page.locator('.pp-player-header')).toContainText(uid);
  await page.getByRole('button',{name:'View Hsin stats',exact:true}).click();
  await expect(page.locator('.lb-echo')).toHaveCount(5);
  const approved = await (await request.get("/api/public/builds?id=" + saved.id)).json();
  expect(approved.builds[0].status).toBe("approved"); expect(approved.builds[0].score).toBeNull();
  await page.goto('/BlackShores');
  await page.getByLabel('Black Shores access token',{exact:true}).fill('  browser-test-only-token-00000000000000000000  ');
  await page.getByRole('button',{name:'Continue to workspace',exact:true}).click();
  await clickAdminNavigation(page,'Players & builds');
  await page.getByLabel('Find UID or IGN',{exact:true}).fill(saved.id);
  await page.getByRole('button',{name:'Apply filters',exact:true}).click();
  await expect(page.getByRole('button',{name:'Delete Hsin',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Delete Hsin',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  expect((await(await request.get('/api/public/builds?id='+saved.id)).json()).builds).toHaveLength(1);
  await page.getByRole('button',{name:'Delete Hsin',exact:true}).click();
  await page.getByRole('button',{name:'Confirm permanent deletion',exact:true}).click();
  await expect(page.getByText('Deleted Hsin and its stored evidence.',{exact:false})).toBeVisible();
  expect((await(await request.get('/api/public/builds?id='+saved.id)).json()).builds).toHaveLength(0);
  expect((await request.get('/api/assets/'+saved.id+'-1-portrait')).status()).toBe(404);
  expect((await request.delete('/api/moderation',{data:{id:saved.id,confirm:true,reviewer:'QA',note:''}})).status()).toBe(401);
  await clickAdminNavigation(page,'Audit history');
  await page.getByLabel('Search audit history',{exact:true}).fill(saved.id);
  await page.getByRole('button',{name:'Search history',exact:true}).click();
  await expect(page.locator('.bs-activity strong').filter({hasText:'deleted'})).toHaveCount(1);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('admin-audit-history.png'),fullPage:true});
  await clickAdminNavigation(page,'System status');
  await expect(page.getByRole('heading',{name:'Service health',exact:true})).toBeVisible();
  await expect(page.locator('.bs-system')).toContainText('Ready');
  await expect(page.locator('.bs-system')).toContainText('Hiyuki');

  await page.goto('/profiles');

  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => new Promise<void>(resolve => { window.scrollTo(0, 0); requestAnimationFrame(() => requestAnimationFrame(() => resolve())); }));
  await page.screenshot({ path: testInfo.outputPath("approved-build.png"), fullPage: true });
});

test('Black Shores gates the queue, stays off Profiles, and clears access on reload', async ({page,request}, info) => {
 await page.goto('/profiles');
 await expect(page.getByText('Moderator access',{exact:true})).toHaveCount(0);
 await expect(page.getByLabel('Black Shores access token',{exact:true})).toHaveCount(0);
 expect((await request.get('/api/moderation')).status()).toBe(401);
 await page.goto('/BlackShores');
 await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex/);
 await expect(page.getByLabel('Review queue',{exact:true})).toHaveCount(0);
 await page.getByLabel('Black Shores access token',{exact:true}).fill('incorrect-token-00000000000000000000');
 await page.getByRole('button',{name:'Continue to workspace',exact:true}).click();
 await expect(page.locator('.moderation-panel [role=alert]')).toContainText('authorization required');
 await expect(page.getByLabel('Review queue',{exact:true})).toHaveCount(0);
 await page.getByLabel('Black Shores access token',{exact:true}).fill('browser-test-only-token-00000000000000000000');
 await page.getByRole('button',{name:'Continue to workspace',exact:true}).click();
 await expect(page.getByLabel('Review queue',{exact:true})).toBeVisible();
 await page.screenshot({path:info.outputPath('black-shores-review-desk.png'),fullPage:true});
 await openAdminMenu(page);await page.getByRole('link',{name:'View public website',exact:false}).click();
 await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible();
 await expect(page.getByRole('heading',{name:'See where your build stands.'})).toBeVisible();
 await page.goto('/BlackShores');
 await page.getByLabel('Black Shores access token',{exact:true}).fill('browser-test-only-token-00000000000000000000');
 await page.getByRole('button',{name:'Continue to workspace',exact:true}).click();
 await expect(page.getByLabel('Review queue',{exact:true})).toBeVisible();
 await page.reload();
 await expect(page.getByLabel('Black Shores access token',{exact:true})).toHaveValue('');
 await expect(page.getByLabel('Review queue',{exact:true})).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
