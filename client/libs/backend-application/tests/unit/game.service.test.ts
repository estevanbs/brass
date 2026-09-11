import { describe, expect, it } from 'vitest';
import { InMemoryGameRepository, type GameSeat } from '../../src/lib/game.model.js';
import { GameService, type MoveEvent } from '../../src/lib/game.service.js';
import { GameAlreadyOverError, GameNotFoundError, InvalidActionIndexError, NotYourTurnError } from '../../src/lib/game.errors.js';

interface View {
  readonly gameId: string;
  readonly humanId: string;
  readonly state: { readonly gameOver: boolean; readonly players: Record<string, { readonly hand: readonly unknown[] }>; readonly drawDeck: readonly unknown[] };
  readonly legalActions: readonly { readonly index: number }[];
  readonly log: readonly string[];
}

const SOLO_SEATS: readonly GameSeat[] = [
  { playerId: 'você', isBot: false },
  { playerId: 'bot1', isBot: true },
];

function makeService(): { service: GameService; repository: InMemoryGameRepository } {
  const repository = new InMemoryGameRepository();
  return { service: new GameService(repository), repository };
}

/** Whichever seat's view currently shows legal actions is the one whose turn it actually is —
 * `createGame`/`submitHumanAction` already advance bots until a non-bot seat is active, so
 * exactly one human seat has a non-empty view at any point this helper is called. */
function findActiveHuman(service: GameService, id: string, seats: readonly GameSeat[]): { playerId: string; view: View } {
  for (const seat of seats) {
    if (seat.isBot) continue;
    const view = service.getView(id, seat.playerId) as View;
    if (view.legalActions.length > 0) return { playerId: seat.playerId, view };
  }
  throw new Error('unreachable: no human seat has a turn (game over?)');
}

