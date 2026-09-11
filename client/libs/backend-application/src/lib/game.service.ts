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
  type GameState,
  type PlayerId,
} from '@brass/backend-domain';
import { evaluate, makeIsmctsBot } from '@brass/backend-infrastructure';
import { actionCostLines } from './action-cost.js';
import { GameAlreadyOverError, GameNotFoundError, InvalidActionIndexError, NotYourTurnError } from './game.errors.js';
import type { Game, GameRepository, GameSeat } from './game.model.js';
import { describeAction } from './render.js';

const MAX_LOG = 60;

export interface ActionTargets {
  readonly locationIds: readonly string[];
  readonly linkSlotIds: readonly string[];
}

/** One applied move — any seat's, human or bot — as `submitHumanAction`'s optional `onMove`
 * callback receives it, one call per move in the order they actually happened. Carries no
 * view of its own: different viewers need different (redacted) views of the same move, so the
 * caller asks for those separately via `GameService#getView` once per recipient. Lets a
 * transport (a WebSocket gateway) stream each move to every connected client as it happens,
 * instead of only the final state once every bot has played. */
export interface MoveEvent {
  readonly playerId: PlayerId;
  readonly actionLabel: string;
  readonly targets: ActionTargets;
}

function botTimeBudgetMs(seatCount: number): number {
  // Keep total wait per human turn reasonable even with 3 bots in a row.
  return seatCount <= 2 ? 1000 : 600;
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

/** What a viewer other than `viewerId` should never see: their hand (private — only the
 * physical card *count* is public in Brass, and nothing in the frontend reads it today, so
 * this drops it entirely rather than half-redacting) and the shared draw deck's order (hidden
 * from everyone, including `viewerId` about their own future draws). Only ever touches the
 * *outgoing* copy — every computation above this (legal actions, costs) already ran against
 * the real, unredacted `GameState`. */
function redactForViewer(state: GameState, viewerId: PlayerId): GameState {
  return {
    ...state,
    drawDeck: [],
    players: Object.fromEntries(
      Object.entries(state.players).map(([id, player]) => [id, id === viewerId ? player : { ...player, hand: [] }]),
    ),
  };
}

/**
 * Application-layer orchestration for one game: creating it, applying a seat's chosen action,
 * and letting bots play until control returns to a human seat or the game ends. Seat-agnostic
 * — offline play (one human seat + bot seats, driven in-process) and online rooms (several
 * human seats + optional bot seats, driven by `RoomsGateway`) are both just different seat
 * lists over the same orchestration, never two implementations of the rules themselves.
 */
export class GameService {
  constructor(private readonly repository: GameRepository) {}

  createGame(seats: readonly GameSeat[], seed: number): { id: string } {
    const playerIds = seats.map((s) => s.playerId);
    const game: Game = {
      state: skipEmptyHandTurns(createInitialState(playerIds, seed)),
      seats,
      bot: makeIsmctsBot({ timeBudgetMs: botTimeBudgetMs(seats.length) }),
      botRng: mulberry32(seed ^ 0x9e3779b9),
      log: [],
    };
    const id = randomUUID();
    // A no-op unless the first seat happens to be a bot: nothing has a view of this game yet
    // to stream to, so any bot moves before the first human turn just accumulate in the log.
    this.advanceBotsUntilHumanOrOver(game);
    this.repository.set(id, game);
    return { id };
  }

  getView(gameId: string, viewerId: PlayerId): unknown {
    const game = this.repository.get(gameId);
    if (game === undefined) throw new GameNotFoundError();
    return this.view(gameId, game, viewerId);
  }

  /** Applies `playerId`'s chosen action, then lets bots play until it's a human seat's turn
   * again or the game ends. `onMove`, when given, is called once per move in the order they
   * happen (the acting seat's own move first, then one call per bot move) — the streaming
   * counterpart to this method's return value, which is just `playerId`'s own final view once
   * everything above settles (a convenience for a single-viewer caller; a multi-viewer caller
   * like `RoomsGateway` should build each recipient's view itself, from `onMove`, instead). */
  submitHumanAction(gameId: string, playerId: PlayerId, index: number | undefined, onMove?: (event: MoveEvent) => void): unknown {
    const game = this.repository.get(gameId);
    if (game === undefined) throw new GameNotFoundError();
    if (game.state.gameOver) throw new GameAlreadyOverError();

    const activeId = game.state.turnOrder[game.state.activePlayerIndex];
    if (activeId !== playerId) throw new NotYourTurnError();

    const actions = legalActions(game.state, playerId);
    const action = index === undefined ? undefined : actions[index];
    if (action === undefined) throw new InvalidActionIndexError();

    game.state = advanceAfterAction(applyAction(game.state, action));
    game.log.push(`${playerId}: ${describeAction(action)}`);
    if (game.log.length > MAX_LOG) game.log.shift();
    onMove?.({ playerId, actionLabel: describeAction(action), targets: actionTargets(action) });

    this.advanceBotsUntilHumanOrOver(game, onMove);
    return this.view(gameId, game, playerId);
  }

  private advanceBotsUntilHumanOrOver(game: Game, onMove?: (event: MoveEvent) => void): void {
    const botIds = new Set(game.seats.filter((s) => s.isBot).map((s) => s.playerId));
    while (!game.state.gameOver) {
      const activeId = game.state.turnOrder[game.state.activePlayerIndex];
      if (activeId === undefined || !botIds.has(activeId)) break;
      const action = game.bot(game.state, activeId, game.botRng);
      game.state = advanceAfterAction(applyAction(game.state, action));
      const est = evaluate(game.state, activeId).toFixed(1);
      const label = `${describeAction(action)} (VP est. ${est})`;
      game.log.push(`${activeId}: ${label}`);
      if (game.log.length > MAX_LOG) game.log.shift();
      onMove?.({ playerId: activeId, actionLabel: label, targets: actionTargets(action) });
    }
  }

  private view(gameId: string, game: Game, viewerId: PlayerId): unknown {
    const activeId = game.state.turnOrder[game.state.activePlayerIndex];
    // `legalActions(state, viewerId)` only reflects what's actually in that seat's hand — it
    // is *not* gated by whose turn it is (the individual action appliers `legal/index.ts`
    // calls to validate candidates don't check `state.activePlayerIndex`, only `applyAction`'s
    // own wrapper does, which `legalActions` bypasses). Every prior caller of `view()` only
    // ever ran after confirming it was genuinely that seat's turn, so this never mattered —
    // but `submitHumanAction`'s `onMove` now calls `view()`-adjacent code mid-loop, and a room
    // has several real viewers, so it must be made explicit here instead of staying an
    // accident of call order: only compute real legal actions when it truly is `viewerId`'s
    // turn.
    const actions = game.state.gameOver || activeId !== viewerId ? [] : legalActions(game.state, viewerId);
    return {
      gameId,
      humanId: viewerId,
      state: redactForViewer(game.state, viewerId),
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
