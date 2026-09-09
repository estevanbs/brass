import type { GameState } from '../../core/types.js';
import type { NetworkAction } from '../action-types.js';
import { LINK_SLOTS } from '../../rules/board-data.js';
import { discardCard, getPlayerOrThrow, payMoney, updatePlayer } from '../player-ops.js';
import { applyFlip, consumeBeer, consumeCoal, validateCoalSource } from '../resources.js';
import { hasAnyTilesOnBoard, isInNetwork } from '../network.js';

const LINK_SLOT_BY_ID = new Map(LINK_SLOTS.map((l) => [l.id, l]));

function getLinkSlotOrThrow(slotId: string) {
  const def = LINK_SLOT_BY_ID.get(slotId);
  if (def === undefined) {
    throw new Error(`unknown link slot: ${slotId}`);
  }
  return def;
}

function validateLinkPlaceable(state: GameState, player: string, slotId: string): void {
  if (state.links.some((l) => l.slotId === slotId)) {
    throw new Error(`link slot ${slotId} is already built`);
  }
  const def = getLinkSlotOrThrow(slotId);
  const [a, b] = def.locations;
  const adjacentToNetwork = isInNetwork(state, player, a) || isInNetwork(state, player, b);
  if (!adjacentToNetwork && hasAnyTilesOnBoard(state, player)) {
    throw new Error(`link slot ${slotId} is not adjacent to ${player}'s network`);
  }
}

function placeLink(state: GameState, player: string, slotId: string): GameState {
  return { ...state, links: [...state.links, { slotId, owner: player, kind: state.era }] };
}

export function applyNetworkAction(state: GameState, action: NetworkAction): GameState {
  const player = getPlayerOrThrow(state, action.player);
  const linkCount = action.linkSlotIds.length;

  if (linkCount === 2 && state.era !== 'rail') {
    throw new Error('building 2 links in a single action is only allowed in the rail era');
  }
  if (player.linkTilesRemaining < linkCount) {
    throw new Error(`${action.player} does not have enough link tiles remaining`);
  }

  const firstSlotId = action.linkSlotIds[0];
  validateLinkPlaceable(state, action.player, firstSlotId);
  let working = placeLink(state, action.player, firstSlotId);
  let totalCost: number;

  if (linkCount === 1) {
    if (state.era === 'canal') {
      totalCost = 3;
    } else {
      const coalSource = action.coalSources[0];
      if (coalSource === undefined) {
        throw new Error('a rail link requires exactly one coal source');
      }
      const firstSlotDef = getLinkSlotOrThrow(firstSlotId);
      const referenceLocation = firstSlotDef.locations[0];
      validateCoalSource(working, referenceLocation, coalSource);
      const result = consumeCoal(working, coalSource);
      working = applyFlip(result.state, result.flipped);
      totalCost = 5 + result.cost;
    }
  } else {
    const secondSlotId = action.linkSlotIds[1];
    const coal1 = action.coalSources[0];
    const coal2 = action.coalSources[1];
    if (secondSlotId === undefined || coal1 === undefined || coal2 === undefined) {
      throw new Error('building 2 rail links requires 2 link slots and 2 coal sources');
    }
    if (action.beerSource === null) {
      throw new Error('building 2 rail links in one action requires 1 beer from a brewery');
    }
    if (action.beerSource.kind !== 'brewery') {
      throw new Error('beer for a double network action cannot come from a merchant');
    }

    const firstSlotDef = getLinkSlotOrThrow(firstSlotId);
    validateCoalSource(working, firstSlotDef.locations[0], coal1);
    const r1 = consumeCoal(working, coal1);
    working = applyFlip(r1.state, r1.flipped);

    validateLinkPlaceable(working, action.player, secondSlotId);
    working = placeLink(working, action.player, secondSlotId);
    const secondSlotDef = getLinkSlotOrThrow(secondSlotId);

    const beerResult = consumeBeer(working, action.player, action.beerSource, secondSlotDef.locations[0]);
    working = applyFlip(beerResult.state, beerResult.flipped);

    validateCoalSource(working, secondSlotDef.locations[0], coal2);
    const r2 = consumeCoal(working, coal2);
    working = applyFlip(r2.state, r2.flipped);

    totalCost = 15 + r1.cost + r2.cost;
  }

  working = payMoney(working, action.player, totalCost);
  working = updatePlayer(working, action.player, (p) => ({
    ...p,
    linkTilesRemaining: p.linkTilesRemaining - linkCount,
  }));
  working = discardCard(working, action.player, action.card);
  return working;
}
