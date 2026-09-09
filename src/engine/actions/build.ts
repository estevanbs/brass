import type { BuiltIndustryTile, GameState } from '../../core/types.js';
import type { BuildAction } from '../action-types.js';
import { getIndustryTile } from '../../rules/industry-data.js';
import {
  discardCard,
  getPlayerOrThrow,
  payMoney,
  receiveMoney,
  removeLowestStockTile,
} from '../player-ops.js';
import {
  applyFlip,
  consumeCoal,
  consumeIron,
  noResourceCubesAnywhere,
  validateCoalSource,
  validateIronSource,
} from '../resources.js';
import { hasAnyTilesOnBoard, isConnectedToCoalMerchant, isInNetwork } from '../network.js';
import { sellCoalToMarket, sellIronToMarket } from '../market.js';

function requireNetworkOrException(state: GameState, action: BuildAction): void {
  if (isInNetwork(state, action.player, action.locationId)) return;
  if (!hasAnyTilesOnBoard(state, action.player)) return;
  throw new Error(`${action.locationId} is not part of ${action.player}'s network`);
}

export function applyBuild(state: GameState, action: BuildAction): GameState {
  const player = getPlayerOrThrow(state, action.player);
  const location = state.locations[action.locationId];
  if (location === undefined) {
    throw new Error(`unknown location: ${action.locationId}`);
  }
  if (location.kind === 'market') {
    throw new Error('cannot build at a market location');
  }

  const card = action.card;
  if (card.kind === 'location') {
    if (location.kind === 'farm_brewery') {
      throw new Error('farm breweries cannot be targeted with a location card');
    }
    if (card.locationId !== action.locationId) {
      throw new Error('location card does not match the target location');
    }
  } else if (card.kind === 'wildLocation') {
    if (location.kind === 'farm_brewery') {
      throw new Error('a wild location card cannot target a farm brewery');
    }
  } else if (card.kind === 'industry') {
    if (card.industry !== action.industry) {
      throw new Error('industry card does not match the industry being built');
    }
    requireNetworkOrException(state, action);
  } else {
    requireNetworkOrException(state, action);
  }

  const stock = player.industryStock[action.industry];
  const level = stock[0];
  if (level === undefined) {
    throw new Error(`${action.player} has no ${action.industry} tiles left`);
  }
  const tileDef = getIndustryTile(action.industry, level);
  if (tileDef.eraRestricted && state.era === 'rail') {
    throw new Error(
      `${action.industry} level ${level} can only be built in the canal era and must now be removed via Develop`,
    );
  }

  const slot = location.slots[action.slotIndex];
  if (slot === undefined) {
    throw new Error(`invalid slot index ${action.slotIndex} at ${action.locationId}`);
  }
  if (!slot.allowedIndustries.includes(action.industry)) {
    throw new Error(`slot ${action.slotIndex} at ${action.locationId} does not accept ${action.industry}`);
  }

  const targetOccupied = slot.tile !== null;
  // Canal era: at most 1 tile per location *per player* — other players may already occupy a
  // different slot at the same location (docs/RULES.md §4.1: "pode ter uma indústria no mesmo
  // local que outros jogadores").
  const ownOccupiedCount = location.slots.filter((s) => s.tile?.owner === action.player).length;
  if (state.era === 'canal' && !targetOccupied && ownOccupiedCount >= 1) {
    throw new Error(`${action.player} already has an industry tile at ${action.locationId} this era (canal era limit)`);
  }

  if (!targetOccupied) {
    const singleIconSlotAvailable = location.slots.some(
      (s, i) =>
        s.tile === null &&
        s.allowedIndustries.length === 1 &&
        s.allowedIndustries[0] === action.industry &&
        i !== action.slotIndex,
    );
    if (
      singleIconSlotAvailable &&
      !(slot.allowedIndustries.length === 1 && slot.allowedIndustries[0] === action.industry)
    ) {
      throw new Error(
        `must build in the single-industry slot for ${action.industry} at ${action.locationId} when one is free`,
      );
    }
  }

  if (targetOccupied) {
    const existing = slot.tile;
    if (existing === null) throw new Error('unreachable');
    if (existing.owner === action.player) {
      if (existing.industry !== action.industry) {
        throw new Error('can only overbuild your own tile with the same industry type');
      }
      if (level <= existing.level) {
        throw new Error('overbuilding requires a higher level tile than the one being replaced');
      }
    } else {
      if (action.industry !== 'coal' && action.industry !== 'iron') {
        throw new Error("can only overbuild an opponent's coal mine or iron works");
      }
      if (existing.industry !== action.industry) {
        throw new Error('industry mismatch for opponent overbuild');
      }
      if (!noResourceCubesAnywhere(state, action.industry)) {
        throw new Error(
          `cannot overbuild opponent's ${action.industry}: cubes of that resource remain on the board or market`,
        );
      }
    }
  }

  let working = state;
  let totalCost = tileDef.cost;

  if (tileDef.coalCost > 0) {
    if (action.coalSource === null) {
      throw new Error('this tile requires coal but no coal source was provided');
    }
    validateCoalSource(working, action.locationId, action.coalSource);
    const result = consumeCoal(working, action.coalSource);
    working = applyFlip(result.state, result.flipped);
    totalCost += result.cost;
  }
  if (tileDef.ironCost > 0) {
    if (action.ironSource === null) {
      throw new Error('this tile requires iron but no iron source was provided');
    }
    validateIronSource(working, action.ironSource);
    const result = consumeIron(working, action.ironSource);
    working = applyFlip(result.state, result.flipped);
    totalCost += result.cost;
  }

  working = payMoney(working, action.player, totalCost);
  working = removeLowestStockTile(working, action.player, action.industry).state;

  const resourceRemaining =
    action.industry === 'brewery'
      ? state.era === 'canal'
        ? 1
        : 2
      : tileDef.resourceProduced;

  const newTile: BuiltIndustryTile = {
    owner: action.player,
    industry: action.industry,
    level,
    flipped: false,
    resourceRemaining,
  };

  const currentLocation = working.locations[action.locationId];
  if (currentLocation === undefined) throw new Error('unreachable');
  const currentSlot = currentLocation.slots[action.slotIndex];
  if (currentSlot === undefined) throw new Error('unreachable');
  const newSlots = currentLocation.slots.slice();
  newSlots[action.slotIndex] = { ...currentSlot, tile: newTile };
  working = {
    ...working,
    locations: { ...working.locations, [action.locationId]: { ...currentLocation, slots: newSlots } },
  };

  if (action.industry === 'coal' && isConnectedToCoalMerchant(working, action.locationId)) {
    working = sellNewlyBuiltResource(working, action.locationId, action.slotIndex, 'coal');
  } else if (action.industry === 'iron') {
    working = sellNewlyBuiltResource(working, action.locationId, action.slotIndex, 'iron');
  }

  working = discardCard(working, action.player, card);
  return working;
}

