import type { GameState, IndustryType, LocationState, MerchantBonus, PlayerId } from '../core/types.js';
import { areConnected, bfsDistances, isConnectedToCoalMerchant } from './network.js';
import { buyCoal, buyIron } from './market.js';
import { getIndustryTile } from '../rules/industry-data.js';
import { applyIncomeGain } from './player-ops.js';

export type CoalSource =
  | { readonly kind: 'mine'; readonly locationId: string; readonly slotIndex: number }
  | { readonly kind: 'market' };

export type IronSource =
  | { readonly kind: 'works'; readonly locationId: string; readonly slotIndex: number }
  | { readonly kind: 'market' };

export type BeerSource =
  | { readonly kind: 'brewery'; readonly locationId: string; readonly slotIndex: number }
  | {
      readonly kind: 'merchant';
      readonly marketId: string;
      readonly merchantSlotIndex: number;
      /** Which industry to develop for free if this merchant's bonus is `develop`; ignored
       * for every other bonus kind. */
      readonly developChoice: IndustryType | null;
    };

export interface FlippedTile {
  readonly owner: PlayerId;
  readonly industry: IndustryType;
  readonly level: 1 | 2 | 3 | 4;
}

function getLocationOrThrow(state: GameState, locationId: string): LocationState {
  const location = state.locations[locationId];
  if (location === undefined) {
    throw new Error(`unknown location: ${locationId}`);
  }
  return location;
}

function withUpdatedLocation(state: GameState, location: LocationState): GameState {
  return { ...state, locations: { ...state.locations, [location.id]: location } };
}

/** Applies the income bump for a tile that just flipped, if any (docs/RULES.md §5.1). */
export function applyFlip(state: GameState, flipped: FlippedTile | null): GameState {
  if (flipped === null) return state;
  const def = getIndustryTile(flipped.industry, flipped.level);
  return applyIncomeGain(state, flipped.owner, def.incomeGain);
}

/** Decrements a resource-bearing tile's stock by 1; flips it if that was the last unit.
 * Throws if the slot has no matching, unflipped, non-empty tile. */
function decrementTileResource(
  state: GameState,
  locationId: string,
  slotIndex: number,
  expectedIndustry: 'coal' | 'iron' | 'brewery',
): { state: GameState; flipped: FlippedTile | null } {
  const location = getLocationOrThrow(state, locationId);
  const slot = location.slots[slotIndex];
  if (slot === undefined) {
    throw new Error(`no slot ${slotIndex} at ${locationId}`);
  }
  const tile = slot.tile;
  if (tile === null) {
    throw new Error(`no tile at ${locationId}[${slotIndex}]`);
  }
  if (tile.industry !== expectedIndustry) {
    throw new Error(`expected a ${expectedIndustry} tile at ${locationId}[${slotIndex}]`);
  }
  if (tile.flipped || tile.resourceRemaining <= 0) {
    throw new Error(`tile at ${locationId}[${slotIndex}] has no resource left to consume`);
  }
  const remaining = tile.resourceRemaining - 1;
  const justFlipped = remaining === 0;
  const newSlots = location.slots.slice();
  newSlots[slotIndex] = {
    ...slot,
    tile: { ...tile, resourceRemaining: remaining, flipped: justFlipped },
  };
  const newLocation = { ...location, slots: newSlots };
  return {
    state: withUpdatedLocation(state, newLocation),
    flipped: justFlipped
      ? { owner: tile.owner, industry: tile.industry, level: tile.level }
      : null,
  };
}

export interface ResourceResult {
  readonly state: GameState;
  readonly cost: number;
  readonly flipped: FlippedTile | null;
}

/** docs/RULES.md §6.1. Buying from the market requires the caller to have already checked
 * connectivity to a merchant (network.ts#isConnectedToCoalMerchant) when no mine is available. */
export function consumeCoal(state: GameState, source: CoalSource): ResourceResult {
  if (source.kind === 'market') {
    const { cost, newCubes } = buyCoal(state.market.coalCubes);
    return {
      state: { ...state, market: { ...state.market, coalCubes: newCubes } },
      cost,
      flipped: null,
    };
  }
  const result = decrementTileResource(state, source.locationId, source.slotIndex, 'coal');
  return { state: result.state, cost: 0, flipped: result.flipped };
}

/** docs/RULES.md §6.2 — iron is global, no connectivity check needed. */
export function consumeIron(state: GameState, source: IronSource): ResourceResult {
  if (source.kind === 'market') {
    const { cost, newCubes } = buyIron(state.market.ironCubes);
    return {
      state: { ...state, market: { ...state.market, ironCubes: newCubes } },
      cost,
      flipped: null,
    };
  }
  const result = decrementTileResource(state, source.locationId, source.slotIndex, 'iron');
  return { state: result.state, cost: 0, flipped: result.flipped };
}

/** Finds the coal mines reachable from `fromLocationId`, closest first, that still have
 * unflipped coal remaining (docs/RULES.md §6.1 rule 1). */
export function findConnectedCoalMines(
  state: GameState,
  fromLocationId: string,
): { readonly locationId: string; readonly slotIndex: number; readonly distance: number }[] {
  const distances = bfsDistances(state, fromLocationId);
  const found: { locationId: string; slotIndex: number; distance: number }[] = [];
  for (const location of Object.values(state.locations)) {
    const distance = distances.get(location.id);
    if (distance === undefined) continue;
    location.slots.forEach((slot, slotIndex) => {
      const tile = slot.tile;
      if (tile !== null && tile.industry === 'coal' && !tile.flipped && tile.resourceRemaining > 0) {
        found.push({ locationId: location.id, slotIndex, distance });
      }
    });
  }
  found.sort((a, b) => a.distance - b.distance);
  return found;
}

