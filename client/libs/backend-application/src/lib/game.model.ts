import type { GameState, PlayerId, Rng } from '@brass/backend-domain';
import type { Bot } from '@brass/backend-infrastructure';

export interface Game {
  state: GameState;
  readonly playerIds: readonly PlayerId[];
  readonly bot: Bot;
  readonly botRng: Rng;
  log: string[];
}

/** Port for where in-progress games live — `InMemoryGameRepository` today, swappable for a
 * persistent store later without touching `GameService`. */
export interface GameRepository {
  get(id: string): Game | undefined;
  set(id: string, game: Game): void;
}

/** In-memory adapter — the same semantics as the module-level `Map<string, Game>` the old
 * `node:http` server (`src/web/server.ts`) used directly; one instance per running process, no
 * persistence across restarts. */
export class InMemoryGameRepository implements GameRepository {
  private readonly games = new Map<string, Game>();

  get(id: string): Game | undefined {
    return this.games.get(id);
  }

  set(id: string, game: Game): void {
    this.games.set(id, game);
  }
}
