import { describe, expect, it } from 'vitest';
import { INDUSTRIAL_LOCATIONS } from '../../src/rules/board-data.js';
import { buildDrawDeck } from '../../src/rules/deck-data.js';

describe('deck-data', () => {
  it('builds a deck with 1/2/3 copies of each location card for 2/3/4 players', () => {
    for (const [playerCount, expectedCopies] of [
      [2, 1],
      [3, 2],
      [4, 3],
    ] as const) {
      const deck = buildDrawDeck(playerCount);
      for (const location of INDUSTRIAL_LOCATIONS) {
        const count = deck.filter(
          (c) => c.kind === 'location' && c.locationId === location.id,
        ).length;
        expect(count).toBe(expectedCopies);
      }
    }
  });

  it('builds a deck with 2/3/4 copies of each industry card for 2/3/4 players', () => {
    for (const [playerCount, expectedCopies] of [
      [2, 2],
      [3, 3],
      [4, 4],
    ] as const) {
      const deck = buildDrawDeck(playerCount);
      const industryCounts = new Map<string, number>();
      for (const card of deck) {
        if (card.kind === 'industry') {
          industryCounts.set(card.industry, (industryCounts.get(card.industry) ?? 0) + 1);
        }
      }
      for (const count of industryCounts.values()) {
        expect(count).toBe(expectedCopies);
      }
      expect(industryCounts.size).toBe(6);
    }
  });

  it('rejects player counts outside 2-4', () => {
    expect(() => buildDrawDeck(1)).toThrow(RangeError);
    expect(() => buildDrawDeck(5)).toThrow(RangeError);
  });

  it('total deck size matches location + industry card totals', () => {
    const deck = buildDrawDeck(4);
    expect(deck).toHaveLength(18 * 3 + 6 * 4);
  });
});
