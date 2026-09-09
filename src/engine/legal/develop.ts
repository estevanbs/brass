import type { GameState, IndustryType, PlayerId } from '../../core/types.js';
import { INDUSTRY_TYPES } from '../../core/types.js';
import type { DevelopAction } from '../action-types.js';
import type { IronSource } from '../resources.js';
import { findIronWorks } from '../resources.js';
import { getIndustryTile } from '../../rules/industry-data.js';
import { distinctCards } from '../cards.js';

function developableIndustries(state: GameState, playerId: PlayerId): IndustryType[] {
  const player = state.players[playerId];
  if (player === undefined) return [];
  return INDUSTRY_TYPES.filter((industry) => {
    const level = player.industryStock[industry][0];
    return level !== undefined && !getIndustryTile(industry, level).locked;
  });
}

function ironOptions(state: GameState): IronSource[] {
  const works = findIronWorks(state);
  if (works.length > 0) {
    return works.map((w) => ({ kind: 'works' as const, locationId: w.locationId, slotIndex: w.slotIndex }));
  }
  return [{ kind: 'market' }];
}

export function generateDevelopActions(state: GameState, playerId: PlayerId): DevelopAction[] {
  const player = state.players[playerId];
  if (player === undefined) return [];
  const industries = developableIndustries(state, playerId);
  if (industries.length === 0) return [];

  const actions: DevelopAction[] = [];
  const cards = distinctCards(player.hand);
  const iron = ironOptions(state);

  for (const card of cards) {
    for (const industry of industries) {
      for (const ironSource of iron) {
        actions.push({ type: 'develop', player: playerId, card, industries: [industry], ironSources: [ironSource] });
      }
    }

    for (let i = 0; i < industries.length; i++) {
      for (let j = i; j < industries.length; j++) {
        const a = industries[i];
        const b = industries[j];
        if (a === undefined || b === undefined) continue;
        for (const iron1 of iron) {
          for (const iron2 of iron) {
            actions.push({
              type: 'develop',
              player: playerId,
              card,
              industries: [a, b],
              ironSources: [iron1, iron2],
            });
          }
        }
      }
    }
  }

  return actions;
}
