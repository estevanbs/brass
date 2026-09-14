import { expect, test, type Page } from '@playwright/test';

/**
 * Real mobile-viewport coverage (see `playwright.config.mts`'s `mobile-chromium` project,
 * which runs only this file against `devices['Pixel 7']` — touch input, device pixel ratio,
 * the whole emulation, not just a resized desktop window).
 *
 * The board (1080x640, a wide map) reads best in landscape on a phone — the same orientation
 * you'd turn a physical box to play it on a table — so most actual-gameplay tests below use a
 * landscape viewport. The layout/overflow checks run in the device's default portrait
 * orientation too, since arriving at "/" and the pre-game screens should never be broken there
 * even before anyone rotates their phone.
 */

const MIN_TOUCH_TARGET_PX = 44;
// Found by measuring a real landscape phone viewport (Pixel 7 sideways, 915x412): before the
// height-based layout fixes, the header/top-strip/hand-dock alone ate 369 of those 412px,
// leaving the board a 43px sliver. Then, with the action buttons still stacked above the hand,
// it was 190px. Placing them beside the hand gives it ~250px; 220 pins that improvement.
const MIN_LANDSCAPE_STAGE_HEIGHT_PX = 220;
// An opened panel collapsed to an 18-22px sliver (its max-height resolved against its tiny
// dock instead of the board area) — anything past ~100px is actually readable.
const MIN_OPEN_PANEL_HEIGHT_PX = 100;

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

async function useOrientation(page: Page, orientation: 'portrait' | 'landscape'): Promise<void> {
  if (orientation === 'landscape') await useLandscape(page);
}

/** "Novo jogo" doesn't pin a seed, so turn order is random each run — when a bot goes first,
 * the board keeps changing underneath a test as the bot's move(s) resolve, which is exactly
 * the kind of thing that makes a hand-card/map interaction flaky (an element it depends on can
 * be re-rendered mid-interaction). Waiting for the human's own turn first removes that race. */
async function waitForHumanTurn(page: Page): Promise<void> {
  await expect(page.locator('.strip-player.human.active')).toBeVisible({ timeout: 20_000 });
}

async function startGame(page: Page): Promise<void> {
  await page.goto('/offline');
  await page.getByRole('button', { name: 'Novo jogo' }).tap();
  await expect(page.locator('main.app-main')).toBeVisible({ timeout: 15_000 });
  await waitForHumanTurn(page);
}

/** Selects whichever hand card first unlocks at least one clickable map node (a location card
 * guarantees this; an industry card might not, depending on the deal). */
async function selectCardWithMapTargets(page: Page): Promise<void> {
  const cards = page.locator('.hand-card');
  const count = await cards.count();
  for (let i = 0; i < count; i++) {
    await cards.nth(i).tap();
    if ((await page.locator('.node-hit-target').count()) > 0) return;
  }
  throw new Error('no hand card unlocked any clickable map node — nothing to tap');
}

type Box = { x: number; y: number; width: number; height: number };

function expectInside(inner: Box, outer: Box, what: string): void {
  expect(inner.x, `${what}: left edge`).toBeGreaterThanOrEqual(outer.x - 1);
  expect(inner.y, `${what}: top edge`).toBeGreaterThanOrEqual(outer.y - 1);
  expect(inner.x + inner.width, `${what}: right edge`).toBeLessThanOrEqual(outer.x + outer.width + 1);
  expect(inner.y + inner.height, `${what}: bottom edge`).toBeLessThanOrEqual(outer.y + outer.height + 1);
}

/** Checks the confirm popup a map tap just opened is fully inside `stageBox`, then closes it. A
 * tap can instead enter resource-choice mode (no popup at all), which leaves nothing to check. */
