import { describe, expect, it } from 'vitest';
import { applyLoan } from '../../../src/lib/engine/actions/loan.js';
import { highestPositionForLevel } from '../../../src/lib/engine/income.js';
import { anyCard, makePlayer, stateWithHand } from '../../helpers/fixtures.js';

describe('applyLoan', () => {
  it('grants £30 and drops income 3 levels, landing on the top of the new level', () => {
    const card = anyCard();
    const state = stateWithHand('p1', [card]);
    const result = applyLoan(state, { type: 'loan', player: 'p1', card });
    expect(result.players['p1']?.money).toBe(30 + 30);
    // starting position 10 -> level 0 -> level -3 -> highest position of level -3.
    expect(result.players['p1']?.incomeTrackPosition).toBe(highestPositionForLevel(-3));
  });

  it('discards the card', () => {
    const card = anyCard();
    const state = stateWithHand('p1', [card]);
    const result = applyLoan(state, { type: 'loan', player: 'p1', card });
    expect(result.players['p1']?.hand).toHaveLength(0);
  });

  it('rejects a loan that would drop the income level below -10', () => {
    const card = anyCard();
    let state = stateWithHand('p1', [card]);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: makePlayer('p1', { hand: [card], incomeTrackPosition: highestPositionForLevel(-9) }),
      },
    };
    expect(() => applyLoan(state, { type: 'loan', player: 'p1', card })).toThrow();
  });
});
