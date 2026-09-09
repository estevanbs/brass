import type { Card, GameState, PlayerId } from '../core/types.js';
import type { Rng } from '../core/rng.js';

/**
 * Redeals every card not visible to `observerId` (the union of all other players' hands and
 * the draw deck — discard piles and the observer's own hand are public/known and left
 * untouched), preserving each player's hand size and the deck size. This turns a
 * hidden-information state into one concrete "world" a standard (perfect-information) MCTS
 * can search — the core of Information Set MCTS (docs/PLANO.md M7).
 */
export function determinize(state: GameState, rng: Rng, observerId: PlayerId): GameState {
  const otherPlayerIds = Object.keys(state.players).filter((id) => id !== observerId);

  const unseen: Card[] = [...state.drawDeck];
  for (const id of otherPlayerIds) {
    const player = state.players[id];
    if (player === undefined) continue;
    unseen.push(...player.hand);
  }

  const shuffled = rng.shuffle(unseen);
  let cursor = 0;
  const newPlayers = { ...state.players };
  for (const id of otherPlayerIds) {
    const player = state.players[id];
    if (player === undefined) continue;
    const hand = shuffled.slice(cursor, cursor + player.hand.length);
    cursor += player.hand.length;
    newPlayers[id] = { ...player, hand };
  }
  const newDeck = shuffled.slice(cursor);

  return { ...state, players: newPlayers, drawDeck: newDeck };
}
