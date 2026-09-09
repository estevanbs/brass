import type { GameState, PlayerId } from '../../core/types.js';
import type { NetworkAction } from '../action-types.js';
import { LINK_SLOTS } from '../../rules/board-data.js';
import type { CoalSource } from '../resources.js';
import { findConnectedCoalMines } from '../resources.js';
import { hasAnyTilesOnBoard, locationsInNetwork } from '../network.js';
import { distinctCards } from '../cards.js';

function undevelopedSlotIds(state: GameState): string[] {
  const built = new Set(state.links.map((l) => l.slotId));
  return LINK_SLOTS.filter((s) => !built.has(s.id)).map((s) => s.id);
}

function slotEndpoints(slotId: string): readonly [string, string] {
  const def = LINK_SLOTS.find((s) => s.id === slotId);
  if (def === undefined) throw new Error(`unknown link slot: ${slotId}`);
  return def.locations;
}

function coalOptionsAt(state: GameState, referenceLocationId: string): CoalSource[] {
  const mines = findConnectedCoalMines(state, referenceLocationId);
  if (mines.length > 0) {
    return mines.map((m) => ({ kind: 'mine' as const, locationId: m.locationId, slotIndex: m.slotIndex }));
  }
  return [{ kind: 'market' }];
}

/**
 * Broad but pruned candidate generation — the caller (legal-actions/index.ts) verifies every
 * candidate by actually applying it, so over-generating is safe, just wasteful. Pruning here
 * targets the one real combinatorial risk (docs/PLANO.md M4): the double rail-link action,
 * whose naive O(slots²) pairing is cut down to slots individually reachable from the
 * player's current network — see docs/ASSUMPTIONS.md #11 for what this slightly
 * under-approximates.
 */
export function generateNetworkActions(state: GameState, playerId: PlayerId): NetworkAction[] {
  const player = state.players[playerId];
  if (player === undefined) return [];
  const actions: NetworkAction[] = [];
  const allSlotIds = undevelopedSlotIds(state);
  const cards = distinctCards(player.hand);
  const network = locationsInNetwork(state, playerId);
  const unrestricted = !hasAnyTilesOnBoard(state, playerId);

  const reachableSlotIds = allSlotIds.filter((id) => {
    if (unrestricted) return true;
    const [a, b] = slotEndpoints(id);
    return network.has(a) || network.has(b);
  });

  for (const card of cards) {
    for (const slotId of reachableSlotIds) {
      if (state.era === 'canal') {
        actions.push({ type: 'network', player: playerId, card, linkSlotIds: [slotId], coalSources: [], beerSource: null });
        continue;
      }
      const [ref] = slotEndpoints(slotId);
      for (const coal of coalOptionsAt(state, ref)) {
        actions.push({
          type: 'network',
          player: playerId,
          card,
          linkSlotIds: [slotId],
          coalSources: [coal],
          beerSource: null,
        });
      }
    }
  }

  if (state.era === 'rail') {
    const breweries: { kind: 'brewery'; locationId: string; slotIndex: number }[] = [];
    for (const location of Object.values(state.locations)) {
      location.slots.forEach((slot, slotIndex) => {
        if (
          slot.tile !== null &&
          slot.tile.industry === 'brewery' &&
          !slot.tile.flipped &&
          slot.tile.resourceRemaining > 0
        ) {
          breweries.push({ kind: 'brewery', locationId: location.id, slotIndex });
        }
      });
    }

    for (const card of cards) {
      for (const slotA of reachableSlotIds) {
        const [aStart, aEnd] = slotEndpoints(slotA);
        const networkAfterA = new Set(network);
        networkAfterA.add(aStart);
        networkAfterA.add(aEnd);
        const slotBCandidates = allSlotIds.filter((id) => {
          if (id === slotA) return false;
          const [b1, b2] = slotEndpoints(id);
          return networkAfterA.has(b1) || networkAfterA.has(b2);
        });

        for (const slotB of slotBCandidates) {
          const [refA] = slotEndpoints(slotA);
          const [refB] = slotEndpoints(slotB);
          const coalOptionsA = coalOptionsAt(state, refA);
          const coalOptionsB = coalOptionsAt(state, refB);
          for (const beer of breweries) {
            for (const c1 of coalOptionsA) {
              for (const c2 of coalOptionsB) {
                actions.push({
                  type: 'network',
                  player: playerId,
                  card,
                  linkSlotIds: [slotA, slotB],
                  coalSources: [c1, c2],
                  beerSource: beer,
                });
              }
            }
          }
        }
      }
    }
  }

  return actions;
}
