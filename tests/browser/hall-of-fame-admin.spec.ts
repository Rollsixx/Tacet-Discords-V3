import { expect, test } from "@playwright/test";

for (const entry of ["bracket", "queue"] as const) {
  test(`opens Hall of Fame match setup from the ${entry}`, async ({ page }) => {
    const slug = "qa-tournament";
    const matchId = "qa-match";
    let settingUp = false;
    const requests: unknown[] = [];

    await page.route("**/api/hall-of-fame/admin**", async route => {
      const request = route.request();
      if (request.method() === "POST") {
        requests.push(request.postDataJSON());
        settingUp = true;
        await route.fulfill({ json: { ok: true, phaseState: "setting_up" } });
        return;
      }
      const params = new URL(request.url()).searchParams;
      await route.fulfill({
        json: {
          actor: { role: "owner", label: "QA organizer" },
          events: [{ slug, title: "QA Tournament", status: "bracket_revealed", boss: "Dreamless", format: "single_elimination" }],
          participants: [], bossPool: [{ name: "Dreamless", icon_url: "" }],
          matchFoundationEnabled: true, matchFlowEnabled: true, phase3SafetyEnabled: true,
          draftSteps: [],
          matches: params.get("slug") === slug ? [{
            id: matchId, round_number: 1, round_label: "Round 1", match_order: 1,
            bracket_position: 1, bracket_side: "main", version: settingUp ? 2 : 1,
            state: settingUp ? "in_progress" : "ready", phase_state: settingUp ? "setting_up" : "ready",
            participant_a: "a", participant_b: "b", name_a: "Rover", name_b: "Yangyang", winner_id: null,
          }] : [],
        },
      });
    });

    await page.goto("/BlackShores/hall-of-fame");
    await page.getByLabel("Black Shores access token").fill("browser-test-only-token-00000000000000000000");
    await page.getByRole("button", { name: "Open tournament", exact: true }).click();
    if (entry === "queue") {
      await page.getByRole("button", { name: "Open match queue", exact: true }).click();
    } else {
      await page.getByRole("button", { name: /report winner: round 1, match 1/i }).click();
    }
    await page.getByRole("button", { name: "Start match setup", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Start match · boss and draft" })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Draft stepper · 0/12" })).toBeVisible();
    expect(requests).toEqual([{ action: "begin_match_setup", matchId }]);

    if (entry === "queue") {
      await dialog.getByRole("button", { name: "Close match details" }).click();
      await page.getByRole("button", { name: "Open live controls", exact: true }).click();
      await expect(dialog.getByRole("heading", { name: "Start match · boss and draft" })).toBeVisible();
      expect(requests).toHaveLength(1);
    }
  });
}
