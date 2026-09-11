import { describe, expect, it } from 'vitest';
import { GameGateway } from '@brass/application';
import { GameShellComponent } from '@brass/presentation';
import { routes } from './app.routes';

/** Checks the route *configuration* directly — no navigation, no `TestBed`, and the
 * `useFactory` function is never actually called, so nothing here ever constructs a real
 * `InProcessGameGateway` (which would spin up an actual Worker). `app.spec.ts` already covers
 * `''` end-to-end through `RouterTestingHarness`; `/offline`'s happy path needs a real browser
 * (or Playwright) since jsdom has no Worker runtime — this test only guards the wiring that
 * determines *which* gateway that route will get. */
describe('app routes', () => {
  it('both "" and "offline" render GameShellComponent', () => {
    const root = routes.find((r) => r.path === '');
    const offline = routes.find((r) => r.path === 'offline');
    expect(root?.component).toBe(GameShellComponent);
    expect(offline?.component).toBe(GameShellComponent);
  });

  it('"offline" overrides GameGateway with a factory; "" leaves it to the app-wide default', () => {
    const root = routes.find((r) => r.path === '');
    const offline = routes.find((r) => r.path === 'offline');
    expect(root?.providers).toBeUndefined();

    const provider = offline?.providers?.find((p) => 'provide' in p && p.provide === GameGateway) as
      | { provide: unknown; useFactory: unknown }
      | undefined;
    expect(typeof provider?.useFactory).toBe('function');
  });
});
