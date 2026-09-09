import { describe, expect, it } from 'vitest';
import { actionsAllowedThisTurn, applyAction } from '../../src/engine/apply-action.js';
import { anyCard, stateWithHand } from '../helpers/fixtures.js';

describe('actionsAllowedThisTurn', () => {
  it('is 1 during the first round of the canal era, 2 otherwise', () => {
    expect(actionsAllowedThisTurn(makeStateAt('canal', 1))).toBe(1);
    expect(actionsAllowedThisTurn(makeStateAt('canal', 2))).toBe(2);
    expect(actionsAllowedThisTurn(makeStateAt('rail', 1))).toBe(2);
  });
});

function makeStateAt(era: 'canal' | 'rail', round: number) {
  return { ...stateWithHand('p1', []), era, round };
}

describe('applyAction', () => {
  it('applies a pass action, discarding the card and incrementing actionsTakenThisTurn', () => {
    const card = anyCard();
    const state = stateWithHand('p1', [card]);
    const result = applyAction(state, { type: 'pass', player: 'p1', card });
    expect(result.players['p1']?.hand).toHaveLength(0);
    expect(result.actionsTakenThisTurn).toBe(1);
  });

  it('rejects an action from a player who is not currently active', () => {
    const card = anyCard();
    const state = stateWithHand('p2', [card]);
    expect(() => applyAction(state, { type: 'pass', player: 'p2', card })).toThrow(/not p2's turn/);
  });

  it('rejects a 3rd action attempt in the same turn', () => {
    const card = anyCard();
    const state = { ...stateWithHand('p1', [card]), actionsTakenThisTurn: 2 };
    expect(() => applyAction(state, { type: 'pass', player: 'p1', card })).toThrow(/already taken/);
  });

  it('only allows 1 action in the first round of the canal era', () => {
    const card = anyCard();
    const state = { ...stateWithHand('p1', [card]), round: 1, actionsTakenThisTurn: 1 };
    expect(() => applyAction(state, { type: 'pass', player: 'p1', card })).toThrow(/already taken/);
  });

  it('rejects any action once the game is over', () => {
    const card = anyCard();
    const state = { ...stateWithHand('p1', [card]), gameOver: true };
    expect(() => applyAction(state, { type: 'pass', player: 'p1', card })).toThrow(/game has ended/);
  });

  it('does not mutate the input state', () => {
    const card = anyCard();
    const state = stateWithHand('p1', [card]);
    const before = JSON.stringify(state);
    applyAction(state, { type: 'pass', player: 'p1', card });
    expect(JSON.stringify(state)).toBe(before);
  });
});
