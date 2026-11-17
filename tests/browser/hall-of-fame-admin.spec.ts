import { expect, test } from "@playwright/test";

const token = "browser-test-only-token-00000000000000000000";

for (const entry of ["bracket", "queue"] as const) {
  test(`runs and verifies a Hall of Fame match from the ${entry}`, async ({ page, request }, info) => {
    const slug = `qa-${info.project.name}-${entry}`;
    const signIn = async () => {
      await page.getByLabel("Black Shores access token").fill(token);
      await page.getByRole("combobox", { name: "Selected tournament" }).selectOption(slug);
      await page.getByRole("button", { name: "Tournaments", exact: true }).click();
    };
    const dialog = page.getByRole("dialog");
    const action = (name: string) => dialog.getByRole("button", { name, exact: true });

    await page.goto("/BlackShores/hall-of-fame");
    await signIn();
    if (entry === "bracket") {
      await page.getByRole("button", { name: "Match details: Round 1, match 1" }).click();
      await action("Start match setup").click();
    } else {
      await page.getByRole("region", { name: "Match queue" }).getByRole("article").filter({ hasText: "Rover" })
        .getByRole("button", { name: "Start match setup" }).click();
    }
    await expect(dialog).toHaveAccessibleName("Match setup");
    await expect(page.getByText(/Queued while Round 1 · Match 1 is active/).first()).toBeVisible();
    await expect(action("Go live")).toBeDisabled();

    const mutation = (data: Record<string,string>) => request.post("/api/hall-of-fame/admin", {
      headers: { Authorization: `Bearer ${token}` }, data,
    });
    const blocked = await mutation({ action: "begin_match_setup", matchId: slug+"-1-2" });
    expect(blocked.status()).toBe(409);
    expect((await mutation({ action: "start_match", matchId: slug+"-1-1" })).status()).toBe(409);

    const stepCount = entry==="queue"?14:12;
    const boss = action("Choose boss");
    const firstSlot = action("Rover ban 1");
    const width = (await dialog.boundingBox())!.width;
    const viewport = page.viewportSize()!.width;
    expect(width).toBeLessThanOrEqual(viewport);
    if (info.project.name === "desktop") expect(width).toBeGreaterThan(900);
    let expectedBoss = "Dreamless";
    if (entry === "bracket") {
      await boss.click();
      const dreamless = action("Dreamless");
      await expect(dreamless.locator("img")).toBeVisible();
      await dreamless.click();
      await expect(firstSlot).toBeDisabled();
      await page.route("**/api/hall-of-fame/admin", async route => {
        if (route.request().method() === "POST" && route.request().postDataJSON().action === "save_match_details") {
          await route.fulfill({ status: 503, json: { error: "Boss save unavailable. Try again." } });
        } else {
          await route.fallback();
        }
      }, { times: 1 });
      await action("Save boss").click();
      await expect(dialog.getByRole("alert")).toHaveText("Boss save unavailable. Try again.");
      await expect(dreamless).toHaveAttribute("aria-pressed", "true");
      await action("Save boss").click();
    } else {
      if (info.project.name === "mobile") await page.emulateMedia({ reducedMotion: "reduce" });
      await action("Roll from pool").click();
      if (info.project.name === "desktop") await expect(dialog.locator(".hof-reel-track.is-spinning")).toBeVisible();
      const rolled = dialog.getByText(/^Pool roll selected (Dreamless|Hecate)$/);
      await expect(rolled).toBeVisible();
      expectedBoss = (await rolled.innerText()).replace("Pool roll selected ", "");
      await expect(dialog.locator(".hof-reel-item")).toHaveText(expectedBoss);
      const saved = await request.get(`/api/hall-of-fame/admin?slug=${slug}`, { headers: { Authorization: `Bearer ${token}` } });
      expect((await saved.json()).matches.find((match: {id:string})=>match.id===slug+"-1-1").match_boss).toBe(expectedBoss);
    }
    await expect(dialog.locator(".hof-saved-boss")).toContainText(expectedBoss);
    await expect(firstSlot).toBeEnabled();
    await expect(dialog.getByRole("button", { name: /Rover pick [1-3]/ })).toHaveCount(3);
    await expect(action("Go live")).toBeDisabled();

    const earlyStart = await mutation({ action: "start_match", matchId: slug+"-1-1" });
    expect(earlyStart.status()).toBe(409);
    expect((await earlyStart.json()).error).toContain("Complete the draft");

    const names = ["Carlotta","Cartethyia","Aemeath","Hiyuki","Chisa","Jingran","Lucy","Lucilla","Rebecca","Denia","Sigrika","Shorekeeper"];
    if(stepCount===14){
      names.push("Brant","Jiyan");
      await expect(action("Rover ban 4")).toBeVisible();
    }
    await firstSlot.click();
    await expect(dialog.getByLabel("Search Resonators")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(firstSlot).toBeFocused();
    await expect(dialog).toBeVisible();
    for (const [index, name] of names.entries()) {
      await dialog.locator('.hof-draft-slot[data-current="true"]').click();
      await dialog.getByLabel("Search Resonators").fill(name);
      await expect(action(name).locator("img")).toBeVisible();
      await action(name).click();
      await action("Save draft step").click();
      await expect(dialog.getByRole("heading", { name: `Draft · ${index+1}/${stepCount}` })).toBeVisible();
      if (index === 0) {
        await page.reload();
        await signIn();
        await page.getByRole("button", { name: "Continue setup", exact: true }).click();
        await expect(dialog.getByRole("heading", { name: `Draft · 1/${stepCount}` })).toBeVisible();
        await expect(boss).toBeDisabled();
        await expect(action("Rover ban 1: Carlotta").locator("img")).toBeVisible();
      }
    }
    await action("Go live").click();
    await expect(dialog).toHaveAccessibleName("Live match");
    await dialog.getByRole("group", { name: "Select the winning entrant" }).getByText("Rover", { exact: true }).click();
    await expect(dialog.getByRole("radio", { name: "Rover" })).toBeChecked();
    page.once("dialog", confirmation => confirmation.accept());
    await action("Report winner for verification").click();
    await expect(dialog).toHaveAccessibleName("Verify result");

    const readMatches = async () => {
      const response = await request.get(`/api/hall-of-fame/admin?slug=${slug}`, { headers: { Authorization: `Bearer ${token}` } });
      expect(response.ok()).toBeTruthy();
      return (await response.json()).matches;
    };
    const reported = dialog.getByRole("region", { name: "Reported result" });
    await expect(reported).toContainText("Rover");
    await expect(reported).toContainText("Yangyang");
    await expect(reported.locator('[data-winner="true"]')).toContainText("Rover");
    const advancement = dialog.getByRole("region", { name: "Bracket advancement" });
    await expect(advancement.getByText("Final · Match 1 · Player A slot")).toBeVisible();
    if(entry==="queue") await expect(advancement.getByText("Third-place match · Match 1 · Player B slot")).toBeVisible();
    await expect(page.locator(`#hof-bracket-match-${slug}-1-1 .tb-state`)).toHaveText("Awaiting verification");

    await action("Verify result").click();
    await expect(action("Cancel")).toBeFocused();
    await action("Cancel").click();
    await expect(action("Verify result")).toBeFocused();
    expect((await readMatches()).find((match: { id:string }) => match.id === slug+"-2-1").participant_a).toBeNull();
    const stale = await mutation({ action: "publish_match_result", matchId: slug+"-1-1", version: "0" });
    expect(stale.status()).toBe(409);
    expect((await stale.json()).error).toContain("reported result changed");

    await action("Verify result").click();
    await action("Confirm result").click();
    await expect(dialog).toHaveCount(0);
    const matches = await readMatches();
    if(entry==="queue")expect(matches.find((match: { id:string }) => match.id === slug+"-third").participant_b).toBe("qa-Yangyang");
    expect(matches.find((match: { id:string }) => match.id === slug+"-1-1").state).toBe("published");
    expect(matches.find((match: { id:string }) => match.id === slug+"-2-1").participant_a).toBe("qa-Rover");
  });
}
