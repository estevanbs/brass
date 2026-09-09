import { describe, expect, it } from 'vitest';
import { INDUSTRIAL_LOCATIONS } from '../../src/rules/board-data.js';
import { buildDrawDeck } from '../../src/rules/deck-data.js';

describe('deck-data', () => {
  it('builds each location card with exactly the copy count from IndustrialLocationDef.deckCopies, for 2/3/4 players', () => {
    for (const [playerCount, index] of [
      [2, 0],
      [3, 1],
      [4, 2],
    ] as const) {
      const deck = buildDrawDeck(playerCount);
      for (const location of INDUSTRIAL_LOCATIONS) {
        const count = deck.filter(
          (c) => c.kind === 'location' && c.locationId === location.id,
        ).length;
        expect(count).toBe(location.deckCopies[index]);
      }
    }
  });

  it('omits every gated location card below its first-appearing player count (docs/ASSUMPTIONS.md #22)', () => {
    const twoPlayerDeck = buildDrawDeck(2);
    const threePlayerDeck = buildDrawDeck(3);
    const fourPlayerDeck = buildDrawDeck(4);
    const hasLocation = (deck: readonly { kind: string }[] | ReturnType<typeof buildDrawDeck>, id: string) =>
      deck.some((c) => c.kind === 'location' && 'locationId' in c && c.locationId === id);

    // Absent at 2p, present from 3p on.
    expect(hasLocation(twoPlayerDeck, 'stoke_on_trent')).toBe(false);
    expect(hasLocation(threePlayerDeck, 'stoke_on_trent')).toBe(true);
    // Absent below 4p.
    expect(hasLocation(twoPlayerDeck, 'belper')).toBe(false);
    expect(hasLocation(threePlayerDeck, 'belper')).toBe(false);
    expect(hasLocation(fourPlayerDeck, 'belper')).toBe(true);
    // No restriction: always in the deck.
    expect(hasLocation(twoPlayerDeck, 'birmingham')).toBe(true);
    // kidderminster/worcester are NOT gated — an earlier reconstruction from the board's banner
    // colors alone wrongly gated them behind 3+ players; the printed reference card corrected it.
    expect(hasLocation(twoPlayerDeck, 'kidderminster')).toBe(true);
    expect(hasLocation(twoPlayerDeck, 'worcester')).toBe(true);
    // uttoxeter's own copy count still grows from 3p (1 copy) to 4p (2 copies).
    expect(threePlayerDeck.filter((c) => c.kind === 'location' && c.locationId === 'uttoxeter')).toHaveLength(1);
    expect(fourPlayerDeck.filter((c) => c.kind === 'location' && c.locationId === 'uttoxeter')).toHaveLength(2);
  });

  it('builds each industry card with exactly the copy count printed on the reference card, for 2/3/4 players', () => {
    const expected: Readonly<Record<string, readonly [number, number, number]>> = {
      coal: [2, 2, 3],
      iron: [4, 4, 4],
      cotton: [0, 6, 8],
      manufacturer: [0, 6, 8],
      pottery: [2, 2, 3],
      brewery: [5, 5, 5],
    };
    for (const [playerCount, index] of [
      [2, 0],
      [3, 1],
      [4, 2],
    ] as const) {
      const deck = buildDrawDeck(playerCount);
      const industryCounts = new Map<string, number>();
      for (const card of deck) {
        if (card.kind === 'industry') {
          industryCounts.set(card.industry, (industryCounts.get(card.industry) ?? 0) + 1);
        }
      }
      for (const [industry, copies] of Object.entries(expected)) {
        expect(industryCounts.get(industry) ?? 0).toBe(copies[index]);
      }
    }
  });

  it('rejects player counts outside 2-4', () => {
    expect(() => buildDrawDeck(1)).toThrow(RangeError);
    expect(() => buildDrawDeck(5)).toThrow(RangeError);
  });

  it('total deck size matches the sum of every location/industry copy count, per player count', () => {
    const industryTotals: Readonly<Record<number, number>> = { 2: 4 + 2 + 0 + 0 + 2 + 5, 3: 4 + 2 + 6 + 6 + 2 + 5, 4: 4 + 3 + 8 + 8 + 3 + 5 };
    for (const [playerCount, index] of [
      [2, 0],
      [3, 1],
      [4, 2],
    ] as const) {
      const deck = buildDrawDeck(playerCount);
      const locationTotal = INDUSTRIAL_LOCATIONS.reduce((sum, l) => sum + l.deckCopies[index], 0);
      expect(deck).toHaveLength(locationTotal + (industryTotals[playerCount] ?? 0));
    }
  });
});
