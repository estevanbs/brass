import { expect, test } from '@playwright/test';

test.describe('home page', () => {
  test('offers offline and online, linking to /offline and /online', async ({ page }) => {
    await page.goto('/');

    const offline = page.getByRole('link', { name: /jogar offline/i });
    const online = page.getByRole('link', { name: /jogar online/i });
    await expect(offline).toBeVisible();
    await expect(online).toBeVisible();
    await expect(offline).toHaveAttribute('href', '/offline');
    await expect(online).toHaveAttribute('href', '/online');
  });

  test('clicking "jogar offline" navigates to /offline', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /jogar offline/i }).click();
    await expect(page).toHaveURL(/\/offline$/);
  });

  test('clicking "jogar online" navigates to /online', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /jogar online/i }).click();
    await expect(page).toHaveURL(/\/online$/);
  });
});
