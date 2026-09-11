import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { GameService, InMemoryGameRepository, InMemoryRoomRepository, RoomService } from '@brass/backend-application';
import { RoomsGateway } from './rooms/rooms.gateway.js';

// Built Angular app (`nx build web`) lands at the workspace-root-relative "../public" —
// i.e. the repo root's `public/`, the same directory `src/web/server.ts` used to serve
// directly. At runtime this file is bundled to `dist/apps/api/main.js`, four levels under the
// repo root (repo/client/dist/apps/api).
const PUBLIC_DIR = join(__dirname, '../../../../public');

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: PUBLIC_DIR,
      exclude: ['/api/{*any}'],
    }),
  ],
  providers: [
    {
      provide: GameService,
      useFactory: () => new GameService(new InMemoryGameRepository()),
    },
    {
      provide: RoomService,
      useFactory: (games: GameService) => new RoomService(new InMemoryRoomRepository(), games),
      inject: [GameService],
    },
    RoomsGateway,
  ],
})
export class AppModule {}
