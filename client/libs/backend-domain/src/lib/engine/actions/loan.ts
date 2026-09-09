import type { GameState } from '../../core/types.js';
import type { LoanAction } from '../action-types.js';
import { applyLoanIncomeDrop } from '../income.js';
import { discardCard, updatePlayer } from '../player-ops.js';

export function applyLoan(state: GameState, action: LoanAction): GameState {
  let working = updatePlayer(state, action.player, (p) => ({
    ...p,
    money: p.money + 30,
    incomeTrackPosition: applyLoanIncomeDrop(p.incomeTrackPosition),
  }));
  working = discardCard(working, action.player, action.card);
  return working;
}