function sellNewlyBuiltResource(
  state: GameState,
  locationId: string,
  slotIndex: number,
  industry: 'coal' | 'iron',
): GameState {
  const location = state.locations[locationId];
  if (location === undefined) throw new Error('unreachable');
  const slot = location.slots[slotIndex];
  const tile = slot?.tile;
  if (slot === undefined || tile === null || tile === undefined) throw new Error('unreachable');

  const sale =
    industry === 'coal'
      ? sellCoalToMarket(state.market.coalCubes, tile.resourceRemaining)
      : sellIronToMarket(state.market.ironCubes, tile.resourceRemaining);
  if (sale.revenue === 0 && sale.newCubes === (industry === 'coal' ? state.market.coalCubes : state.market.ironCubes)) {
    return state;
  }

  const soldUnits = tile.resourceRemaining - sale.unsold;
  const flippedNow = sale.unsold === 0 && soldUnits > 0;
  const newSlots = location.slots.slice();
  newSlots[slotIndex] = {
    ...slot,
    tile: { ...tile, resourceRemaining: sale.unsold, flipped: flippedNow },
  };
  let working: GameState = {
    ...state,
    market:
      industry === 'coal'
        ? { ...state.market, coalCubes: sale.newCubes }
        : { ...state.market, ironCubes: sale.newCubes },
    locations: { ...state.locations, [locationId]: { ...location, slots: newSlots } },
  };
  working = receiveMoney(working, tile.owner, sale.revenue);
  if (flippedNow) {
    working = applyFlip(working, { owner: tile.owner, industry, level: tile.level });
  }
  return working;
}
