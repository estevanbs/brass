import {
  applyAction,
  incomeLevelForPosition,
  type Action,
  type BeerSource,
  type CoalSource,
  type GameState,
  type IndustryType,
  type IronSource,
  type PlayerId,
  type PlayerState,
} from '@brass/backend-domain';
import { INDUSTRY_LABEL } from './render.js';

export interface CostLine {
  readonly label: string;
  readonly value: string;
}

/** Whoever's tile actually sits at `locationId[slotIndex]` right now — coal/iron/beer sources
 * can legally come from *any* player's tile (docs/RULES.md §6.1-§6.3), not just your own, so the
 * label must say whose it really is instead of assuming it's the acting player's. */
function tileOwnerLabel(state: GameState, actingPlayer: PlayerId, locationId: string, slotIndex: number): string {
  const owner = state.locations[locationId]?.slots[slotIndex]?.tile?.owner;
  if (owner === undefined) return '';
  return owner === actingPlayer ? ' (própria)' : ` (de ${owner})`;
}

function coalSourceLine(state: GameState, actingPlayer: PlayerId, source: CoalSource | null): CostLine | null {
  if (source === null) return null;
  if (source.kind === 'market') return { label: 'Carvão', value: 'do mercado' };
  const owner = tileOwnerLabel(state, actingPlayer, source.locationId, source.slotIndex);
  return { label: 'Carvão', value: `de ${source.locationId}${owner}` };
}

function ironSourceLine(state: GameState, actingPlayer: PlayerId, source: IronSource | null): CostLine | null {
  if (source === null) return null;
  if (source.kind === 'market') return { label: 'Ferro', value: 'do mercado' };
  const owner = tileOwnerLabel(state, actingPlayer, source.locationId, source.slotIndex);
  return { label: 'Ferro', value: `de ${source.locationId}${owner}` };
}

function beerSourceLine(state: GameState, actingPlayer: PlayerId, source: BeerSource | null): CostLine | null {
  if (source === null) return null;
  if (source.kind === 'brewery') {
    const owner = tileOwnerLabel(state, actingPlayer, source.locationId, source.slotIndex);
    return { label: 'Cerveja', value: `de ${source.locationId}${owner}` };
  }
  return { label: 'Cerveja', value: `mercador em ${source.marketId}` };
}

/** Which stock level of `industry` will actually be removed by the `n`-th time it appears in
 * a Develop action's `industries` tuple — needed because developing the same industry twice in
 * one action removes two different levels in sequence, not the same level twice. */
function nextStockLevel(player: PlayerState, industry: IndustryType, alreadyTaken: number): number | undefined {
  return player.industryStock[industry][alreadyTaken];
}

/**
 * "What this action will cost" for the confirmation box — computed by literally applying the
 * action to a scratch copy of the state and diffing money before/after, the same "trust the
 * real engine code, never a parallel formula" principle `legalActions` itself relies on (this
 * never reimplements the market's dynamic coal/iron pricing curve). Qualitative details (which
 * industry, which slot, which source) come straight from the action's own fields, which are
 * already exact on their own — no need to derive those from a diff.
 */
export function actionCostLines(before: GameState, action: Action): readonly CostLine[] {
  const player = before.players[action.player];
  if (player === undefined) return [];
  const after = applyAction(before, action);
  const afterPlayer = after.players[action.player];
  if (afterPlayer === undefined) return [];

  const lines: CostLine[] = [];
  const moneyDelta = afterPlayer.money - player.money;
  if (moneyDelta < 0) lines.push({ label: 'Dinheiro', value: `-£${-moneyDelta}` });
  else if (moneyDelta > 0) lines.push({ label: 'Dinheiro', value: `+£${moneyDelta}` });

  switch (action.type) {
    case 'build': {
      const level = player.industryStock[action.industry][0];
      if (level !== undefined) {
        lines.push({ label: 'Peça', value: `${INDUSTRY_LABEL[action.industry]} nível ${level}` });
      }
      const coal = coalSourceLine(before, action.player, action.coalSource);
      if (coal !== null) lines.push(coal);
      const iron = ironSourceLine(before, action.player, action.ironSource);
      if (iron !== null) lines.push(iron);
      break;
    }
    case 'network': {
      lines.push({
        label: action.linkSlotIds.length > 1 ? 'Links' : 'Link',
        value: action.linkSlotIds.join(', '),
      });
      for (const coal of action.coalSources) {
        const line = coalSourceLine(before, action.player, coal);
        if (line !== null) lines.push(line);
      }
      const beer = beerSourceLine(before, action.player, action.beerSource);
      if (beer !== null) lines.push(beer);
      break;
    }
    case 'develop': {
      const takenSoFar: Partial<Record<IndustryType, number>> = {};
      for (let i = 0; i < action.industries.length; i++) {
        const industry = action.industries[i];
        if (industry === undefined) continue;
        const alreadyTaken = takenSoFar[industry] ?? 0;
        takenSoFar[industry] = alreadyTaken + 1;
        const level = nextStockLevel(player, industry, alreadyTaken);
        if (level !== undefined) {
          lines.push({ label: 'Peça removida', value: `${INDUSTRY_LABEL[industry]} nível ${level}` });
        }
        const iron = ironSourceLine(before, action.player, action.ironSources[i] ?? null);
        if (iron !== null) lines.push(iron);
      }
      break;
    }
    case 'sell': {
      lines.push({
        label: action.sales.length > 1 ? 'Locais' : 'Local',
        value: action.sales.map((s) => `${s.locationId}[${s.slotIndex}]`).join(', '),
      });
      for (const sale of action.sales) {
        for (const beer of sale.beerSources) {
          const line = beerSourceLine(before, action.player, beer);
          if (line !== null) lines.push(line);
        }
      }
      break;
    }
    case 'loan': {
      const beforeLevel = incomeLevelForPosition(player.incomeTrackPosition);
      const afterLevel = incomeLevelForPosition(afterPlayer.incomeTrackPosition);
      lines.push({ label: 'Renda', value: `nível ${beforeLevel} → nível ${afterLevel}` });
      break;
    }
    case 'scout': {
      lines.push({ label: 'Descarta', value: `${action.cards.length} cartas da mão` });
      lines.push({ label: 'Recebe', value: '1 carta curinga de local + 1 de indústria' });
      break;
    }
    case 'pass':
      break;
  }

  return lines;
}
