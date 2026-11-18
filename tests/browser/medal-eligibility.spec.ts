import { expect, test } from "@playwright/test";
import { clickAdminNavigation } from "./admin-navigation";

test("owner can exclude a Resonator from medals and restore eligibility", async ({ page, request }) => {
  const endpoint = "/api/admin/medal-eligibility";
  expect((await request.get(endpoint)).status()).toBe(401);
  expect((await request.post(endpoint, { data: { character: "Shorekeeper", eligible: false } })).status()).toBe(401);
  await page.goto("/BlackShores");
  await page.getByLabel("Black Shores access token", { exact: true }).fill("browser-test-only-token-00000000000000000000");
  await page.getByRole("button", { name: "Continue to workspace" }).click();
  await clickAdminNavigation(page, "Medal eligibility");
  const settings = page.getByRole("region", { name: "Resonator medal settings" });
  await expect(settings.getByRole("switch")).toHaveCount(61);
  await settings.getByRole("searchbox", { name: "Find a Resonator" }).fill("Shorekeeper");
  const toggle = settings.getByRole("switch", { name: "Shorekeeper medal eligibility" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(settings.getByText("Shorekeeper no longer counts toward medals.")).toBeVisible();

  await clickAdminNavigation(page, "Rotation management");
  await clickAdminNavigation(page, "Medal eligibility");
  await settings.getByRole("combobox", { name: "Medal eligibility" }).selectOption("excluded");
  await expect(settings.getByRole("switch")).toHaveCount(1);
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveCount(0);
  await settings.getByRole("combobox", { name: "Medal eligibility" }).selectOption("all");
  await expect(toggle).toHaveAttribute("aria-checked", "true");
});

test("Rover has one board per element and public medal eligibility follows the switch", async ({ browser, page, request }) => {
  const endpoint = "/api/admin/medal-eligibility";
  const headers = { Authorization: "Bearer browser-test-only-token-00000000000000000000" };
  async function toggle(eligible: boolean) {
    const response = await request.post(endpoint, { headers, data: { character: "RoverAero", eligible } });
    expect(response.ok()).toBeTruthy();
  }

  await toggle(false);
  try {
    await page.goto("/leaderboards?character=RoverAeroFemale");
    await expect(page).toHaveURL(/character=RoverAero$/);
    const board = page.getByRole("region", { name: "Rover: Aero rankings" });
    await expect(board.getByText("Leaderboard only", { exact: true })).toBeVisible();
    const picker = page.getByRole("region", { name: "Choose a Resonator leaderboard" });
    await picker.getByRole("searchbox", { name: "Search Resonators" }).fill("Rover");
    await expect(picker.locator(".lb-character-option")).toHaveCount(4);
    const aero = picker.getByRole("button", { name: /Rover: Aero/ });
    await expect(aero.getByText("Leaderboard only", { exact: true })).toBeVisible();
    await expect(aero.locator("img")).toHaveAttribute("src", /\/resonators\/Rover\.png$/);
    await expect(picker.getByRole("button", { name: /Rover: Havoc/ }).getByText("Medal eligible", { exact: true })).toBeVisible();

    await toggle(true);
    const freshContext = await browser.newContext(test.info().project.use);
    try {
      const freshPage = await freshContext.newPage();
      await freshPage.goto("/leaderboards?character=RoverAeroMale");
      await expect(freshPage).toHaveURL(/character=RoverAero$/);
      const freshBoard = freshPage.getByRole("region", { name: "Rover: Aero rankings" });
      await expect(freshBoard.getByText("Medal eligible", { exact: true })).toBeVisible();
    } finally {
      await freshContext.close();
    }
  } finally {
    await toggle(true);
  }
});
