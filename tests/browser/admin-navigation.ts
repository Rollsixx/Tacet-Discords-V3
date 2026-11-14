import type { Page } from '@playwright/test';

export async function openAdminMenu(page: Page) {
  await page.locator('.bs-shell').waitFor({ state: 'visible' });
  if ((page.viewportSize()?.width ?? 1280) > 900) return;
  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  await menu.waitFor({ state: 'visible' });
  if (await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
}

export async function clickAdminNavigation(page: Page, name: string | RegExp) {
  const button = page.getByRole('button', { name, exact: typeof name === 'string' });
  if ((page.viewportSize()?.width ?? 1280) <= 900 && !(await button.isVisible())) await openAdminMenu(page);
  await button.click();
}
