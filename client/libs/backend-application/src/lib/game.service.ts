import { randomUUID } from 'node:crypto';
import {
  FARM_BREWERIES,
  INDUSTRIAL_LOCATIONS,
  INDUSTRY_TILES,
  LINK_SLOTS,
  MARKETS,
  advanceAfterAction,
  applyAction,
  cardKey,
  createInitialState,
  legalActions,
  mulberry32,
  skipEmptyHandTurns,
  type Action,
  type PlayerId,
} from '@brass/backend-domain';
import { evaluate, makeIsmctsBot } from '@brass/backend-infrastructure';
import { actionCostLines } from './action-cost.js';
import { GameAlreadyOverError, GameNotFoundError, InvalidActionIndexError } from './game.errors.js';
import type { Game, GameRepository } from './game.model.js';
import { describeAction } from './render.js';

const HUMAN_ID: PlayerId = 'você';
const MAX_LOG = 60;

function botTimeBudgetMs(playerIds: readonly PlayerId[]): number {
  // Keep total wait per human turn reasonable even with 3 bots in a row.
  return playerIds.length <= 2 ? 1000 : 600;
}

function actionCardKeys(action: Action): string[] {
  return action.type === 'scout' ? action.cards.map(cardKey) : [cardKey(action.card)];
}

/** Where an action "happens" on the board, so the frontend can highlight it directly on the
 * map instead of only listing it as text (Build/Sell -> town(s); Network -> link line(s);
 * Develop/Loan/Scout/Pass don't target the board at all). */
function actionTargets(action: Action): { locationIds: string[]; linkSlotIds: string[] } {
  switch (action.type) {
    case 'build':
      return { locationIds: [action.locationId], linkSlotIds: [] };
    case 'network':
      return { locationIds: [], linkSlotIds: [...action.linkSlotIds] };
    case 'sell':
      return { locationIds: action.sales.map((s) => s.locationId), linkSlotIds: [] };
    default:
      return { locationIds: [], linkSlotIds: [] };
  }
}

/** Static board topology (never changes across games) — sent once per view so the frontend
 * can draw a map without duplicating rules data. */
const BOARD_SUMMARY = {
  locations: [
    ...INDUSTRIAL_LOCATIONS.map((l) => ({ id: l.id, kind: l.kind })),
    ...FARM_BREWERIES.map((l) => ({ id: l.id, kind: l.kind })),
    ...MARKETS.map((l) => ({ id: l.id, kind: l.kind })),
  ],
  links: LINK_SLOTS.map((l) => ({
    id: l.id,
    locations: l.locations,
    bonusConnections: l.bonusConnections,
    era: l.era,
  })),
};

/**
 * Application-layer orchestration for one game: creating it, applying the human's chosen
 * action, and letting bots play until control returns to the human or the game ends. A
 * behavior-preserving extraction of what used to be module-level functions/state in the plain
 * `node:http` server (`src/web/server.ts`) — same logic, now framework-agnostic so any
 * transport (NestJS controller, CLI, tests) can drive it through a `GameRepository` port
 * instead of a module-level `Map`.
 */
export class GameService {
  constructor(private readonly repository: GameRepository) {}

  createGame(playerCount: number, seed: number): { id: string; view: unknown } {
    const count = Math.max(2, Math.min(4, playerCount));
    const playerIds: PlayerId[] = [HUMAN_ID, ...Array.from({ length: count - 1 }, (_, i) => `bot${i + 1}`)];
    const game: Game = {
      state: skipEmptyHandTurns(createInitialState(playerIds, seed)),
      playerIds,
      bot: makeIsmctsBot({ timeBudgetMs: botTimeBudgetMs(playerIds) }),
      botRng: mulberry32(seed ^ 0x9e3779b9),
      log: [],
    };
    this.advanceBotsUntilHumanOrOver(game);
    const id = randomUUID();
    this.repository.set(id, game);
    return { id, view: this.view(id, game) };
  }

  getView(gameId: string): unknown {
    const game = this.repository.get(gameId);
    if (game === undefined) throw new GameNotFoundError();
    return this.view(gameId, game);
  }

  submitHumanAction(gameId: string, index: number | undefined): unknown {
    const game = this.repository.get(gameId);
    if (game === undefined) throw new GameNotFoundError();
    if (game.state.gameOver) throw new GameAlreadyOverError();

    const actions = legalActions(game.state, HUMAN_ID);
    const action = index === undefined ? undefined : actions[index];
    if (action === undefined) throw new InvalidActionIndexError();

    game.state = advanceAfterAction(applyAction(game.state, action));
    game.log.push(`${HUMAN_ID}: ${describeAction(action)}`);
    if (game.log.length > MAX_LOG) game.log.shift();
    this.advanceBotsUntilHumanOrOver(game);
    return this.view(gameId, game);
  }

  private advanceBotsUntilHumanOrOver(game: Game): void {
    while (!game.state.gameOver) {
      const activeId = game.state.turnOrder[game.state.activePlayerIndex];
      if (activeId === undefined || activeId === HUMAN_ID) break;
      const action = game.bot(game.state, activeId, game.botRng);
      game.state = advanceAfterAction(applyAction(game.state, action));
      const est = evaluate(game.state, activeId).toFixed(1);
      game.log.push(`${activeId}: ${describeAction(action)} (VP est. ${est})`);
      if (game.log.length > MAX_LOG) game.log.shift();
    }
  }

  private view(gameId: string, game: Game): unknown {
    const actions = game.state.gameOver ? [] : legalActions(game.state, HUMAN_ID);
    return {
      gameId,
      humanId: HUMAN_ID,
      state: game.state,
      board: BOARD_SUMMARY,
      industryTiles: INDUSTRY_TILES,
      legalActions: actions.map((action, index) => ({
        index,
        type: action.type,
        label: describeAction(action),
        cardKeys: actionCardKeys(action),
        targets: actionTargets(action),
        costLines: actionCostLines(game.state, action),
      })),
      log: game.log,
    };
  }
}