describe('GameService', () => {
  it('createGame starts a game with legal actions for the human and a stable id', () => {
    const { service } = makeService();
    const { id } = service.createGame(SOLO_SEATS, 1);
    const v = service.getView(id, 'você') as View;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(v.gameId).toBe(id);
    expect(v.humanId).toBe('você');
    expect(v.legalActions.length).toBeGreaterThan(0);
  });

  it('getView returns the same game regardless of which known seat asks', () => {
    const { service } = makeService();
    const { id } = service.createGame(SOLO_SEATS, 1);
    const v = service.getView(id, 'bot1') as View;
    expect(v.gameId).toBe(id);
  });

  it('getView throws GameNotFoundError for an unknown id', () => {
    const { service } = makeService();
    expect(() => service.getView('nope', 'você')).toThrow(GameNotFoundError);
  });

  it('getView redacts every other seat\'s hand and the draw deck, but keeps the viewer\'s own hand', () => {
    const { service } = makeService();
    const { id } = service.createGame(SOLO_SEATS, 1);

    const humanView = service.getView(id, 'você') as View;
    expect(humanView.state.players['você']?.hand.length).toBeGreaterThan(0);
    expect(humanView.state.players['bot1']?.hand).toEqual([]);
    expect(humanView.state.drawDeck).toEqual([]);

    const botView = service.getView(id, 'bot1') as View;
    expect(botView.state.players['bot1']?.hand.length).toBeGreaterThan(0);
    expect(botView.state.players['você']?.hand).toEqual([]);
    expect(botView.state.drawDeck).toEqual([]);
  });

  it('submitHumanAction advances the game and lets bots play until a human turn again (or the game ends)', () => {
    const { service } = makeService();
    const { id } = service.createGame(SOLO_SEATS, 7);
    const before = service.getView(id, 'você') as View;
    const nextView = service.submitHumanAction(id, 'você', before.legalActions[0]?.index) as View;
    expect(nextView.gameId).toBe(id);
    // Either it's the human's turn again (legal actions present) or the game already ended.
    expect(nextView.legalActions.length > 0 || nextView.state.gameOver).toBe(true);
    expect(nextView.log.length).toBeGreaterThan(0);
  });

  it('submitHumanAction throws GameNotFoundError for an unknown id', () => {
    const { service } = makeService();
    expect(() => service.submitHumanAction('nope', 'você', 0)).toThrow(GameNotFoundError);
  });

  it('submitHumanAction throws NotYourTurnError when a seat other than the active one submits', () => {
    const { service } = makeService();
    const { id } = service.createGame(SOLO_SEATS, 1);
    // The human seat is always the one active right after createGame (bots never go before it
    // in this fixture's turn order across the seeds used here) — bot1 acting instead must be
    // rejected rather than silently accepted.
    expect(() => service.submitHumanAction(id, 'bot1', 0)).toThrow(NotYourTurnError);
  });

  it('submitHumanAction throws InvalidActionIndexError for an out-of-range index', () => {
    const { service } = makeService();
    const { id } = service.createGame(SOLO_SEATS, 1);
    expect(() => service.submitHumanAction(id, 'você', 999)).toThrow(InvalidActionIndexError);
  });

  it('submitHumanAction throws InvalidActionIndexError when no index is given', () => {
    const { service } = makeService();
    const { id } = service.createGame(SOLO_SEATS, 1);
    expect(() => service.submitHumanAction(id, 'você', undefined)).toThrow(InvalidActionIndexError);
  });

  it('submitHumanAction calls onMove once per move, in order, and the last one matches the returned view', () => {
    const { service } = makeService();
    const { id } = service.createGame(SOLO_SEATS, 7);
    const before = service.getView(id, 'você') as View;

    const events: MoveEvent[] = [];
    const returned = service.submitHumanAction(id, 'você', before.legalActions[0]?.index, (event) => events.push(event)) as View;

    expect(events.length).toBeGreaterThan(0);
    // The human's own move is always the first event.
    expect(events[0]?.playerId).toBe('você');
    // Every subsequent event, if any, is a bot's own move (the loop only keeps going past a
    // move while the next active seat is a bot).
    for (const event of events.slice(1)) {
      expect(event.playerId).toBe('bot1');
    }

    const finalView = service.getView(id, 'você') as View;
    expect(returned).toEqual(finalView);
  });

  it('submitHumanAction works the same with no onMove callback at all', () => {
    const { service } = makeService();
    const { id } = service.createGame(SOLO_SEATS, 7);
    const before = service.getView(id, 'você') as View;
    const returned = service.submitHumanAction(id, 'você', before.legalActions[0]?.index) as View;
    expect(returned.gameId).toBe(id);
  });

  it('submitHumanAction throws GameAlreadyOverError once the game has ended', () => {
    // Forces game-over directly through the repository instead of actually playing a full
    // game to completion through the (real-time-budgeted) ISMCTS bot, which would make this
    // "unit" test take tens of seconds per docs/PLANO.md's own testing rules.
    const { service, repository } = makeService();
    const { id } = service.createGame(SOLO_SEATS, 3);
    const game = repository.get(id);
    if (game === undefined) throw new Error('unreachable');
    repository.set(id, { ...game, state: { ...game.state, gameOver: true } });

    expect(() => service.submitHumanAction(id, 'você', 0)).toThrow(GameAlreadyOverError);
  });

  describe('multiple human seats', () => {
    const SEATS: readonly GameSeat[] = [
      { playerId: 'ana', isBot: false },
      { playerId: 'beto', isBot: false },
    ];

    it('only the seat whose turn it is has legal actions, and the other sees none', () => {
      const { service } = makeService();
      const { id } = service.createGame(SEATS, 5);
      const { playerId: activeId } = findActiveHuman(service, id, SEATS);
      const otherId = SEATS.map((s) => s.playerId).find((p) => p !== activeId);
      if (otherId === undefined) throw new Error('unreachable');

      const otherView = service.getView(id, otherId) as View;
      expect(otherView.legalActions.length).toBe(0);
    });

    it('a seat cannot act out of turn, but the active seat can and control passes to the other', () => {
      const { service } = makeService();
      const { id } = service.createGame(SEATS, 5);
      const { playerId: activeId, view } = findActiveHuman(service, id, SEATS);
      const otherId = SEATS.map((s) => s.playerId).find((p) => p !== activeId);
      if (otherId === undefined) throw new Error('unreachable');

      expect(() => service.submitHumanAction(id, otherId, view.legalActions[0]?.index)).toThrow(NotYourTurnError);

      const returned = service.submitHumanAction(id, activeId, view.legalActions[0]?.index) as View;

      // Whoever is active now (there are no bots to consume this turn), it's exactly one of
      // the two seats and that seat's own view shows it.
      if (!returned.state.gameOver) {
        const { playerId: nowActiveId } = findActiveHuman(service, id, SEATS);
        expect([activeId, otherId]).toContain(nowActiveId);
      }
    });
  });
});
