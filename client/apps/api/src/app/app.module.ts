import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { GameService, InMemoryGameRepository } from '@brass/backend-application';
import { GamesController } from './games/games.controller.js';
import { GamesGateway } from './games/games.gateway.js';
import { GameErrorsFilter } from './games/game-errors.filter.js';

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
  controllers: [GamesController],
  providers: [
    {
      provide: GameService,
      useFactory: () => new GameService(new InMemoryGameRepository()),
    },
    {
      provide: APP_FILTER,
      useClass: GameErrorsFilter,
    },
    GamesGateway,
  ],
})
export class AppModule {}
