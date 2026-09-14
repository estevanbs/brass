import type { GameState, IndustryType, PlayerId } from '../../core/types.js';
import { INDUSTRY_TYPES } from '../../core/types.js';
import type { BuildAction } from '../action-types.js';
import type { CoalSource, IronSource } from '../resources.js';
import { findConnectedCoalMines, findIronWorks, noResourceCubesAnywhere } from '../resources.js';
import { isConnectedToCoalMerchant, hasAnyTilesOnBoard, locationsInNetwork } from '../network.js';
import { getIndustryTile } from '../../rules/industry-data.js';
import { distinctCards } from '../cards.js';

function industrialLocationIds(state: GameState): string[] {
  return Object.values(state.locations)
    .filter((l) => l.kind === 'industrial')
    .map((l) => l.id);
}

/** Industrial locations plus the 2 farm breweries — only industry/wildIndustry cards may
 * target the latter (docs/RULES.md §4.1, farm breweries have no location card). */
function buildableLocationIds(state: GameState): string[] {
  return Object.values(state.locations)
    .filter((l) => l.kind === 'industrial' || l.kind === 'farm_brewery')
    .map((l) => l.id);
}

/** Empty-slot candidates (applying the single-icon-slot priority rule) plus valid overbuild
 * targets, for building `industry` at `newLevel` in `location`. */
function candidateSlots(
  state: GameState,
  locationId: string,
  industry: IndustryType,
  playerId: PlayerId,
  newLevel: number,
): number[] {
  const location = state.locations[locationId];
  if (location === undefined) return [];

  const emptyForIndustry = location.slots
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.tile === null && s.allowedIndustries.includes(industry));
  const singleIcon = emptyForIndustry.filter(({ s }) => s.allowedIndustries.length === 1);
  const emptyCandidates = (singleIcon.length > 0 ? singleIcon : emptyForIndustry).map(({ i }) => i);

  const overbuildCandidates: number[] = [];
  location.slots.forEach((slot, i) => {
    if (slot.tile === null) return;
    if (slot.tile.owner === playerId) {
      if (slot.tile.industry === industry && newLevel > slot.tile.level) overbuildCandidates.push(i);
    } else if (industry === 'coal' || industry === 'iron') {
      if (slot.tile.industry === industry && noResourceCubesAnywhere(state, industry)) {
        overbuildCandidates.push(i);
      }
    }
  });

  if (state.era === 'canal' && location.slots.some((s) => s.tile !== null)) {
    return overbuildCandidates;
  }
  return [...emptyCandidates, ...overbuildCandidates];
}

/** Per docs/RULES.md §6.1: coal must come from the nearest connected unflipped mine, but a tie
 * among several equally-near mines is the player's own free choice (docs/ASSUMPTIONS.md #8/#11)
 * — so every tied mine is offered as its own candidate, the same way iron works already are
 * below, rather than collapsed to one canonical pick. The UI surfaces this as a click on the
 * mine tile itself, not just a differently-worded popup button. */
function coalSourceOptions(state: GameState, locationId: string, coalCost: number): (CoalSource | null)[] {
  if (coalCost === 0) return [null];
  const mines = findConnectedCoalMines(state, locationId);
  if (mines.length > 0) {
    const nearest = mines[0];
    if (nearest === undefined) return [];
    const tied = mines.filter((m) => m.distance === nearest.distance);
    return tied.map((m) => ({ kind: 'mine', locationId: m.locationId, slotIndex: m.slotIndex }) as const);
  }
  return isConnectedToCoalMerchant(state, locationId) ? [{ kind: 'market' }] : [];
}

function ironSourceOptions(state: GameState, ironCost: number): (IronSource | null)[] {
  if (ironCost === 0) return [null];
  const works = findIronWorks(state);
  if (works.length > 0) {
    return works.map((w) => ({ kind: 'works', locationId: w.locationId, slotIndex: w.slotIndex }) as const);
  }
  return [{ kind: 'market' }];
}

function locationsReachableFor(
  state: GameState,
  playerId: PlayerId,
  requiresNetwork: boolean,
  candidateIds: string[],
): string[] {
  if (!requiresNetwork || !hasAnyTilesOnBoard(state, playerId)) {
    return candidateIds;
  }
  const network = locationsInNetwork(state, playerId);
  return candidateIds.filter((id) => network.has(id));
}

export function generateBuildActions(state: GameState, playerId: PlayerId): BuildAction[] {
  const player = state.players[playerId];
  if (player === undefined) return [];
  const actions: BuildAction[] = [];

  for (const card of distinctCards(player.hand)) {
    const isLocationCard = card.kind === 'location' || card.kind === 'wildLocation';
    const locationIds =
      card.kind === 'location'
        ? [card.locationId]
        : locationsReachableFor(
            state,
            playerId,
            !isLocationCard,
            isLocationCard ? industrialLocationIds(state) : buildableLocationIds(state),
          );
    const industries: readonly IndustryType[] = card.kind === 'industry' ? [card.industry] : INDUSTRY_TYPES;

    for (const locationId of locationIds) {
      for (const industry of industries) {
        const stock = player.industryStock[industry];
        const level = stock[0];
        if (level === undefined) continue;
        const tileDef = getIndustryTile(industry, level);
        if (tileDef.eraRestricted && state.era === 'rail') continue;
        if (tileDef.cost > player.money) continue; // cheapest possible cost is already unaffordable

        const slots = candidateSlots(state, locationId, industry, playerId, level);
        if (slots.length === 0) continue;

        const coalOptions = coalSourceOptions(state, locationId, tileDef.coalCost);
        const ironOptions = ironSourceOptions(state, tileDef.ironCost);
        if (coalOptions.length === 0 || ironOptions.length === 0) continue;

        for (const slotIndex of slots) {
          for (const coalSource of coalOptions) {
            for (const ironSource of ironOptions) {
              actions.push({
                type: 'build',
                player: playerId,
                card,
                locationId,
                slotIndex,
                industry,
                coalSource: coalSource ?? null,
                ironSource: ironSource ?? null,
              });
            }
          }
        }
      }
    }
  }

  return actions;
}
