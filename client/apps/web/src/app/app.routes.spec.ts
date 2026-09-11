import { describe, expect, it } from 'vitest';
import { GameGateway, RoomGateway, RoomLobbyService } from '@brass/application';
import { RoomConnection } from '@brass/infrastructure';
import { GameShellComponent, OnlinePlayComponent } from '@brass/presentation';
import { routes } from './app.routes';

function findProvider(providers: unknown[] | undefined, token: unknown): { provide: unknown; useFactory?: unknown } | undefined {
  return providers?.find((p) => typeof p === 'object' && p !== null && 'provide' in p && (p as { provide: unknown }).provide === token) as
    | { provide: unknown; useFactory?: unknown }
    | undefined;
}

/** Checks the route *configuration* directly — no navigation, no `TestBed`, and no
 * `useFactory` function is ever actually called, so nothing here ever constructs a real
 * `InProcessGameGateway`/`RoomConnection` (which would spin up an actual Worker/WebSocket).
 * Both `/offline`'s and `/online`'s happy paths need a real browser (or Playwright) since
 * jsdom has neither a Worker nor a real network — this test only guards the wiring that
 * determines *which* concrete adapters each route gets. */
describe('app routes', () => {
  it('"" redirects to "offline"', () => {
    const root = routes.find((r) => r.path === '');
    expect(root?.redirectTo).toBe('offline');
    expect(root?.pathMatch).toBe('full');
  });

  it('"offline" renders GameShellComponent with an InProcessGameGateway factory', () => {
    const offline = routes.find((r) => r.path === 'offline');
    expect(offline?.component).toBe(GameShellComponent);
    expect(typeof findProvider(offline?.providers, GameGateway)?.useFactory).toBe('function');
  });

  it('"online" renders OnlinePlayComponent with RoomConnection, RoomGateway, RoomLobbyService, and GameGateway wired', () => {
    const online = routes.find((r) => r.path === 'online');
    expect(online?.component).toBe(OnlinePlayComponent);

    expect(typeof findProvider(online?.providers, RoomConnection)?.useFactory).toBe('function');
    expect(typeof findProvider(online?.providers, RoomGateway)?.useFactory).toBe('function');
    expect(typeof findProvider(online?.providers, GameGateway)?.useFactory).toBe('function');
    expect(online?.providers).toContain(RoomLobbyService);
  });
});
