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
  await expect(settings.getByRole("switch")).toHaveCount(65);
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
