import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { GameGateway } from '@brass/application';
import { HttpGameGateway } from '@brass/infrastructure';

/**
 * The composition root: the one place allowed to know that `GameGateway` (the port
 * `application` depends on) is fulfilled by `HttpGameGateway` (the HTTP adapter in
 * `infrastructure`). Every layer below this only ever sees the port.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    { provide: GameGateway, useClass: HttpGameGateway },
  ],
};
