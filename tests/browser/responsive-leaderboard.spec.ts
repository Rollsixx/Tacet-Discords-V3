import { test, expect } from "@playwright/test";

const buildId = "e0000000-0000-4000-8000-000000000001";
const detailsFixture = {
  builds: [{
    id: buildId,
    uid: "900000001",
    ign: "Responsive QA",
    character: "Carlotta",
    avatarCharacter: "Carlotta",
    rank: 1,
    rankSince: "2026-11-01T00:00:00.000Z",
    rankTrackingSince: "2026-11-01T00:00:00.000Z",
    rankDays: 0,
    rankMovement: "retained",
    rankHasHistory: true,
    score: 123456.78,
    createdAt: "2026-11-01T00:00:00.000Z",
    data: {
      slots: [4, 3, 3, 1, 1].map((cost, index) => ({
        slot: index + 1,
        cost: { value: cost },
        mainStat: { value: index === 0 ? "Crit. DMG" : "ATK" },
        substats: ["Crit. Rate 6.3%", "Crit. DMG 12.6%", "ATK 7.1%", "Energy Regen 6.8%", "DEF 50"].map(value => ({ value })),
      })),
      assessment: {
        calculation: {
          displayStats: { totalCritRate: 75, totalCritDMG: 290.6, totalHp: 16869, totalAtk: 2309, totalDef: 1172, energyRegen: 119.2 },
          finalStats: {},
          identities: Array.from({ length: 5 }, () => ({ set: "Frosty Resolve", echo: "Echo" })),
        },
      },
    },
  }],
  hasMore: false,
  rotationReady: true,
};

test("leaderboard expansion stays readable at 360px, 768px, and 1280px and recovers from load failure", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "This test changes the viewport explicitly.");

  let attempts = 0;
  await page.route("**/api/public/leaderboards**", async route => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Temporary leaderboard error." }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(detailsFixture) });
  });
  await page.route("**/api/assets/**", route => route.fulfill({ status: 404, body: "Not found." }));

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/leaderboards?character=Carlotta");
  await expect(page.locator(".lb-board .placeholder[role='alert']")).toContainText("Temporary leaderboard error.");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".lb-mobile-rank-card")).toHaveCount(1);
  await expect(page.locator(".lb-mobile-rankings")).toBeVisible();
  await expect(page.locator(".lb-table-wrap")).toBeHidden();

  const expand = page.getByRole("button", { name: "View Responsive QA Echoes", exact: true });
  await expand.click();
  await expect(page.getByRole("button", { name: "Hide Responsive QA Echoes", exact: true })).toHaveAttribute("aria-expanded", "true");
  const mobileDetail = page.locator(".lb-mobile-rank-card .lb-expanded");
  await expect(mobileDetail).toBeVisible();
  await expect(mobileDetail.locator(".profile-build-card, .profile-build-hero")).toHaveCount(0);
  await expect(mobileDetail.locator(".lb-expanded-heading")).toBeVisible();
  await expect(mobileDetail.locator(".lb-echo")).toHaveCount(5);
  await expect(mobileDetail.locator(".lb-stat-chips")).toBeVisible();

  for (const width of [360, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator(".lb-mobile-rankings")).toBeVisible();
    await expect(page.locator(".lb-table-wrap")).toBeHidden();
    await expect(mobileDetail).toBeVisible();
    const bounds = await mobileDetail.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width, echoWidth: element.querySelector(".lb-echoes")!.scrollWidth, echoClientWidth: element.querySelector(".lb-echoes")!.clientWidth };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(width + 1);
    expect(bounds.width).toBeGreaterThan(240);
    expect(bounds.echoWidth).toBeLessThanOrEqual(bounds.echoClientWidth);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`leaderboard-expanded-${width}.png`), fullPage: true });
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator(".lb-table-wrap")).toBeVisible();
  await expect(page.locator(".lb-mobile-rankings")).toBeHidden();
  const desktopToggle = page.locator(".lb-table-wrap .lb-player-button");
  await desktopToggle.click();
  await expect(desktopToggle).toHaveAttribute("aria-expanded", "false");
  await desktopToggle.click();
  await expect(desktopToggle).toHaveAttribute("aria-expanded", "true");
  const desktopDetail = page.locator(".lb-detail-content .lb-expanded");
  await expect(desktopDetail).toBeVisible();
  await expect(desktopDetail.locator(".profile-build-card, .profile-build-hero")).toHaveCount(0);
  await expect(desktopDetail.locator(".lb-expanded-heading")).toBeVisible();
  await expect(desktopDetail.locator(".lb-echo")).toHaveCount(5);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
