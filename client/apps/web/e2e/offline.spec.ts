import { expect, test } from '@playwright/test';

/** Real browser flow for `/offline`: the engine runs inside a Web Worker
 * (`InProcessGameGateway` → `game.worker.ts`), so this is the one thing no unit/integration
 * test can prove — that the worker actually exists as a real browser Worker, round-trips a
 * move, and (crucially) never blocks the main thread while the bot searches. */
test.describe('offline mode', () => {
  test('starts a game, submits a move, and the log reflects it', async ({ page }) => {
    await page.goto('/offline');

    await expect(page.locator('h1')).toContainText('Brass: Birmingham');
    await page.getByRole('button', { name: 'Novo jogo' }).click();

    // The board only renders once the worker has replied with the first view.
    await expect(page.locator('main.app-main')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.strip-player.human')).toBeVisible();

    await page.locator('.hand-card').first().click();
    await page.getByRole('button', { name: 'Passar' }).click();
    await page.locator('.popup-option').first().click();

    await expect(page.locator('.log')).toContainText('Passar', { timeout: 15_000 });
  });

  test('the UI stays responsive while a bot move resolves inside the Worker', async ({ page }) => {
    await page.goto('/offline');
    await page.getByRole('button', { name: 'Novo jogo' }).click();
    await expect(page.locator('main.app-main')).toBeVisible({ timeout: 15_000 });

    await page.locator('.hand-card').first().click();
    await page.getByRole('button', { name: 'Passar' }).click();
    await page.locator('.popup-option').first().click();

    // Submitted — the ISMCTS bot's search (up to ~1s, synchronous, inside the worker) may
    // still be running right now. If it ran on the main thread instead of a Worker, this
    // click — completely unrelated to the game — would stall until the search finished.
    const logToggle = page.getByRole('button', { name: /registro/ });
    await logToggle.click();
    await expect(page.locator('.log')).toBeHidden({ timeout: 400 });
    await logToggle.click();
    await expect(page.locator('.log')).toBeVisible({ timeout: 400 });
  });
});
