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

    const boss = dialog.getByRole("combobox", { name: "Choose boss" });
    if (entry === "bracket") {
      await boss.selectOption("Dreamless");
      await expect(action("Choose a Resonator")).toBeDisabled();
      await page.route("**/api/hall-of-fame/admin", async route => {
        if (route.request().method() === "POST" && route.request().postDataJSON().action === "save_match_details") {
          await route.fulfill({ status: 503, json: { error: "Boss save unavailable. Try again." } });
        } else {
          await route.fallback();
        }
      }, { times: 1 });
      await action("Save boss").click();
      await expect(dialog.getByRole("alert")).toHaveText("Boss save unavailable. Try again.");
      await expect(boss).toHaveValue("Dreamless");
      await action("Save boss").click();
    } else {
      await action("Roll from pool").click();
    }
    await expect(dialog.getByText("Saved boss:", { exact: false })).toContainText("Dreamless");
    await expect(action("Choose a Resonator")).toBeEnabled();
    await expect(action("Go live")).toBeDisabled();

    const earlyStart = await mutation({ action: "start_match", matchId: slug+"-1-1" });
    expect(earlyStart.status()).toBe(409);
    expect((await earlyStart.json()).error).toContain("Complete the draft");

    const names = ["Carlotta","Cartethyia","Aemeath","Hiyuki","Chisa","Jingran","Lucy","Lucilla","Rebecca","Denia","Sigrika","Shorekeeper"];
    for (const [index, name] of names.entries()) {
      await action("Choose a Resonator").click();
      await dialog.getByLabel("Search Resonators").fill(name);
      await action(name).click();
      await action("Save draft step").click();
      await expect(dialog.getByRole("heading", { name: `Draft · ${index+1}/12` })).toBeVisible();
      if (index === 0) {
        await page.reload();
        await signIn();
        await page.getByRole("button", { name: "Continue setup", exact: true }).click();
        await expect(dialog.getByRole("heading", { name: "Draft · 1/12" })).toBeVisible();
        await expect(boss).toBeDisabled();
      }
    }
    await action("Go live").click();
    await expect(dialog).toHaveAccessibleName("Live match");
    await dialog.getByText("Rover", { exact: true }).click();
    await expect(dialog.getByRole("radio", { name: "Rover" })).toBeChecked();
    page.once("dialog", confirmation => confirmation.accept());
    await action("Report winner for verification").click();
    await expect(dialog).toHaveAccessibleName("Verify result");

    const readMatches = async () => {
      const response = await request.get(`/api/hall-of-fame/admin?slug=${slug}`, { headers: { Authorization: `Bearer ${token}` } });
      expect(response.ok()).toBeTruthy();
      return (await response.json()).matches;
    };
    expect((await readMatches()).find((match: { id:string }) => match.id === slug+"-2-1").participant_a).toBeNull();
    page.once("dialog", confirmation => confirmation.accept());
    await dialog.getByRole("button", { name: /Verify winner/ }).click();
    await expect(dialog).toHaveCount(0);
    const matches = await readMatches();
    expect(matches.find((match: { id:string }) => match.id === slug+"-1-1").state).toBe("published");
    expect(matches.find((match: { id:string }) => match.id === slug+"-2-1").participant_a).toBe("qa-Rover");
  });
}
