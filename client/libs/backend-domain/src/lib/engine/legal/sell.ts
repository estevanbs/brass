import type { GameState, IndustryType, PlayerId } from '../../core/types.js';
import type { SellAction, SellTileSpec } from '../action-types.js';
import type { BeerSource } from '../resources.js';
import { areConnected } from '../network.js';
import { getIndustryTile } from '../../rules/industry-data.js';
import { distinctCards } from '../cards.js';

const SELLABLE_INDUSTRIES: readonly IndustryType[] = ['cotton', 'manufacturer', 'pottery'];
/** Above this many simultaneously-sellable tiles, only single-tile and sell-everything
 * subsets are generated instead of the full power set (docs/ASSUMPTIONS.md #11). */
const FULL_SUBSET_CAP = 4;
/** Above this many tiles in a subset, each tile gets one representative beer assignment
 * instead of the full cross-product of every source combination (docs/ASSUMPTIONS.md #11). */
const FULL_BEER_CROSS_PRODUCT_CAP = 2;

interface SellableTile {
  readonly locationId: string;
  readonly slotIndex: number;
  readonly industry: IndustryType;
  readonly beerNeeded: number;
}

function findSellableTiles(state: GameState, playerId: PlayerId): SellableTile[] {
  const result: SellableTile[] = [];
  for (const location of Object.values(state.locations)) {
    if (location.kind === 'market') continue;
    location.slots.forEach((slot, slotIndex) => {
      const tile = slot.tile;
      if (
        tile !== null &&
        tile.owner === playerId &&
        !tile.flipped &&
        SELLABLE_INDUSTRIES.includes(tile.industry) &&
        hasConnectedMerchant(state, location.id, tile.industry)
      ) {
        result.push({
          locationId: location.id,
          slotIndex,
          industry: tile.industry,
          beerNeeded: getIndustryTile(tile.industry, tile.level).beerToSell,
        });
      }
    });
  }
  return result;
}

function hasConnectedMerchant(state: GameState, locationId: string, industry: IndustryType): boolean {
  for (const location of Object.values(state.locations)) {
    if (location.kind !== 'market') continue;
    if (!location.merchantSlots.some((s) => s.icon === industry || s.icon === 'wild')) continue;
    if (areConnected(state, locationId, location.id)) return true;
  }
  return false;
}

function developableIndustries(state: GameState, playerId: PlayerId): IndustryType[] {
  const player = state.players[playerId];
  if (player === undefined) return [];
  const result: IndustryType[] = [];
  for (const [industry, stock] of Object.entries(player.industryStock) as [IndustryType, readonly number[]][]) {
    const level = stock[0];
    if (level === undefined) continue;
    if (!getIndustryTile(industry, level as 1 | 2 | 3 | 4).locked) result.push(industry);
  }
  return result;
}

function beerSourcesFor(state: GameState, playerId: PlayerId, atLocationId: string): BeerSource[] {
  const sources: BeerSource[] = [];
  const develops = developableIndustries(state, playerId);
  for (const location of Object.values(state.locations)) {
    if (location.kind === 'market') {
      location.merchantSlots.forEach((slot, merchantSlotIndex) => {
        if (!slot.hasBeer || !areConnected(state, atLocationId, location.id)) return;
        if (location.bonus.kind === 'develop') {
          for (const choice of develops) {
            sources.push({ kind: 'merchant', marketId: location.id, merchantSlotIndex, developChoice: choice });
          }
          sources.push({ kind: 'merchant', marketId: location.id, merchantSlotIndex, developChoice: null });
        } else {
          sources.push({ kind: 'merchant', marketId: location.id, merchantSlotIndex, developChoice: null });
        }
      });
      continue;
    }
    location.slots.forEach((slot, slotIndex) => {
      const tile = slot.tile;
      if (tile === null || tile.industry !== 'brewery' || tile.flipped || tile.resourceRemaining <= 0) return;
      if (tile.owner === playerId || areConnected(state, atLocationId, location.id)) {
        sources.push({ kind: 'brewery', locationId: location.id, slotIndex });
      }
    });
  }
  return sources;
}

function beerCombosFor(sources: readonly BeerSource[], count: number): BeerSource[][] {
  if (count === 0) return [[]];
  if (sources.length === 0) return [];
  if (count === 1) return sources.map((s) => [s]);
  const combos: BeerSource[][] = [];
  for (const first of sources) {
    for (const rest of beerCombosFor(sources, count - 1)) {
      combos.push([first, ...rest]);
    }
  }
  return combos;
}

function subsetsUpTo(tiles: readonly SellableTile[]): SellableTile[][] {
  if (tiles.length === 0) return [];
  if (tiles.length > FULL_SUBSET_CAP) {
    const singles = tiles.map((t) => [t]);
    return [...singles, tiles.slice()];
  }
  const result: SellableTile[][] = [];
  const n = tiles.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    const subset: SellableTile[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        const t = tiles[i];
        if (t !== undefined) subset.push(t);
      }
    }
    result.push(subset);
  }
  return result;
}

export function generateSellActions(state: GameState, playerId: PlayerId): SellAction[] {
  const player = state.players[playerId];
  if (player === undefined) return [];
  const sellable = findSellableTiles(state, playerId);
  if (sellable.length === 0) return [];

  const actions: SellAction[] = [];
  const cards = distinctCards(player.hand);
  const subsets = subsetsUpTo(sellable);

  for (const subset of subsets) {
    const perTileOptions: SellTileSpec[][] = subset.map((tile) => {
      const sources = beerSourcesFor(state, playerId, tile.locationId);
      const combos = subset.length > FULL_BEER_CROSS_PRODUCT_CAP ? combos1(sources, tile.beerNeeded) : beerCombosFor(sources, tile.beerNeeded);
      return combos.map((beerSources) => ({ locationId: tile.locationId, slotIndex: tile.slotIndex, beerSources }));
    });
    if (perTileOptions.some((opts) => opts.length === 0)) continue;

    for (const sales of cartesianProduct(perTileOptions)) {
      for (const card of cards) {
        actions.push({ type: 'sell', player: playerId, card, sales });
      }
    }
  }

  return actions;
}

function combos1(sources: readonly BeerSource[], count: number): BeerSource[][] {
  if (count === 0) return [[]];
  const combo = sources.slice(0, count);
  return combo.length === count ? [combo] : [];
}

function cartesianProduct<T>(lists: readonly T[][]): T[][] {
  return lists.reduce<T[][]>(
    (acc, list) => acc.flatMap((prefix) => list.map((item) => [...prefix, item])),
    [[]],
  );
}
