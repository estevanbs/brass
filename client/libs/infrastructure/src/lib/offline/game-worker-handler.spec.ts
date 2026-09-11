import { describe, expect, it } from 'vitest';
import { GameWorkerHandler } from './game-worker-handler';
import type { WorkerResponse } from './game-worker-protocol';

interface View {
  readonly gameId: string;
  readonly humanId: string;
  readonly legalActions: readonly { readonly index: number }[];
}

function collect(handler: GameWorkerHandler, request: Parameters<GameWorkerHandler['handle']>[0]): WorkerResponse[] {
  const responses: WorkerResponse[] = [];
  handler.handle(request, (response) => responses.push(response));
  return responses;
}

describe('GameWorkerHandler', () => {
  it('createGame responds with a single view for the human seat, with legal actions', () => {
    const handler = new GameWorkerHandler();
    const responses = collect(handler, { type: 'createGame', requestId: 'r1', playerCount: 2, seed: 1 });

    expect(responses).toHaveLength(1);
    const [response] = responses;
    if (response?.type !== 'view') throw new Error('expected a view response');
    expect(response.requestId).toBe('r1');
    const view = response.view as View;
    expect(view.humanId).toBe('você');
    expect(view.legalActions.length).toBeGreaterThan(0);
  });

  it('createGame defaults playerCount to the 2-4 range and seed when omitted', () => {
    const handler = new GameWorkerHandler();
    const responses = collect(handler, { type: 'createGame', requestId: 'r1', playerCount: 99 });
    const [response] = responses;
    if (response?.type !== 'view') throw new Error('expected a view response');
    expect((response.view as View).gameId).toBeTruthy();
  });

  it('getGame returns the same game by id', () => {
    const handler = new GameWorkerHandler();
    const created = collect(handler, { type: 'createGame', requestId: 'r1', playerCount: 2, seed: 1 })[0];
    if (created?.type !== 'view') throw new Error('expected a view response');
    const gameId = (created.view as View).gameId;

    const responses = collect(handler, { type: 'getGame', requestId: 'r2', gameId });
    const [response] = responses;
    if (response?.type !== 'view') throw new Error('expected a view response');
    expect((response.view as View).gameId).toBe(gameId);
  });

  it('getGame emits an error response for an unknown id, echoing the requestId', () => {
    const handler = new GameWorkerHandler();
    const responses = collect(handler, { type: 'getGame', requestId: 'r1', gameId: 'nope' });
    expect(responses).toEqual([{ type: 'error', requestId: 'r1', message: 'jogo não encontrado' }]);
  });

  it('submitAction streams one moveApplied per move, then a single sequenceComplete', () => {
    const handler = new GameWorkerHandler();
    const created = collect(handler, { type: 'createGame', requestId: 'r1', playerCount: 2, seed: 7 })[0];
    if (created?.type !== 'view') throw new Error('expected a view response');
    const view = created.view as View;
    const gameId = view.gameId;
    const index = view.legalActions[0]?.index;
    if (index === undefined) throw new Error('unreachable: fresh game has no legal actions');

    const responses = collect(handler, { type: 'submitAction', requestId: 'r2', gameId, index });

    expect(responses.length).toBeGreaterThan(1);
    expect(responses.every((r) => r.requestId === 'r2')).toBe(true);
    expect(responses[responses.length - 1]).toEqual({ type: 'sequenceComplete', requestId: 'r2' });
    const moves = responses.filter((r): r is Extract<WorkerResponse, { type: 'moveApplied' }> => r.type === 'moveApplied');
    expect(moves.length).toBeGreaterThan(0);
    expect(moves[0]?.playerId).toBe('você');
  });

  it('submitAction emits a single error response for an invalid action index', () => {
    const handler = new GameWorkerHandler();
    const created = collect(handler, { type: 'createGame', requestId: 'r1', playerCount: 2, seed: 1 })[0];
    if (created?.type !== 'view') throw new Error('expected a view response');
    const gameId = (created.view as View).gameId;

    const responses = collect(handler, { type: 'submitAction', requestId: 'r2', gameId, index: 999 });
    expect(responses).toEqual([{ type: 'error', requestId: 'r2', message: 'índice de ação inválido' }]);
  });

  it('keeps separate games separate across requests against the same handler instance', () => {
    const handler = new GameWorkerHandler();
    const first = collect(handler, { type: 'createGame', requestId: 'r1', playerCount: 2, seed: 1 })[0];
    const second = collect(handler, { type: 'createGame', requestId: 'r2', playerCount: 2, seed: 2 })[0];
    if (first?.type !== 'view' || second?.type !== 'view') throw new Error('expected view responses');
    expect((first.view as View).gameId).not.toBe((second.view as View).gameId);
  });
});
