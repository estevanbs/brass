import type { GameState, IndustryType, MerchantBonus } from '../../core/types.js';
import type { SellAction } from '../action-types.js';
import { getIndustryTile } from '../../rules/industry-data.js';
import { bfsDistances } from '../network.js';
import { applyFlip, consumeBeer } from '../resources.js';
import {
  addVictoryPoints,
  applyIncomeGain,
  discardCard,
  getPlayerOrThrow,
  receiveMoney,
  removeLowestStockTile,
} from '../player-ops.js';

const SELLABLE_INDUSTRIES: readonly IndustryType[] = ['cotton', 'manufacturer', 'pottery'];

function hasConnectedMerchantFor(state: GameState, locationId: string, industry: IndustryType): boolean {
  const distances = bfsDistances(state, locationId);
  for (const location of Object.values(state.locations)) {
    if (location.kind !== 'market' || !distances.has(location.id)) continue;
    if (location.merchantSlots.some((s) => s.icon === industry || s.icon === 'wild')) {
      return true;
    }
  }
  return false;
}

function applyMerchantBonus(
  state: GameState,
  player: string,
  bonus: MerchantBonus,
  developChoice: IndustryType | null,
): GameState {
  if (bonus.kind === 'money') return receiveMoney(state, player, bonus.amount);
  if (bonus.kind === 'income') return applyIncomeGain(state, player, bonus.spaces);
  if (bonus.kind === 'victoryPoints') return addVictoryPoints(state, player, bonus.amount);

  // bonus.kind === 'develop'
  if (developChoice === null) return state;
  const stock = getPlayerOrThrow(state, player).industryStock[developChoice];
  const level = stock[0];
  if (level === undefined) return state;
  const tileDef = getIndustryTile(developChoice, level);
  if (tileDef.locked) {
    throw new Error(`cannot use the Gloucester bonus to remove a locked ${developChoice} tile`);
  }
  return removeLowestStockTile(state, player, developChoice).state;
}

function flipSoldTile(state: GameState, locationId: string, slotIndex: number): GameState {
  const location = state.locations[locationId];
  const slot = location?.slots[slotIndex];
  const tile = slot?.tile;
  if (location === undefined || slot === undefined || tile === null || tile === undefined) {
    throw new Error('unreachable');
  }
  const newSlots = location.slots.slice();
  newSlots[slotIndex] = { ...slot, tile: { ...tile, flipped: true } };
  const newState = {
    ...state,
    locations: { ...state.locations, [locationId]: { ...location, slots: newSlots } },
  };
  return applyFlip(newState, { owner: tile.owner, industry: tile.industry, level: tile.level });
}

export function applySell(state: GameState, action: SellAction): GameState {
  let working = state;

  for (const sale of action.sales) {
    const location = working.locations[sale.locationId];
    if (location === undefined || location.kind === 'market') {
      throw new Error(`cannot sell at ${sale.locationId}`);
    }
    const slot = location.slots[sale.slotIndex];
    const tile = slot?.tile;
    if (slot === undefined || tile === null || tile === undefined) {
      throw new Error(`no tile to sell at ${sale.locationId}[${sale.slotIndex}]`);
    }
    if (tile.owner !== action.player) {
      throw new Error('cannot sell a tile you do not own');
    }
    if (tile.flipped) {
      throw new Error('tile is already sold');
    }
    if (!SELLABLE_INDUSTRIES.includes(tile.industry)) {
      throw new Error('only cotton mill, manufacturer, or pottery tiles can be sold');
    }
    if (!hasConnectedMerchantFor(working, sale.locationId, tile.industry)) {
      throw new Error(`${sale.locationId} is not connected to a merchant that buys ${tile.industry}`);
    }
    const tileDef = getIndustryTile(tile.industry, tile.level);
    if (sale.beerSources.length !== tileDef.beerToSell) {
      throw new Error(
        `selling this tile requires exactly ${tileDef.beerToSell} beer, got ${sale.beerSources.length}`,
      );
    }

    for (const beerSource of sale.beerSources) {
      const result = consumeBeer(working, action.player, beerSource, sale.locationId);
      working = applyFlip(result.state, result.flipped);
      if (result.merchantBonus !== null) {
        const developChoice = beerSource.kind === 'merchant' ? beerSource.developChoice : null;
        working = applyMerchantBonus(working, action.player, result.merchantBonus, developChoice);
      }
    }

    working = flipSoldTile(working, sale.locationId, sale.slotIndex);
  }

  working = discardCard(working, action.player, action.card);
  return working;
}
