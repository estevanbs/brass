import type { Card, GameState, IndustryType, PlayerId, PlayerState } from '../core/types.js';
import { advanceIncomeSpaces } from './income.js';

export function getPlayerOrThrow(state: GameState, playerId: PlayerId): PlayerState {
  const player = state.players[playerId];
  if (player === undefined) {
    throw new Error(`unknown player: ${playerId}`);
  }
  return player;
}

export function updatePlayer(
  state: GameState,
  playerId: PlayerId,
  update: (player: PlayerState) => PlayerState,
): GameState {
  const player = getPlayerOrThrow(state, playerId);
  return { ...state, players: { ...state.players, [playerId]: update(player) } };
}

export function payMoney(state: GameState, playerId: PlayerId, amount: number): GameState {
  return updatePlayer(state, playerId, (p) => ({
    ...p,
    money: p.money - amount,
    spentThisRound: p.spentThisRound + amount,
  }));
}

export function receiveMoney(state: GameState, playerId: PlayerId, amount: number): GameState {
  return updatePlayer(state, playerId, (p) => ({ ...p, money: p.money + amount }));
}

export function applyIncomeGain(state: GameState, playerId: PlayerId, spaces: number): GameState {
  if (spaces <= 0) return state;
  return updatePlayer(state, playerId, (p) => ({
    ...p,
    incomeTrackPosition: advanceIncomeSpaces(p.incomeTrackPosition, spaces),
  }));
}

export function addVictoryPoints(state: GameState, playerId: PlayerId, amount: number): GameState {
  return updatePlayer(state, playerId, (p) => ({
    ...p,
    victoryPoints: Math.max(0, p.victoryPoints + amount),
  }));
}

function cardsEqual(a: Card, b: Card): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'location' && b.kind === 'location') return a.locationId === b.locationId;
  if (a.kind === 'industry' && b.kind === 'industry') return a.industry === b.industry;
  return true;
}

/** Removes `card` from the player's hand and places it on their discard pile — unless it is
 * a wild card, which instead returns to its always-visible draw pile (docs/RULES.md §4). */
export function discardCard(state: GameState, playerId: PlayerId, card: Card): GameState {
  const player = getPlayerOrThrow(state, playerId);
  const index = player.hand.findIndex((c) => cardsEqual(c, card));
  if (index === -1) {
    throw new Error(`card not in ${playerId}'s hand: ${JSON.stringify(card)}`);
  }
  const newHand = player.hand.slice();
  newHand.splice(index, 1);

  if (card.kind === 'wildLocation') {
    return updatePlayer(
      { ...state, wildLocationCards: state.wildLocationCards + 1 },
      playerId,
      (p) => ({ ...p, hand: newHand }),
    );
  }
  if (card.kind === 'wildIndustry') {
    return updatePlayer(
      { ...state, wildIndustryCards: state.wildIndustryCards + 1 },
      playerId,
      (p) => ({ ...p, hand: newHand }),
    );
  }
  return updatePlayer(state, playerId, (p) => ({
    ...p,
    hand: newHand,
    discardPile: [...p.discardPile, card],
  }));
}

export function removeLowestStockTile(
  state: GameState,
  playerId: PlayerId,
  industry: IndustryType,
): { readonly state: GameState; readonly level: 1 | 2 | 3 | 4 } {
  const player = getPlayerOrThrow(state, playerId);
  const stock = player.industryStock[industry];
  const level = stock[0];
  if (level === undefined) {
    throw new Error(`${playerId} has no ${industry} tiles left to build or develop`);
  }
  const newState = updatePlayer(state, playerId, (p) => ({
    ...p,
    industryStock: { ...p.industryStock, [industry]: p.industryStock[industry].slice(1) },
  }));
  return { state: newState, level };
}