/** Every unflipped, non-empty iron works on the board (iron has no connectivity requirement). */
export function findIronWorks(
  state: GameState,
): { readonly locationId: string; readonly slotIndex: number }[] {
  const found: { locationId: string; slotIndex: number }[] = [];
  for (const location of Object.values(state.locations)) {
    location.slots.forEach((slot, slotIndex) => {
      const tile = slot.tile;
      if (tile !== null && tile.industry === 'iron' && !tile.flipped && tile.resourceRemaining > 0) {
        found.push({ locationId: location.id, slotIndex });
      }
    });
  }
  return found;
}

/** docs/RULES.md §6.1: coal must come from the closest connected unflipped mine when one
 * exists; only once none are reachable may it be purchased from the market. */
export function validateCoalSource(state: GameState, fromLocationId: string, source: CoalSource): void {
  const mines = findConnectedCoalMines(state, fromLocationId);
  if (mines.length > 0) {
    const nearest = mines[0];
    if (nearest === undefined) throw new Error('unreachable');
    if (source.kind !== 'mine') {
      throw new Error('a connected coal mine is available; coal cannot be bought from the market');
    }
    const matches = mines.some(
      (m) =>
        m.distance === nearest.distance &&
        m.locationId === source.locationId &&
        m.slotIndex === source.slotIndex,
    );
    if (!matches) {
      throw new Error('coal source is not the closest connected unflipped coal mine');
    }
    return;
  }
  if (source.kind !== 'market') {
    throw new Error('no connected coal mine available; coal must be bought from the market');
  }
  if (!isConnectedToCoalMerchant(state, fromLocationId)) {
    throw new Error(`${fromLocationId} is not connected to any merchant; cannot buy coal`);
  }
}

/** docs/RULES.md §6.2: iron may come from any unflipped iron works while one exists (no
 * connectivity requirement); only once none exist may it be purchased from the market. */
export function validateIronSource(state: GameState, source: IronSource): void {
  const works = findIronWorks(state);
  if (works.length > 0) {
    if (source.kind !== 'works') {
      throw new Error('an iron works is available; iron cannot be bought from the market');
    }
    const matches = works.some(
      (w) => w.locationId === source.locationId && w.slotIndex === source.slotIndex,
    );
    if (!matches) {
      throw new Error('iron source is not a valid unflipped iron works');
    }
    return;
  }
  if (source.kind !== 'market') {
    throw new Error('no iron works available; iron must be bought from the market');
  }
}

/** True if there are zero cubes of `industry`'s resource anywhere — on the market or sitting
 * on any unflipped tile. Used by the overbuild rule for opponents' coal mines / iron works. */
export function noResourceCubesAnywhere(state: GameState, industry: 'coal' | 'iron'): boolean {
  const marketCubes = industry === 'coal' ? state.market.coalCubes : state.market.ironCubes;
  if (marketCubes > 0) return false;
  for (const location of Object.values(state.locations)) {
    for (const slot of location.slots) {
      const tile = slot.tile;
      if (tile !== null && tile.industry === industry && !tile.flipped && tile.resourceRemaining > 0) {
        return false;
      }
    }
  }
  return true;
}

export interface BeerResult {
  readonly state: GameState;
  readonly flipped: FlippedTile | null;
  readonly merchantBonus: MerchantBonus | null;
}

/** docs/RULES.md §6.3. `usageLocationId` is required when sourcing from an opponent's
 * brewery (must be connected) or a merchant (must be connected to sell there). */
export function consumeBeer(
  state: GameState,
  playerId: PlayerId,
  source: BeerSource,
  usageLocationId: string,
): BeerResult {
  if (source.kind === 'merchant') {
    const market = state.locations[source.marketId];
    if (market === undefined || market.kind !== 'market') {
      throw new Error(`unknown market: ${source.marketId}`);
    }
    const merchantSlot = market.merchantSlots[source.merchantSlotIndex];
    if (merchantSlot === undefined || !merchantSlot.hasBeer) {
      throw new Error(
        `no merchant beer available at ${source.marketId}[${source.merchantSlotIndex}]`,
      );
    }
    if (!areConnected(state, usageLocationId, source.marketId)) {
      throw new Error(`${usageLocationId} is not connected to merchant ${source.marketId}`);
    }
    const newMerchantSlots = market.merchantSlots.slice();
    newMerchantSlots[source.merchantSlotIndex] = { ...merchantSlot, hasBeer: false };
    const newState = withUpdatedLocation(state, { ...market, merchantSlots: newMerchantSlots });
    return { state: newState, flipped: null, merchantBonus: market.bonus };
  }

  const location = getLocationOrThrow(state, source.locationId);
  const slot = location.slots[source.slotIndex];
  const tile = slot?.tile;
  if (slot === undefined || tile === null || tile === undefined || tile.industry !== 'brewery') {
    throw new Error(`no brewery tile at ${source.locationId}[${source.slotIndex}]`);
  }
  if (tile.owner !== playerId && !areConnected(state, usageLocationId, source.locationId)) {
    throw new Error(
      `opponent brewery at ${source.locationId} is not connected to ${usageLocationId}`,
    );
  }
  const result = decrementTileResource(state, source.locationId, source.slotIndex, 'brewery');
  return { state: result.state, flipped: result.flipped, merchantBonus: null };
}
