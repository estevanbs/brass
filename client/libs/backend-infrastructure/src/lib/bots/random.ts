import { legalActions, type Action, type GameState, type PlayerId, type Rng } from '@brass/backend-domain';

/** A bot: given the current state and whose turn it is, picks one of the legal actions. */
export type Bot = (state: GameState, playerId: PlayerId, rng: Rng) => Action;

/** Chooses uniformly at random among all legal actions. */
export const randomBot: Bot = (state, playerId, rng) => {
  const actions = legalActions(state, playerId);
  if (actions.length === 0) {
    throw new Error(`randomBot: no legal actions for ${playerId}`);
  }
  return rng.pick(actions);
};
