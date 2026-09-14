import { expect, test, type Page } from '@playwright/test';

/**
 * Real mobile-viewport coverage (see `playwright.config.mts`'s `mobile-chromium` project,
 * which runs only this file against `devices['Pixel 7']` — touch input, device pixel ratio,
 * the whole emulation, not just a resized desktop window).
 *
 * The board (1080x640, a wide map) reads best in landscape on a phone — the same orientation
 * you'd turn a physical box to play it on a table — so the actual-gameplay tests below use a
 * landscape viewport. The layout/overflow checks run in the device's default portrait
 * orientation too, since arriving at "/" and the pre-game screens should never be broken there
 * even before anyone rotates their phone.
 */

const MIN_TOUCH_TARGET_PX = 44;
// Found by measuring a real landscape phone viewport (Pixel 7 sideways, 915x412): before the
// height-based layout fixes, the header/top-strip/hand-dock alone ate 369 of those 412px,
// leaving the board a 43px sliver. 120px is comfortably above that broken state and still well
// under what any of the tested viewports actually provide once the fix is in place.
const MIN_STAGE_HEIGHT_PX = 120;

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'page scrolls horizontally on this viewport').toBeLessThanOrEqual(1);
}

/** Turns the device's own default (portrait) viewport on its side — this is how the game is
 * actually meant to be played on a phone, given the board's own wide (1080x640) aspect ratio. */
async function useLandscape(page: Page): Promise<void> {
  const portrait = page.viewportSize();
  if (portrait !== null) await page.setViewportSize({ width: portrait.height, height: portrait.width });
}

/** "Novo jogo" doesn't pin a seed, so turn order is random each run — when a bot goes first,
 * the board keeps changing underneath a test as the bot's move(s) resolve, which is exactly
 * the kind of thing that makes a hand-card/map interaction flaky (an element it depends on can
 * be re-rendered mid-interaction). Waiting for the human's own turn first removes that race. */
async function waitForHumanTurn(page: Page): Promise<void> {
  await expect(page.locator('.strip-player.human.active')).toBeVisible({ timeout: 20_000 });
}

