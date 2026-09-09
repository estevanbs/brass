import { describe, expect, it } from 'vitest';
import { INDUSTRIAL_LOCATIONS } from '../../src/rules/board-data.js';
import { buildDrawDeck } from '../../src/rules/deck-data.js';

describe('deck-data', () => {
  it('builds a deck with 1/2/3 copies of each location card whose deckMinPlayers is met, for 2/3/4 players', () => {
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
        expect(count).toBe(playerCount >= location.deckMinPlayers ? expectedCopies : 0);
      }
    }
  });

  it('omits every blue/teal-banner location card below its deckMinPlayers threshold (docs/HANDBOOK_RULES.md §2)', () => {
    const twoPlayerDeck = buildDrawDeck(2);
    const threePlayerDeck = buildDrawDeck(3);
    const fourPlayerDeck = buildDrawDeck(4);
    const hasLocation = (deck: readonly { kind: string }[] | ReturnType<typeof buildDrawDeck>, id: string) =>
      deck.some((c) => c.kind === 'location' && 'locationId' in c && c.locationId === id);

    // Blue banner: needs 3+.
    expect(hasLocation(twoPlayerDeck, 'stoke_on_trent')).toBe(false);
    expect(hasLocation(threePlayerDeck, 'stoke_on_trent')).toBe(true);
    // Teal banner: needs 4.
    expect(hasLocation(twoPlayerDeck, 'belper')).toBe(false);
    expect(hasLocation(threePlayerDeck, 'belper')).toBe(false);
    expect(hasLocation(fourPlayerDeck, 'belper')).toBe(true);
    // No banner restriction: always in the deck.
    expect(hasLocation(twoPlayerDeck, 'birmingham')).toBe(true);
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

  it('total deck size matches location + industry card totals — all 20 locations count at 4 players', () => {
    const deck = buildDrawDeck(4);
    expect(deck).toHaveLength(20 * 3 + 6 * 4);
  });

  it('total deck size at 2 players excludes the 8 blue/teal-banner locations\' cards', () => {
    const deck = buildDrawDeck(2);
    const restrictedCount = INDUSTRIAL_LOCATIONS.filter((l) => l.deckMinPlayers > 2).length;
    expect(restrictedCount).toBe(8); // 6 blue (3+) + 2 teal (4)
    const unrestrictedCount = INDUSTRIAL_LOCATIONS.length - restrictedCount;
    expect(deck).toHaveLength(unrestrictedCount * 1 + 6 * 2);
  });
});
