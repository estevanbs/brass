import {
  incomeLevelForPosition,
  type Action,
  type Card,
  type GameState,
  type IndustryType,
  type PlayerId,
} from '@brass/backend-domain';

export function cardLabel(card: Card): string {
  if (card.kind === 'location') return `Local(${card.locationId})`;
  if (card.kind === 'industry') return `Indústria(${card.industry})`;
  if (card.kind === 'wildLocation') return 'Local curinga';
  return 'Indústria curinga';
}

export const INDUSTRY_LABEL: Readonly<Record<IndustryType, string>> = {
  coal: 'mina de carvão',
  iron: 'siderúrgica',
  cotton: 'tecelagem',
  manufacturer: 'manufatura',
  pottery: 'cerâmica',
  brewery: 'cervejaria',
};

function coalSourceLabel(source: { kind: 'mine' | 'market'; locationId?: string; slotIndex?: number } | null): string {
  if (source === null) return '';
  if (source.kind === 'market') return ' [carvão do mercado]';
  return ` [carvão de ${source.locationId}]`;
}

function ironSourceLabel(source: { kind: 'works' | 'market'; locationId?: string } | null): string {
  if (source === null) return '';
  if (source.kind === 'market') return ' [ferro do mercado]';
  return ` [ferro de ${source.locationId}]`;
}

export function describeAction(action: Action): string {
  switch (action.type) {
    case 'build':
      return (
        `Construir ${INDUSTRY_LABEL[action.industry]} em ${action.locationId} (slot ${action.slotIndex})` +
        coalSourceLabel(action.coalSource) +
        ironSourceLabel(action.ironSource) +
        ` — carta ${cardLabel(action.card)}`
      );
    case 'network': {
      const links = action.linkSlotIds.join(', ');
      const beer = action.beerSource !== null ? ' + 1 cerveja' : '';
      return `Rede: construir link(s) ${links}${beer} — carta ${cardLabel(action.card)}`;
    }
    case 'develop':
      return `Desenvolver ${action.industries.map((i) => INDUSTRY_LABEL[i]).join(' + ')} — carta ${cardLabel(action.card)}`;
    case 'sell':
      return `Vender ${action.sales.map((s) => `${s.locationId}[${s.slotIndex}]`).join(', ')} — carta ${cardLabel(action.card)}`;
    case 'loan':
      return `Empréstimo (+£30, renda -3 níveis) — carta ${cardLabel(action.card)}`;
    case 'scout':
      return `Explorar (descarta 3, recebe curingas) — cartas ${action.cards.map(cardLabel).join(', ')}`;
    case 'pass':
      return `Passar — carta ${cardLabel(action.card)}`;
  }
}

export function renderMarket(state: GameState): string {
  return `Mercado: carvão ${state.market.coalCubes}/14 cubos | ferro ${state.market.ironCubes}/10 cubos`;
}

export function renderBoard(state: GameState): string {
  const lines: string[] = [];
  lines.push(`=== Era ${state.era === 'canal' ? 'Canal' : 'Ferrovia'} — rodada ${state.round}/${state.roundsPerEra} ===`);
  lines.push(renderMarket(state));
  lines.push('');
  lines.push('-- Localidades --');
  for (const location of Object.values(state.locations).sort((a, b) => a.id.localeCompare(b.id))) {
    if (location.kind === 'market') continue;
    const slotDescriptions = location.slots.map((slot, i) => {
      if (slot.tile === null) return `[${i}:${slot.allowedIndustries.join('/')} vazio]`;
      const tile = slot.tile;
      const flip = tile.flipped ? 'virada' : `${tile.resourceRemaining}un.`;
      return `[${i}:${tile.owner} ${INDUSTRY_LABEL[tile.industry]} L${tile.level} ${flip}]`;
    });
    lines.push(`${location.id}: ${slotDescriptions.join(' ')}`);
  }
  lines.push('');
  lines.push('-- Links construídos --');
  if (state.links.length === 0) {
    lines.push('(nenhum)');
  } else {
    for (const link of state.links) {
      lines.push(`${link.slotId} (${link.kind}, ${link.owner})`);
    }
  }
  return lines.join('\n');
}

export function renderPlayer(state: GameState, playerId: PlayerId): string {
  const player = state.players[playerId];
  if (player === undefined) return `(jogador desconhecido: ${playerId})`;
  const lines: string[] = [];
  lines.push(
    `${playerId}: £${player.money} | VP ${player.victoryPoints} | renda nível ${incomeLevelForPosition(player.incomeTrackPosition)} | links restantes ${player.linkTilesRemaining}`,
  );
  lines.push(`Mão (${player.hand.length}): ${player.hand.map(cardLabel).join(', ') || '(vazia)'}`);
  const stockSummary = Object.entries(player.industryStock)
    .map(([industry, stock]) => `${industry}:${stock.length}`)
    .join(' ');
  lines.push(`Estoque restante: ${stockSummary}`);
  return lines.join('\n');
}

export function renderScoreboard(state: GameState): string {
  const lines: string[] = ['=== Placar ==='];
  const sorted = Object.values(state.players).sort((a, b) => b.victoryPoints - a.victoryPoints);
  for (const player of sorted) {
    lines.push(`${player.id}: ${player.victoryPoints} VP (£${player.money}, renda nível ${incomeLevelForPosition(player.incomeTrackPosition)})`);
  }
  return lines.join('\n');
}
