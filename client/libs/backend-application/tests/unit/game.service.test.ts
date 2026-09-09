import { describe, expect, it } from 'vitest';
import { InMemoryGameRepository } from '../../src/lib/game.model.js';
import { GameService } from '../../src/lib/game.service.js';
import { GameAlreadyOverError, GameNotFoundError, InvalidActionIndexError } from '../../src/lib/game.errors.js';

interface View {
  readonly gameId: string;
  readonly humanId: string;
  readonly state: { readonly gameOver: boolean };
  readonly legalActions: readonly { readonly index: number }[];
  readonly log: readonly string[];
}

function makeService(): { service: GameService; repository: InMemoryGameRepository } {
  const repository = new InMemoryGameRepository();
  return { service: new GameService(repository), repository };
}

describe('GameService', () => {
  it('createGame starts a game with legal actions for the human and a stable id', () => {
    const { service } = makeService();
    const { id, view } = service.createGame(2, 1);
    const v = view as View;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(v.gameId).toBe(id);
    expect(v.humanId).toBe('você');
    expect(v.legalActions.length).toBeGreaterThan(0);
  });

  it('getView returns the same view for an existing game', () => {
    const { service } = makeService();
    const { id } = service.createGame(2, 1);
    const v = service.getView(id) as View;
    expect(v.gameId).toBe(id);
  });

  it('getView throws GameNotFoundError for an unknown id', () => {
    const { service } = makeService();
    expect(() => service.getView('nope')).toThrow(GameNotFoundError);
  });

  it('submitHumanAction advances the game and lets bots play until it is the human turn again (or the game ends)', () => {
    const { service } = makeService();
    const { id, view } = service.createGame(2, 7);
    const before = view as View;
    const nextView = service.submitHumanAction(id, before.legalActions[0]?.index) as View;
    expect(nextView.gameId).toBe(id);
    // Either it's the human's turn again (legal actions present) or the game already ended.
    expect(nextView.legalActions.length > 0 || nextView.state.gameOver).toBe(true);
    expect(nextView.log.length).toBeGreaterThan(0);
  });

  it('submitHumanAction throws GameNotFoundError for an unknown id', () => {
    const { service } = makeService();
    expect(() => service.submitHumanAction('nope', 0)).toThrow(GameNotFoundError);
  });

  it('submitHumanAction throws InvalidActionIndexError for an out-of-range index', () => {
    const { service } = makeService();
    const { id } = service.createGame(2, 1);
    expect(() => service.submitHumanAction(id, 999)).toThrow(InvalidActionIndexError);
  });

  it('submitHumanAction throws InvalidActionIndexError when no index is given', () => {
    const { service } = makeService();
    const { id } = service.createGame(2, 1);
    expect(() => service.submitHumanAction(id, undefined)).toThrow(InvalidActionIndexError);
  });

  it('submitHumanAction throws GameAlreadyOverError once the game has ended', () => {
    // Forces game-over directly through the repository instead of actually playing a full
    // game to completion through the (real-time-budgeted) ISMCTS bot, which would make this
    // "unit" test take tens of seconds per docs/PLANO.md's own testing rules.
    const { service, repository } = makeService();
    const { id } = service.createGame(2, 3);
    const game = repository.get(id);
    if (game === undefined) throw new Error('unreachable');
    repository.set(id, { ...game, state: { ...game.state, gameOver: true } });

    expect(() => service.submitHumanAction(id, 0)).toThrow(GameAlreadyOverError);
  });
});