test.describe('mobile layout', () => {
  test('home page: no horizontal overflow, and both mode links meet the minimum touch-target size', async ({ page }) => {
    await page.goto('/');
    await expectNoHorizontalOverflow(page);

    for (const name of [/jogar offline/i, /jogar online/i]) {
      const box = await page.getByRole('link', { name }).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
      expect(box!.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
    }
  });

  test('offline setup screen: no horizontal overflow, and "Novo jogo" plus the player-count select meet the minimum touch-target size', async ({
    page,
  }) => {
    await page.goto('/offline');
    await expectNoHorizontalOverflow(page);

    const newGameBox = await page.getByRole('button', { name: 'Novo jogo' }).boundingBox();
    expect(newGameBox!.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);

    const playerSelectBox = await page.locator('select').first().boundingBox();
    expect(playerSelectBox!.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
  });

  test('landscape offline game: the board gets real screen space, stays on-screen, and the action buttons meet the minimum touch-target size', async ({
    page,
  }) => {
    await useLandscape(page);

    await page.goto('/offline');
    await page.getByRole('button', { name: 'Novo jogo' }).tap();
    await expect(page.locator('main.app-main')).toBeVisible({ timeout: 15_000 });
    await waitForHumanTurn(page);
    await expectNoHorizontalOverflow(page);

    // `.stage` (the board's own container) used to be squeezed down to a ~43px sliver on a
    // short landscape phone by the fixed-height header/top-strip/hand-dock around it — a real
    // bug this test pins directly, rather than only checking the symptom (that the map doesn't
    // overflow, which a tiny map would also satisfy).
    const stageBox = await page.locator('.stage').boundingBox();
    expect(stageBox).not.toBeNull();
    expect(stageBox!.height).toBeGreaterThanOrEqual(MIN_STAGE_HEIGHT_PX);

    // The board itself must actually fit — not just avoid triggering page scroll — since a map
    // wider than its container would just render clipped/unusable instead of scrollable.
    const mapBox = await page.locator('svg.map-svg').boundingBox();
    const viewport = page.viewportSize();
    expect(mapBox).not.toBeNull();
    expect(mapBox!.width).toBeLessThanOrEqual(viewport!.width + 1);

    await page.locator('.hand-card').first().tap();
    const passarBox = await page.getByRole('button', { name: 'Passar' }).boundingBox();
    expect(passarBox!.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);

    const logToggleBox = await page.getByRole('button', { name: /registro/ }).boundingBox();
    expect(logToggleBox!.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
  });

  test('a full move (select card, choose an action, confirm) works end-to-end using real touch taps, in landscape', async ({ page }) => {
    await useLandscape(page);

    await page.goto('/offline');
    await page.getByRole('button', { name: 'Novo jogo' }).tap();
    await expect(page.locator('main.app-main')).toBeVisible({ timeout: 15_000 });
    await waitForHumanTurn(page);

    await page.locator('.hand-card').first().tap();
    await page.getByRole('button', { name: 'Passar' }).tap();

    const popupOption = page.locator('.popup-option').first();
    await expect(popupOption).toBeVisible();
    const popupBox = await popupOption.boundingBox();
    // The confirmation popup is anchored near wherever was tapped — on a narrow viewport this
    // is exactly the kind of element that used to run off the right edge of the screen.
    const viewport = page.viewportSize();
    expect(popupBox!.x + popupBox!.width).toBeLessThanOrEqual(viewport!.width + 1);

    await popupOption.tap();
    await expect(page.locator('.log')).toContainText('Passar', { timeout: 15_000 });
  });

  test('tapping just outside the drawn node circle — but inside the enlarged invisible hit-area around it — still opens the confirm popup', async ({
    page,
  }) => {
    await useLandscape(page);

    await page.goto('/offline');
    await page.getByRole('button', { name: 'Novo jogo' }).tap();
    await expect(page.locator('main.app-main')).toBeVisible({ timeout: 15_000 });
    await waitForHumanTurn(page);

    // The player-boards panel is open by default and, like on desktop, deliberately overlays
    // the map — a real player would close it to see an obstructed node, same as here.
    await page.getByRole('button', { name: /tabuleiros/ }).tap();
    await expect(page.locator('.mat-panel')).toBeHidden();

    // Select whichever hand card first unlocks at least one clickable map node (a location card
    // guarantees this; an industry card might not, depending on the deal).
    const cards = page.locator('.hand-card');
    const count = await cards.count();
    let found = false;
    for (let i = 0; i < count; i++) {
      await cards.nth(i).tap();
      if ((await page.locator('.node-hit-target').count()) > 0) {
        found = true;
        break;
      }
    }
    expect(found, 'no hand card unlocked any clickable map node — nothing to tap').toBe(true);

    // Radii of both circles, read in one atomic in-page call (avoids a re-render landing
    // between two separate `boundingBox()` round-trips), scoped to the same node group.
    const radii = await page.evaluate(() => {
      const node = document.querySelector('g.map-target-node');
      const drawn = node?.querySelector('.node-fill')?.getBoundingClientRect();
      const hit = node?.querySelector('.node-hit-target')?.getBoundingClientRect();
      if (drawn === undefined || hit === undefined) return null;
      return { drawnRadius: drawn.width / 2, hitRadius: hit.width / 2 };
    });
    expect(radii).not.toBeNull();
    const { drawnRadius, hitRadius } = radii!;
    expect(hitRadius).toBeGreaterThan(drawnRadius);

    // Click at an offset from the hit-target circle's own center — strictly between the two
    // radii, so outside the small drawn circle but inside the enlarged invisible one — via
    // Playwright's element-relative `position`, not a raw page coordinate. A raw
    // `page.mouse.click` at the equivalent page coordinate landed right on the neighboring
    // `.pulse-ring`'s animated (continuously `scale()`-ing) stroke, and this offset happens to
    // sit close to that ring's own radius — real fingers don't line up that precisely, but a
    // scripted pixel click can, and clicking through the *element* (auto-waited for stability)
    // instead of a bare coordinate avoids the false negative entirely.
    const offset = (drawnRadius + hitRadius) / 2;
    await page.locator('g.map-target-node .node-hit-target').first().click({ position: { x: hitRadius + offset, y: hitRadius } });

    await expect(page.locator('.map-popup')).toBeVisible({ timeout: 5_000 });
  });

  test('the default-open player-boards panel does not cover the hand cards, in landscape', async ({ page }) => {
    await useLandscape(page);
    await page.goto('/offline');
    await page.getByRole('button', { name: 'Novo jogo' }).tap();
    await expect(page.locator('main.app-main')).toBeVisible({ timeout: 15_000 });
    await waitForHumanTurn(page);

    // `.mat-panel` (the "tabuleiros" player-boards panel) is open by default — see
    // `PlayerMatComponent`'s own spec for that — so this checks it against a real hand card
    // rather than assuming any particular layout math. It checks *which* card index is on top
    // at card 0's own center, not just that some `.hand-card` is there — the fanned hand
    // deliberately overlaps neighboring cards, so a weaker check could pass even with a
    // different card sitting on top of the one under test.
    await expect(page.locator('.mat-panel')).toBeVisible();
    const cardBox = await page.locator('.hand-card').first().boundingBox();
    const point: [number, number] = [cardBox!.x + cardBox!.width / 2, cardBox!.y + cardBox!.height / 2];
    const topCardIndex = await page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      const cards = Array.from(document.querySelectorAll('.hand-card'));
      return el === null ? -1 : cards.indexOf(el.closest('.hand-card') as Element);
    }, point);
    expect(topCardIndex).toBe(0);
  });
});
