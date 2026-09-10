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

export interface ActionTargets {
  readonly locationIds: readonly string[];
  readonly linkSlotIds: readonly string[];
}

/** One applied move — the human's own, or one bot's — as `submitHumanAction`'s optional
 * `onMove` callback receives it, one call per move in the order they actually happened. Lets
 * a transport (the WebSocket gateway) stream each move to the client as it happens instead of
 * only the final state once every bot has played. */
export interface MoveEvent {
  readonly playerId: PlayerId;
  readonly actionLabel: string;
  readonly targets: ActionTargets;
  readonly view: unknown;
}

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
function actionTargets(action: Action): ActionTargets {
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
 * transport (NestJS WebSocket gateway, CLI, tests) can drive it through a `GameRepository`
 * port instead of a module-level `Map`.
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
    const id = randomUUID();
    // Never actually streams anything here: the human is always turnOrder[0], so this loop is
    // a no-op on creation — kept anyway so a future non-human-first variant wouldn't silently
    // skip bot moves before the game is even registered.
    this.advanceBotsUntilHumanOrOver(id, game);
    this.repository.set(id, game);
    return { id, view: this.view(id, game) };
  }

  getView(gameId: string): unknown {
    const game = this.repository.get(gameId);
    if (game === undefined) throw new GameNotFoundError();
    return this.view(gameId, game);
  }

  /** Applies the human's chosen action, then lets bots play until it's the human's turn again
   * or the game ends. `onMove`, when given, is called once per move in the order they happen
   * (the human's own move first, then one call per bot move) — the streaming counterpart to
   * this method's return value, which is just the final view once everything above settles. */
  submitHumanAction(gameId: string, index: number | undefined, onMove?: (event: MoveEvent) => void): unknown {
    const game = this.repository.get(gameId);
    if (game === undefined) throw new GameNotFoundError();
    if (game.state.gameOver) throw new GameAlreadyOverError();

    const actions = legalActions(game.state, HUMAN_ID);
    const action = index === undefined ? undefined : actions[index];
    if (action === undefined) throw new InvalidActionIndexError();

    game.state = advanceAfterAction(applyAction(game.state, action));
    game.log.push(`${HUMAN_ID}: ${describeAction(action)}`);
    if (game.log.length > MAX_LOG) game.log.shift();
    onMove?.({
      playerId: HUMAN_ID,
      actionLabel: describeAction(action),
      targets: actionTargets(action),
      view: this.view(gameId, game),
    });

    this.advanceBotsUntilHumanOrOver(gameId, game, onMove);
    return this.view(gameId, game);
  }

  private advanceBotsUntilHumanOrOver(gameId: string, game: Game, onMove?: (event: MoveEvent) => void): void {
    while (!game.state.gameOver) {
      const activeId = game.state.turnOrder[game.state.activePlayerIndex];
      if (activeId === undefined || activeId === HUMAN_ID) break;
      const action = game.bot(game.state, activeId, game.botRng);
      game.state = advanceAfterAction(applyAction(game.state, action));
      const est = evaluate(game.state, activeId).toFixed(1);
      const label = `${describeAction(action)} (VP est. ${est})`;
      game.log.push(`${activeId}: ${label}`);
      if (game.log.length > MAX_LOG) game.log.shift();
      onMove?.({ playerId: activeId, actionLabel: label, targets: actionTargets(action), view: this.view(gameId, game) });
    }
  }

  private view(gameId: string, game: Game): unknown {
    const activeId = game.state.turnOrder[game.state.activePlayerIndex];
    // `legalActions(state, HUMAN_ID)` only reflects what's actually in the human's hand — it
    // is *not* gated by whose turn it is (the individual action appliers `legal/index.ts`
    // calls to validate candidates don't check `state.activePlayerIndex`, only `applyAction`'s
    // own wrapper does, which `legalActions` bypasses). Every prior caller of `view()` only
    // ever ran after confirming it was genuinely the human's turn, so this never mattered —
    // but `submitHumanAction`'s `onMove` now calls `view()` mid-loop, while a bot is still the
    // active player, so it must be made explicit here instead of staying an accident of call
    // order: only compute real legal actions when it truly is the human's turn.
    const actions = game.state.gameOver || activeId !== HUMAN_ID ? [] : legalActions(game.state, HUMAN_ID);
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
