import { Routes } from '@angular/router';
import { GameGateway, RoomGateway, RoomLobbyService } from '@brass/application';
import { InProcessGameGateway, LazyRoomGameGateway, RoomConnection, WsRoomGateway } from '@brass/infrastructure';
import { GameShellComponent, HomeComponent, OnlinePlayComponent } from '@brass/presentation';

/**
 * `/offline` and `/online` both reuse `GameShellComponent` completely unchanged (`/online`
 * indirectly, inside `OnlinePlayComponent`) — the only thing that differs per route is which
 * `GameGateway` is bound for that route's injector (`GameGateway` has no app-wide default
 * anymore — see `app.config.ts` — every route that renders `GameShellComponent` must supply
 * its own).
 */
export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'offline', component: GameShellComponent, providers: [{ provide: GameGateway, useFactory: () => new InProcessGameGateway() }] },
  {
    path: 'online',
    component: OnlinePlayComponent,
    providers: [
      { provide: RoomConnection, useFactory: () => new RoomConnection() },
      { provide: RoomGateway, useFactory: (conn: RoomConnection) => new WsRoomGateway(conn), deps: [RoomConnection] },
      RoomLobbyService,
      { provide: GameGateway, useFactory: (lobby: RoomLobbyService, conn: RoomConnection) => new LazyRoomGameGateway(lobby, conn), deps: [RoomLobbyService, RoomConnection] },
    ],
  },
];