async function expectOpenPopupInside(page: Page, stageBox: Box, what: string): Promise<void> {
  const popup = page.locator('.map-popup');
  if (!(await popup.isVisible())) return;
  const popupBox = await popup.boundingBox();
  expect(popupBox, what).not.toBeNull();
  expectInside(popupBox!, stageBox, what);
  await page.locator('.popup-close').tap();
  await expect(popup).toBeHidden();
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
    await startGame(page);
    await expectNoHorizontalOverflow(page);

    // `.stage` (the board's own container) used to be squeezed down to a ~43px sliver on a
    // short landscape phone by the fixed-height header/top-strip/hand-dock around it — a real
    // bug this test pins directly, rather than only checking the symptom (that the map doesn't
    // overflow, which a tiny map would also satisfy).
    const stageBox = await page.locator('.stage').boundingBox();
    expect(stageBox).not.toBeNull();
    expect(stageBox!.height).toBeGreaterThanOrEqual(MIN_LANDSCAPE_STAGE_HEIGHT_PX);

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
    await startGame(page);

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
    // The log starts collapsed on a phone (see the panels test below) — open it to read it.
    await page.getByRole('button', { name: /registro/ }).tap();
    await expect(page.locator('.log')).toContainText('Passar', { timeout: 15_000 });
  });

  test('the legend, log and player-boards panels start collapsed on a phone, and each opens to a readable size inside the board area', async ({
    page,
  }) => {
    await useLandscape(page);
    await startGame(page);

    // Open by default, these three buried most of a phone-sized board before the player
    // touched anything.
    await expect(page.locator('.map-legend')).toBeHidden();
    await expect(page.locator('.log')).toBeHidden();
    await expect(page.locator('.mat-panel')).toBeHidden();

    const stageBox = (await page.locator('.stage').boundingBox())!;
    for (const [toggle, panel, minHeight] of [
      [/legenda/, '.map-legend', MIN_OPEN_PANEL_HEIGHT_PX],
      [/tabuleiros/, '.mat-panel', MIN_OPEN_PANEL_HEIGHT_PX],
      // The log only grows as tall as its entries — early in a game there may be none, so this
      // only checks it doesn't collapse below its own padding plus a line.
      [/registro/, '.log', 0],
    ] as const) {
      await page.getByRole('button', { name: toggle }).tap();
      const box = await page.locator(panel).boundingBox();
      expect(box, `${panel} did not open`).not.toBeNull();
      expect(box!.height, `${panel} opened too small to read`).toBeGreaterThanOrEqual(minHeight);
      expectInside(box!, stageBox, panel);
      await page.getByRole('button', { name: toggle }).tap();
      await expect(page.locator(panel)).toBeHidden();
    }
  });

  for (const orientation of ['portrait', 'landscape'] as const) {
    test(`every map-anchored confirm popup stays fully inside the board area, in ${orientation}`, async ({ page }) => {
      await useOrientation(page, orientation);
      await startGame(page);
      await selectCardWithMapTargets(page);

      // An anchored popup opens at the tapped node's own position; unclamped, one near the
      // right/bottom edge ran up to 238px outside `.stage`, which clips it — options invisible
      // and untappable. Every clickable node is checked, since the edge ones are the point.
      // Dispatched in-page (not a positional tap) so a node that happens to sit under a docked
      // toggle is still exercised — the popup's position is what's under test, not the tap.
      const nodeCount = await page.locator('.node-hit-target').count();
      expect(nodeCount, 'no clickable map node to check a popup for').toBeGreaterThan(0);
      const stageBox = (await page.locator('.stage').boundingBox())!;
      for (let i = 0; i < nodeCount; i++) {
        await page.evaluate((index) => {
          document.querySelectorAll('.node-hit-target')[index]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }, i);
        await expectOpenPopupInside(page, stageBox, `popup for clickable node #${i}`);
      }
    });
  }

  test('portrait: every hand card can be tapped at its own center, and the action buttons never push the page sideways', async ({ page }) => {
    await startGame(page);

    // Long single-word location names used to spill past a phone-sized card and cover the
    // neighboring card's center, stealing taps aimed at it.
    const cards = page.locator('.hand-card');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const box = (await cards.nth(i).boundingBox())!;
      const hitIndex = await page.evaluate(
        ([x, y]) => {
          const hit = document.elementFromPoint(x, y)?.closest('.hand-card');
          return hit ? Array.from(document.querySelectorAll('.hand-card')).indexOf(hit) : -1;
        },
        [box.x + box.width / 2, box.y + box.height / 2] as const,
      );
      expect(hitIndex, `a tap at card #${i}'s center lands on a different element`).toBe(i);

      // Up to five action buttons at touch size don't fit one portrait line.
      await cards.nth(i).tap();
      await expectNoHorizontalOverflow(page);
    }
  });

  test('tapping just outside the drawn node circle — but inside the enlarged invisible hit-area around it — still opens the confirm popup', async ({
    page,
  }) => {
    await useLandscape(page);
    await startGame(page);

    // Starts collapsed on a phone, so it can't obstruct the node under test.
    await expect(page.locator('.mat-panel')).toBeHidden();
    await selectCardWithMapTargets(page);

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

  test('the player-boards panel, once opened, does not cover the hand cards, in landscape', async ({ page }) => {
    await useLandscape(page);
    await startGame(page);

    await page.getByRole('button', { name: /tabuleiros/ }).tap();
    await expect(page.locator('.mat-panel')).toBeVisible();

    // Checks *which* card index is on top at card 0's own center, not just that some
    // `.hand-card` is there — the fanned hand deliberately overlaps neighboring cards, so a
    // weaker check could pass even with a different card sitting on top of the one under test.
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
