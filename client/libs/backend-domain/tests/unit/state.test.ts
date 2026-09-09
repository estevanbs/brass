import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  deserializeState,
  hashState,
  serializeState,
} from '../../src/lib/core/state.js';
import type { GameState } from '../../src/lib/core/types.js';

const PLAYERS_4 = ['alice', 'bob', 'carol', 'dave'];

describe('createInitialState', () => {
  it('rejects fewer than 2 or more than 4 players', () => {
    expect(() => createInitialState(['solo'], 1)).toThrow(RangeError);
    expect(() => createInitialState(['a', 'b', 'c', 'd', 'e'], 1)).toThrow(RangeError);
  });

  it('rejects duplicate player ids', () => {
    expect(() => createInitialState(['a', 'a'], 1)).toThrow();
  });

  it('is deterministic for a given seed', () => {
    const a = createInitialState(PLAYERS_4, 42);
    const b = createInitialState(PLAYERS_4, 42);
    expect(serializeState(a)).toEqual(serializeState(b));
  });

  it('produces different setups for different seeds', () => {
    const a = createInitialState(PLAYERS_4, 1);
    const b = createInitialState(PLAYERS_4, 2);
    expect(serializeState(a)).not.toEqual(serializeState(b));
  });

  it('gives every player the starting resources from RULES.md', () => {
    const state = createInitialState(PLAYERS_4, 7);
    for (const id of PLAYERS_4) {
      const player = state.players[id];
      expect(player).toBeDefined();
      expect(player?.money).toBe(17);
      expect(player?.incomeTrackPosition).toBe(10);
      expect(player?.victoryPoints).toBe(0);
      expect(player?.linkTilesRemaining).toBe(14);
      expect(player?.hand).toHaveLength(8);
      expect(player?.discardPile).toHaveLength(1);
    }
  });

  it('sets up the coal and iron markets per RULES.md §7', () => {
    const state = createInitialState(PLAYERS_4, 7);
    expect(state.market.coalCubes).toBe(13);
    expect(state.market.ironCubes).toBe(8);
  });

  it('sets roundsPerEra according to player count', () => {
    expect(createInitialState(['a', 'b'], 1).roundsPerEra).toBe(10);
    expect(createInitialState(['a', 'b', 'c'], 1).roundsPerEra).toBe(9);
    expect(createInitialState(['a', 'b', 'c', 'd'], 1).roundsPerEra).toBe(8);
  });

  it('deals hands without overlap and leaves the rest in the draw deck', () => {
    const state = createInitialState(PLAYERS_4, 99);
    const allDealt = Object.values(state.players).flatMap((p) => [...p.hand, ...p.discardPile]);
    // 4 players * 9 cards dealt = 36; deck started at 41 location + 31 industry = 72 (exact
    // per-location/per-industry copy counts from the game's own reference card, not a uniform
    // formula — see IndustrialLocationDef.deckCopies and INDUSTRY_CARD_COPIES).
    expect(allDealt).toHaveLength(36);
    expect(state.drawDeck).toHaveLength(72 - 36);
  });

  it('only creates merchant tiles at markets whose minPlayers threshold is met', () => {
    const twoPlayer = createInitialState(['a', 'b'], 5);
    const warrington = twoPlayer.locations['warrington'];
    if (warrington === undefined || warrington.kind !== 'market') {
      throw new Error('expected a market location');
    }
    const nottingham = twoPlayer.locations['nottingham'];
    if (nottingham === undefined || nottingham.kind !== 'market') {
      throw new Error('expected a market location');
    }
    expect(warrington.merchantSlots.every((s) => s.icon === null)).toBe(true);
    expect(nottingham.merchantSlots.every((s) => s.icon === null)).toBe(true);

    // Warrington needs 5 players (never met by this engine's supported 2-4 range, so it stays
    // empty at every currently-playable size — see docs/ASSUMPTIONS.md #1); Nottingham needs
    // only 3, so it's populated once the game reaches 4 players.
    const fourPlayer = createInitialState(PLAYERS_4, 5);
    const warrington4 = fourPlayer.locations['warrington'];
    if (warrington4 === undefined || warrington4.kind !== 'market') {
      throw new Error('expected a market location');
    }
    const nottingham4 = fourPlayer.locations['nottingham'];
    if (nottingham4 === undefined || nottingham4.kind !== 'market') {
      throw new Error('expected a market location');
    }
    expect(warrington4.merchantSlots.every((s) => s.icon === null)).toBe(true);
    expect(nottingham4.merchantSlots.some((s) => s.icon !== null)).toBe(true);
  });
});

describe('serializeState / deserializeState', () => {
  it('round-trips without loss and is idempotent', () => {
    const state = createInitialState(PLAYERS_4, 123);
    const json1 = serializeState(state);
    const restored = deserializeState(json1);
    const json2 = serializeState(restored);
    expect(json2).toEqual(json1);
    expect(restored).toEqual(state satisfies GameState);
  });
});

describe('hashState', () => {
  it('is equal for two independently-constructed but identical states', () => {
    const a = createInitialState(PLAYERS_4, 55);
    const b = createInitialState(PLAYERS_4, 55);
    expect(hashState(a)).toBe(hashState(b));
  });

  it('changes when any field of the state mutates', () => {
    const state = createInitialState(PLAYERS_4, 55);
    const baseHash = hashState(state);

    const moneyMutated: GameState = {
      ...state,
      players: {
        ...state.players,
        alice: { ...(state.players['alice'] as (typeof state.players)['alice']), money: 999 },
      },
    };
    expect(hashState(moneyMutated)).not.toBe(baseHash);

    const roundMutated: GameState = { ...state, round: state.round + 1 };
    expect(hashState(roundMutated)).not.toBe(baseHash);

    const deckMutated: GameState = { ...state, drawDeck: state.drawDeck.slice(1) };
    expect(hashState(deckMutated)).not.toBe(baseHash);
  });

  it('is independent of the insertion order of object keys', () => {
    const state = createInitialState(PLAYERS_4, 55);
    const reordered = Object.fromEntries(Object.entries(state).reverse()) as unknown as GameState;
    expect(hashState(reordered)).toBe(hashState(state));
  });
});
