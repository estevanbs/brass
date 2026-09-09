import {
  createInitialState,
  mulberry32,
  applyAction,
  advanceAfterAction,
  skipEmptyHandTurns,
  type GameState,
  type PlayerId,
} from '@brass/backend-domain';
import type { Bot } from './random.js';

const MAX_TURNS = 5000;

export interface GameResult {
  readonly seed: number;
  readonly playerCount: number;
  readonly turns: number;
  readonly durationMs: number;
  readonly finalState: GameState;
  readonly victoryPoints: Readonly<Record<PlayerId, number>>;
  readonly winner: PlayerId;
}

/**
 * Plays one full game to completion with `bots` driving each player. The bots' own decision
 * randomness comes from a separate RNG stream from the engine's internal one (state.rngState,
 * used only for card shuffles at setup/era-transition), so bot behavior and engine setup can
 * vary independently even at a fixed seed.
 */
export function playGame(
  playerIds: readonly PlayerId[],
  seed: number,
  bots: Readonly<Record<PlayerId, Bot>>,
): GameResult {
  const start = Date.now();
  let state = skipEmptyHandTurns(createInitialState(playerIds, seed));
  const botRng = mulberry32(seed ^ 0x9e3779b9);

  let turns = 0;
  while (!state.gameOver) {
    if (turns >= MAX_TURNS) {
      throw new Error(`playGame: exceeded ${MAX_TURNS} turns (seed ${seed}) — possible infinite loop`);
    }
    const activeId = state.turnOrder[state.activePlayerIndex];
    if (activeId === undefined) throw new Error('unreachable');
    const bot = bots[activeId];
    if (bot === undefined) throw new Error(`no bot registered for player ${activeId}`);

    const action = bot(state, activeId, botRng);
    state = applyAction(state, action);
    state = advanceAfterAction(state);
    turns++;
  }

  const victoryPoints = Object.fromEntries(
    Object.entries(state.players).map(([id, p]) => [id, p.victoryPoints]),
  );
  const winner = pickWinner(state);

  return {
    seed,
    playerCount: playerIds.length,
    turns,
    durationMs: Date.now() - start,
    finalState: state,
    victoryPoints,
    winner,
  };
}

/** docs/RULES.md §9: most VP wins; ties broken by income level, then money, then a draw
 * (reported here as the first player in turnOrder among the fully-tied group). */
function pickWinner(state: GameState): PlayerId {
  const entries = Object.values(state.players);
  let best = entries[0];
  if (best === undefined) throw new Error('unreachable: no players');
  for (const player of entries.slice(1)) {
    if (
      player.victoryPoints > best.victoryPoints ||
      (player.victoryPoints === best.victoryPoints && player.incomeTrackPosition > best.incomeTrackPosition) ||
      (player.victoryPoints === best.victoryPoints &&
        player.incomeTrackPosition === best.incomeTrackPosition &&
        player.money > best.money)
    ) {
      best = player;
    }
  }
  return best.id;
}

export interface BatchSummary {
  readonly games: GameResult[];
  readonly count: number;
  readonly meanTurns: number;
  readonly meanDurationMs: number;
  readonly maxDurationMs: number;
  readonly meanWinnerVp: number;
  readonly minWinnerVp: number;
  readonly maxWinnerVp: number;
}

export function runBatch(
  playerIds: readonly PlayerId[],
  gameCount: number,
  baseSeed: number,
  makeBots: () => Readonly<Record<PlayerId, Bot>>,
): BatchSummary {
  const games: GameResult[] = [];
  for (let i = 0; i < gameCount; i++) {
    games.push(playGame(playerIds, baseSeed + i, makeBots()));
  }

  const turnsList = games.map((g) => g.turns);
  const durations = games.map((g) => g.durationMs);
  const winnerVps = games.map((g) => g.victoryPoints[g.winner] ?? 0);

  return {
    games,
    count: games.length,
    meanTurns: mean(turnsList),
    meanDurationMs: mean(durations),
    maxDurationMs: Math.max(...durations),
    meanWinnerVp: mean(winnerVps),
    minWinnerVp: Math.min(...winnerVps),
    maxWinnerVp: Math.max(...winnerVps),
  };
}

function mean(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}
