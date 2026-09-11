import { Routes } from '@angular/router';
import { GameGateway } from '@brass/application';
import { InProcessGameGateway } from '@brass/infrastructure';
import { GameShellComponent } from '@brass/presentation';

/**
 * `/offline` reuses `GameShellComponent` completely unchanged — the only thing that differs
 * from the default (server-backed) game is which `GameGateway` is bound for this route's
 * injector, overriding the app-wide `HttpGameGateway` from `app.config.ts` with
 * `InProcessGameGateway` (the engine running in a Web Worker, no network involved at all).
 */
export const routes: Routes = [
  { path: '', component: GameShellComponent },
  { path: 'offline', component: GameShellComponent, providers: [{ provide: GameGateway, useFactory: () => new InProcessGameGateway() }] },
];
