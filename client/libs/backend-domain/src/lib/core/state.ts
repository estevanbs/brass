import type { Rng } from './rng.js';
import { mulberry32 } from './rng.js';
import type {
  BuildSlotState,
  Card,
  GameState,
  IndustryType,
  LocationState,
  MerchantIcon,
  PlayerId,
  PlayerState,
} from './types.js';
import { INDUSTRY_TYPES } from './types.js';
import { FARM_BREWERIES, INDUSTRIAL_LOCATIONS, MARKETS } from '../rules/board-data.js';
import { buildDrawDeck } from '../rules/deck-data.js';
import { initialIndustryStock } from '../rules/industry-data.js';

const ROUNDS_PER_ERA: Readonly<Record<number, number>> = { 2: 10, 3: 9, 4: 8 };
const HAND_SIZE = 8;
const STARTING_MONEY = 17;
const STARTING_INCOME_POSITION = 10;
const STARTING_LINK_TILES = 14;
const STARTING_COAL_CUBES = 13;
const STARTING_IRON_CUBES = 8;

const MERCHANT_ICON_BAG_PATTERN: readonly MerchantIcon[] = [
  'cotton',
  'manufacturer',
  'pottery',
  'wild',
  'blank',
  'blank',
];

function buildMerchantIcons(rng: Rng, totalSlots: number): MerchantIcon[] {
  const bag: MerchantIcon[] = [];
  while (bag.length < totalSlots) {
    bag.push(...MERCHANT_ICON_BAG_PATTERN);
  }
  return rng.shuffle(bag).slice(0, totalSlots);
}

function buildIndustryStockRecord(): Record<IndustryType, readonly (1 | 2 | 3 | 4)[]> {
  const record = {} as Record<IndustryType, readonly (1 | 2 | 3 | 4)[]>;
  for (const industry of INDUSTRY_TYPES) {
    record[industry] = initialIndustryStock(industry);
  }
  return record;
}

function buildLocations(playerCount: number, rng: Rng): Record<string, LocationState> {
  const locations: Record<string, LocationState> = {};

  for (const def of INDUSTRIAL_LOCATIONS) {
    const slots: BuildSlotState[] = def.slots.map((allowedIndustries) => ({
      allowedIndustries,
      tile: null,
    }));
    locations[def.id] = { id: def.id, kind: 'industrial', slots };
  }

  for (const def of FARM_BREWERIES) {
    const slots: BuildSlotState[] = def.slots.map((allowedIndustries) => ({
      allowedIndustries,
      tile: null,
    }));
    locations[def.id] = { id: def.id, kind: 'farm_brewery', slots };
  }

  const qualifyingMarkets = MARKETS.filter((m) => playerCount >= m.minPlayers);
  const totalMerchantSlots = qualifyingMarkets.reduce((sum, m) => sum + m.merchantSlotCount, 0);
  const icons = buildMerchantIcons(rng, totalMerchantSlots);
  let iconCursor = 0;

  for (const def of MARKETS) {
    const qualifies = playerCount >= def.minPlayers;
    const merchantSlots = Array.from({ length: def.merchantSlotCount }, () => {
      if (!qualifies) {
        return { icon: null, hasBeer: false };
      }
      const icon = icons[iconCursor];
      iconCursor += 1;
      if (icon === undefined) {
        throw new Error('merchant icon bag exhausted unexpectedly');
      }
      return { icon, hasBeer: icon !== 'blank' };
    });
    locations[def.id] = {
      id: def.id,
      kind: 'market',
      slots: [],
      bonus: def.bonus,
      merchantSlots,
    };
  }

  return locations;
}

export function createInitialState(playerIds: readonly PlayerId[], seed: number): GameState {
  const playerCount = playerIds.length;
  if (playerCount < 2 || playerCount > 4) {
    throw new RangeError(`playerCount must be 2-4, got ${playerCount}`);
  }
  if (new Set(playerIds).size !== playerCount) {
    throw new Error('playerIds must be unique');
  }

  const rng = mulberry32(seed);

  const deck = rng.shuffle(buildDrawDeck(playerCount));
  const players: Record<PlayerId, PlayerState> = {};
  for (const id of playerIds) {
    const hand: Card[] = deck.splice(0, HAND_SIZE);
    const discardTop = deck.splice(0, 1);
    players[id] = {
      id,
      money: STARTING_MONEY,
      spentThisRound: 0,
      incomeTrackPosition: STARTING_INCOME_POSITION,
      victoryPoints: 0,
      linkTilesRemaining: STARTING_LINK_TILES,
      industryStock: buildIndustryStockRecord(),
      hand,
      discardPile: discardTop,
    };
  }

  const locations = buildLocations(playerCount, rng);
  const turnOrder = rng.shuffle(playerIds);
  const roundsPerEra = ROUNDS_PER_ERA[playerCount];
  if (roundsPerEra === undefined) {
    throw new Error(`no roundsPerEra defined for playerCount ${playerCount}`);
  }

  return {
    era: 'canal',
    round: 1,
    roundsPerEra,
    turnOrder,
    activePlayerIndex: 0,
    actionsTakenThisTurn: 0,
    players,
    locations,
    links: [],
    market: { coalCubes: STARTING_COAL_CUBES, ironCubes: STARTING_IRON_CUBES },
    drawDeck: deck,
    wildLocationCards: playerCount,
    wildIndustryCards: playerCount,
    rngState: rng.getState(),
    gameOver: false,
  };
}

export function serializeState(state: GameState): string {
  return JSON.stringify(state);
}

export function deserializeState(json: string): GameState {
  return JSON.parse(json) as GameState;
}

export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    const result: Record<string, unknown> = {};
    for (const [key, val] of entries) {
      result[key] = canonicalize(val);
    }
    return result;
  }
  return value;
}

/** Only a determinism-check fingerprint for tests ("two independently-built states with the
 * same content hash the same, regardless of key order"), never a security or save-integrity
 * digest — so a small dependency-free string hash (no cryptographic import, works identically
 * in Node and in a browser) is enough; no need for a real SHA-256. */
export function hashState(state: GameState): string {
  const canonicalJson = JSON.stringify(canonicalize(state));
  let h1 = 0xdeadbeef ^ canonicalJson.length;
  let h2 = 0x41c6ce57 ^ canonicalJson.length;
  for (let i = 0; i < canonicalJson.length; i++) {
    const ch = canonicalJson.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}
