import { Browser, Page, expect, test } from '@playwright/test';

/** Whichever side's own chip is both `.human` (this browser's seat) and `.active` (this
 * seat's turn right now) is the one that can legally act — `turnOrder` is seed-shuffled
 * server-side, so which of the two seats goes first isn't known ahead of time. */
async function pickActingPage(host: Page, guest: Page): Promise<[acting: Page, watching: Page]> {
  const hostIsActive = await host.locator('.strip-player.human.active').count();
  return hostIsActive > 0 ? [host, guest] : [guest, host];
}

/** Real two-browser-context flow for `/online`: create a room, join it from a second isolated
 * context (Playwright contexts don't share `localStorage`, so this genuinely simulates two
 * different people, not two tabs of the same session), start it, and confirm a move made by
 * one side shows up live on the other — the one thing `GameGateway#watchMoves` exists for,
 * which no unit/integration test can prove end-to-end the way a real second browser can. */
test.describe('online mode', () => {
  test('two players create/join a room, start it, and see each other\'s moves live', async ({ browser }: { browser: Browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();

    try {
      await host.goto('/online');
      const createCard = host.locator('.setup-card').first();
      await createCard.locator('input[type="text"]').fill('Ana');
      await createCard.locator('select').selectOption({ label: '2' });
      await createCard.getByRole('button', { name: 'Criar sala' }).click();

      const code = await host.locator('.room-code strong').innerText({ timeout: 10_000 });
      expect(code).toMatch(/^[A-Z0-9]{6}$/);

      await guest.goto('/online');
      const joinCard = guest.locator('.setup-card').nth(1);
      await joinCard.locator('input[type="text"]').first().fill('Beto');
      await joinCard.locator('input[type="text"]').nth(1).fill(code);
      await joinCard.getByRole('button', { name: 'Entrar' }).click();

      // Both sides see the full seat list once Beto has joined — proving the roomState
      // broadcast reaches the host too, not just the joining socket.
      await expect(host.locator('.room-seats li')).toHaveCount(2, { timeout: 10_000 });
      await expect(guest.locator('.room-seats li')).toHaveCount(2, { timeout: 10_000 });

      await host.getByRole('button', { name: 'Iniciar partida' }).click();
      await expect(host.locator('main.app-main')).toBeVisible({ timeout: 15_000 });
      await expect(guest.locator('main.app-main')).toBeVisible({ timeout: 15_000 });

      // Each side sees its own (non-empty) hand — a redacted view would be an empty hand.
      await expect(host.locator('.hand-card').first()).toBeVisible();
      await expect(guest.locator('.hand-card').first()).toBeVisible();

      const [actingPage, watchingPage] = await pickActingPage(host, guest);

      await actingPage.locator('.hand-card').first().click();
      await actingPage.getByRole('button', { name: 'Passar' }).click();
      await actingPage.locator('.popup-option').first().click();

      // The watching side did nothing at all — this only updates if the move genuinely
      // broadcast live over the shared room connection (GameGateway#watchMoves).
      await expect(watchingPage.locator('.log')).toContainText('Passar', { timeout: 15_000 });
      await expect(actingPage.locator('.log')).toContainText('Passar', { timeout: 15_000 });
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test('joining with an unknown room code shows an error and a way back', async ({ page }) => {
    await page.goto('/online');
    const joinCard = page.locator('.setup-card').nth(1);
    await joinCard.locator('input[type="text"]').first().fill('Ninguém');
    await joinCard.locator('input[type="text"]').nth(1).fill('ZZZZZZ');
    await joinCard.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.locator('.online-error')).toContainText('sala não encontrada', { timeout: 10_000 });
    await page.getByRole('button', { name: 'Voltar' }).click();
    await expect(page.locator('.setup-card')).toHaveCount(2);
  });
});
