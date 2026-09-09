import { describe, expect, it } from 'vitest';
import { applyScout } from '../../../src/lib/engine/actions/scout.js';
import type { Card } from '../../../src/lib/core/types.js';
import { stateWithHand } from '../../helpers/fixtures.js';

const THREE_CARDS: readonly [Card, Card, Card] = [
  { kind: 'location', locationId: 'birmingham' },
  { kind: 'industry', industry: 'coal' },
  { kind: 'location', locationId: 'dudley' },
];

describe('applyScout', () => {
  it('discards 3 cards and grants 1 wild location + 1 wild industry card', () => {
    const state = stateWithHand('p1', THREE_CARDS);
    const result = applyScout(state, { type: 'scout', player: 'p1', cards: THREE_CARDS });
    expect(result.players['p1']?.hand).toEqual([
      { kind: 'wildLocation' },
      { kind: 'wildIndustry' },
    ]);
    expect(result.players['p1']?.discardPile).toHaveLength(3);
  });

  it('decrements the shared wild card counters', () => {
    const state = stateWithHand('p1', THREE_CARDS, { wildLocationCards: 2, wildIndustryCards: 2 });
    const result = applyScout(state, { type: 'scout', player: 'p1', cards: THREE_CARDS });
    expect(result.wildLocationCards).toBe(1);
    expect(result.wildIndustryCards).toBe(1);
  });

  it('rejects scouting when no wild cards remain', () => {
    const state = stateWithHand('p1', THREE_CARDS, { wildLocationCards: 0, wildIndustryCards: 2 });
    expect(() => applyScout(state, { type: 'scout', player: 'p1', cards: THREE_CARDS })).toThrow(
      /no wild cards left/,
    );
  });

  it('rejects discarding a card not in hand', () => {
    const state = stateWithHand('p1', THREE_CARDS.slice(0, 2));
    expect(() => applyScout(state, { type: 'scout', player: 'p1', cards: THREE_CARDS })).toThrow(
      /not in p1's hand/,
    );
  });
});
