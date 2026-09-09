import {
  INDUSTRY_TYPES,
  FARM_BREWERIES,
  INDUSTRIAL_LOCATIONS,
  MARKETS,
  initialIndustryStock,
  type BuildSlotState,
  type BuiltIndustryTile,
  type Card,
  type GameState,
  type IndustryType,
  type LocationState,
  type MarketLocationState,
  type PlayerId,
  type PlayerState,
} from '@brass/backend-domain';

/** Fresh board with no tiles built and no merchant tiles assigned (deterministic — no RNG).
 * Individual tests override specific locations/slots as needed. */
export function emptyLocations(): Record<string, LocationState> {
  const locations: Record<string, LocationState> = {};
  for (const def of [...INDUSTRIAL_LOCATIONS, ...FARM_BREWERIES]) {
    const slots: BuildSlotState[] = def.slots.map((allowedIndustries) => ({
      allowedIndustries,
      tile: null,
    }));
    locations[def.id] = { id: def.id, kind: def.kind, slots };
  }
  for (const def of MARKETS) {
    const market: MarketLocationState = {
      id: def.id,
      kind: 'market',
      slots: [],
      bonus: def.bonus,
      merchantSlots: Array.from({ length: def.merchantSlotCount }, () => ({
        icon: null,
        hasBeer: false,
      })),
    };
    locations[def.id] = market;
  }
  return locations;
}

export function withTile(
  locations: Record<string, LocationState>,
  locationId: string,
  slotIndex: number,
  tile: BuiltIndustryTile | null,
): Record<string, LocationState> {
  const location = locations[locationId];
  if (location === undefined) throw new Error(`unknown location ${locationId}`);
  const slots = location.slots.slice();
  const slot = slots[slotIndex];
  if (slot === undefined) throw new Error(`unknown slot ${slotIndex} at ${locationId}`);
  slots[slotIndex] = { ...slot, tile };
  return { ...locations, [locationId]: { ...location, slots } };
}

export function withMerchant(
  locations: Record<string, LocationState>,
  marketId: string,
  slotIndex: number,
  icon: 'cotton' | 'manufacturer' | 'pottery' | 'wild',
  hasBeer = true,
): Record<string, LocationState> {
  const location = locations[marketId];
  if (location === undefined || location.kind !== 'market') {
    throw new Error(`unknown market ${marketId}`);
  }
  const merchantSlots = location.merchantSlots.slice();
  const slot = merchantSlots[slotIndex];
  if (slot === undefined) throw new Error(`unknown merchant slot ${slotIndex} at ${marketId}`);
  merchantSlots[slotIndex] = { ...slot, icon, hasBeer };
  return { ...locations, [marketId]: { ...location, merchantSlots } };
}

export function tile(
  owner: PlayerId,
  industry: IndustryType,
  level: 1 | 2 | 3 | 4,
  resourceRemaining = 0,
  flipped = false,
): BuiltIndustryTile {
  return { owner, industry, level, flipped, resourceRemaining };
}

export function makePlayer(id: PlayerId, overrides: Partial<PlayerState> = {}): PlayerState {
  const industryStock = {} as Record<IndustryType, readonly (1 | 2 | 3 | 4)[]>;
  for (const industry of INDUSTRY_TYPES) {
    industryStock[industry] = initialIndustryStock(industry);
  }
  return {
    id,
    money: 30,
    spentThisRound: 0,
    incomeTrackPosition: 10,
    victoryPoints: 0,
    linkTilesRemaining: 14,
    industryStock,
    hand: [],
    discardPile: [],
    ...overrides,
  };
}

const ANY_CARD: Card = { kind: 'wildLocation' };

export function makeState(overrides: Partial<GameState> = {}): GameState {
  const players: Record<PlayerId, PlayerState> = {
    p1: makePlayer('p1', { hand: [ANY_CARD] }),
    p2: makePlayer('p2', { hand: [ANY_CARD] }),
  };
  return {
    era: 'canal',
    round: 2,
    roundsPerEra: 8,
    turnOrder: ['p1', 'p2'],
    activePlayerIndex: 0,
    actionsTakenThisTurn: 0,
    players,
    locations: emptyLocations(),
    links: [],
    market: { coalCubes: 13, ironCubes: 8 },
    drawDeck: [],
    wildLocationCards: 2,
    wildIndustryCards: 2,
    rngState: 1,
    gameOver: false,
    ...overrides,
  };
}

export function anyCard(): Card {
  return { ...ANY_CARD };
}

/** A state whose given player's hand contains exactly `hand` (in order), so those cards can
 * legally be discarded by an action under test. */
export function stateWithHand(
  playerId: PlayerId,
  hand: readonly Card[],
  overrides: Partial<GameState> = {},
): GameState {
  const base = makeState(overrides);
  return {
    ...base,
    players: {
      ...base.players,
      [playerId]: makePlayer(playerId, { ...base.players[playerId], hand: hand.slice() }),
    },
  };
}
