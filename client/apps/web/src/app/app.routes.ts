import { Routes } from '@angular/router';
import { GameGateway, GameStateService, RoomGateway, RoomLobbyService } from '@brass/application';
import { InProcessGameGateway, LazyRoomGameGateway, RoomConnection, WsRoomGateway } from '@brass/infrastructure';
import { GameShellComponent, HomeComponent, OnlinePlayComponent } from '@brass/presentation';

/**
 * `/offline` and `/online` both reuse `GameShellComponent` completely unchanged (`/online`
 * indirectly, inside `OnlinePlayComponent`) — the only thing that differs per route is which
 * `GameGateway` is bound for that route's injector (`GameGateway` has no app-wide default
 * anymore — see `app.config.ts` — every route that renders `GameShellComponent` must supply
 * its own). `GameStateService` is provided here too, alongside `GameGateway`, not left to its
 * default tree-shakable root scope — see the comment on the service itself for why a
 * root-singleton service can't see a per-route provider.
 */
export const routes: Routes = [
  { path: '', component: HomeComponent },
  {
    path: 'offline',
    component: GameShellComponent,
    providers: [GameStateService, { provide: GameGateway, useFactory: () => new InProcessGameGateway() }],
  },
  {
    path: 'online',
    component: OnlinePlayComponent,
    providers: [
      GameStateService,
      { provide: RoomConnection, useFactory: () => new RoomConnection() },
      { provide: RoomGateway, useFactory: (conn: RoomConnection) => new WsRoomGateway(conn), deps: [RoomConnection] },
      RoomLobbyService,
      { provide: GameGateway, useFactory: (lobby: RoomLobbyService, conn: RoomConnection) => new LazyRoomGameGateway(lobby, conn), deps: [RoomLobbyService, RoomConnection] },
    ],
  },
];
