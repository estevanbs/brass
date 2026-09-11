import { ApplicationConfig, provideBrowserGlobalErrorListeners, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';

/**
 * The composition root — every route that needs a `GameGateway` (the port `application`
 * depends on) binds its own concrete adapter in `app.routes.ts` (`/offline` uses
 * `InProcessGameGateway`, an online route uses a WebSocket-backed one); there is no app-wide
 * default, since there is no longer a single "solo vs. bots via the server" mode that a bare
 * `GameGateway` injection could mean.
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
    provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:30000' }),
  ],
};
