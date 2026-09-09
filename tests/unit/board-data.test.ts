import { describe, expect, it } from 'vitest';
import {
  ALL_LOCATION_IDS,
  FARM_BREWERIES,
  INDUSTRIAL_LOCATIONS,
  LINK_SLOTS,
  MARKETS,
} from '../../src/rules/board-data.js';

describe('board-data', () => {
  it('has the expected number of locations of each kind', () => {
    expect(INDUSTRIAL_LOCATIONS).toHaveLength(20);
    expect(MARKETS).toHaveLength(5);
    expect(FARM_BREWERIES).toHaveLength(2);
    expect(ALL_LOCATION_IDS).toHaveLength(27);
  });

  it('has unique location ids across all kinds', () => {
    expect(new Set(ALL_LOCATION_IDS).size).toBe(ALL_LOCATION_IDS.length);
  });

  it('has the expected number of link slots', () => {
    expect(LINK_SLOTS).toHaveLength(30);
  });

  it('has unique link slot ids', () => {
    const ids = LINK_SLOTS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every link slot connects two known locations', () => {
    for (const link of LINK_SLOTS) {
      for (const loc of link.locations) {
        expect(ALL_LOCATION_IDS).toContain(loc);
      }
      for (const bonus of link.bonusConnections) {
        for (const loc of bonus) {
          expect(ALL_LOCATION_IDS).toContain(loc);
        }
      }
    }
  });

  it('every industrial location has 2-4 build slots with at least one allowed industry each', () => {
    for (const loc of INDUSTRIAL_LOCATIONS) {
      expect(loc.slots.length).toBeGreaterThanOrEqual(2);
      expect(loc.slots.length).toBeLessThanOrEqual(4);
      for (const slot of loc.slots) {
        expect(slot.length).toBeGreaterThan(0);
      }
    }
  });

  it('the kidderminster-worcester link is the only one with bonus connections, linking farm_brewery_south', () => {
    const special = LINK_SLOTS.filter((l) => l.bonusConnections.length > 0);
    expect(special).toHaveLength(1);
    expect(special[0]?.locations).toEqual(['kidderminster', 'worcester']);
    expect(special[0]?.bonusConnections).toEqual([
      ['kidderminster', 'farm_brewery_south'],
      ['worcester', 'farm_brewery_south'],
    ]);
  });

  it('farm_brewery_north is only connected via its link to cannock', () => {
    const linksTouchingFarmNorth = LINK_SLOTS.filter((l) =>
      l.locations.includes('farm_brewery_north'),
    );
    expect(linksTouchingFarmNorth).toHaveLength(1);
    expect(linksTouchingFarmNorth[0]?.locations).toContain('cannock');
  });

  it('every location is reachable from every other location (board is connected)', () => {
    const adjacency = new Map<string, Set<string>>();
    for (const id of ALL_LOCATION_IDS) {
      adjacency.set(id, new Set());
    }
    for (const link of LINK_SLOTS) {
      const [a, b] = link.locations;
      adjacency.get(a)?.add(b);
      adjacency.get(b)?.add(a);
      for (const [x, y] of link.bonusConnections) {
        adjacency.get(x)?.add(y);
        adjacency.get(y)?.add(x);
      }
    }
    const start = ALL_LOCATION_IDS[0];
    if (start === undefined) throw new Error('no locations defined');
    const visited = new Set<string>([start]);
    const queue = [start];
    while (queue.length > 0) {
      const current = queue.pop();
      if (current === undefined) continue;
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    expect(visited.size).toBe(ALL_LOCATION_IDS.length);
  });

  it('markets have the min-player thresholds documented in RULES.md', () => {
    const byId = new Map(MARKETS.map((m) => [m.id, m]));
    expect(byId.get('warrington')?.minPlayers).toBe(5);
    expect(byId.get('nottingham')?.minPlayers).toBe(3);
    expect(byId.get('shrewsbury')?.minPlayers).toBe(4);
    expect(byId.get('gloucester')?.minPlayers).toBe(2);
    expect(byId.get('oxford')?.minPlayers).toBe(2);
  });

  it('industrial locations have the deck-card min-player thresholds read from the board\'s banner colors', () => {
    const byId = new Map(INDUSTRIAL_LOCATIONS.map((l) => [l.id, l]));
    for (const id of ['stoke_on_trent', 'stone', 'leek', 'uttoxeter', 'kidderminster', 'worcester']) {
      expect(byId.get(id)?.deckMinPlayers).toBe(3);
    }
    for (const id of ['belper', 'derby']) {
      expect(byId.get(id)?.deckMinPlayers).toBe(4);
    }
    const unrestrictedIds = [...byId.values()].filter((l) => l.deckMinPlayers === 2);
    expect(unrestrictedIds).toHaveLength(INDUSTRIAL_LOCATIONS.length - 8);
  });

  it('every link slot has an era of canal, rail, or both', () => {
    for (const link of LINK_SLOTS) {
      expect(['canal', 'rail', 'both']).toContain(link.era);
    }
  });
});
