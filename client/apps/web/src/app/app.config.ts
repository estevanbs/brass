import { ApplicationConfig, provideBrowserGlobalErrorListeners, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { GameGateway } from '@brass/application';
import { HttpGameGateway } from '@brass/infrastructure';
import { routes } from './app.routes';

/**
 * The composition root: the one place allowed to know that `GameGateway` (the port
 * `application` depends on) is fulfilled by `HttpGameGateway` (the HTTP adapter in
 * `infrastructure`) by default. Every layer below this only ever sees the port — and a
 * specific route (see `app.routes.ts`) can still override this app-wide binding for its own
 * subtree, which is exactly how `/offline` swaps in `InProcessGameGateway` instead.
 *
 * The service worker (registered here, configured by `ngsw-config.json`) is what "salva a
 * página no navegador": it caches the app shell on first load so the whole app — including
 * `/offline`, which needs no network at all once loaded — keeps working with no connection on
 * every visit after that. Disabled in dev mode so `nx serve` always reflects the latest code.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:30000' }),
    { provide: GameGateway, useClass: HttpGameGateway },
  ],
};
