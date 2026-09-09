import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';
import {
  advanceAfterAction,
  applyAction,
  createInitialState,
  legalActions,
  mulberry32,
  skipEmptyHandTurns,
  type Action,
  type PlayerId,
} from '../libs/backend-domain/src/index.js';
import { evaluate, makeIsmctsBot, type Bot } from '../libs/backend-infrastructure/src/index.js';
import {
  describeAction,
  loadFromFile,
  renderBoard,
  renderPlayer,
  renderScoreboard,
  replay,
  saveToFile,
  type SavedGame,
} from '../libs/backend-application/src/index.js';

const HUMAN_ID = 'você';

/**
 * A prompt/answer helper built on the readline interface's async line iterator, not repeated
 * `question()` calls. With piped/non-TTY stdin (as used by every automated test and by
 * `printf ... | node cli.js`), Node's `readline.question()` reliably resolves only the first
 * call — later calls can hang forever once the input stream has already reached EOF. Reading
 * through a single shared async iterator does not have that problem.
 */
function makeAsker(rl: ReturnType<typeof createInterface>): (prompt: string) => Promise<string> {
  const lines: AsyncIterableIterator<string> = rl[Symbol.asyncIterator]();
  return async (prompt: string) => {
    stdout.write(prompt);
    const result: IteratorResult<string> = await lines.next();
    return result.done === true ? '' : result.value;
  };
}

function groupByType(actions: readonly Action[]): Map<Action['type'], Action[]> {
  const groups = new Map<Action['type'], Action[]>();
  for (const action of actions) {
    const list = groups.get(action.type);
    if (list === undefined) groups.set(action.type, [action]);
    else list.push(action);
  }
  return groups;
}

function replayCommand(path: string): void {
  const saved = loadFromFile(path);
  const state = replay(saved);
  console.log(renderBoard(state));
  console.log('');
  console.log(renderScoreboard(state));
  console.log(`\n(${saved.actions.length} ações replayadas a partir da seed ${saved.seed})`);
}

async function promptForAction(
  ask: (prompt: string) => Promise<string>,
  actions: readonly Action[],
): Promise<{ action: Action } | { save: string } | { quit: true } | null> {
  const groups = groupByType(actions);
  console.log('\nTipos de ação disponíveis:');
  for (const [type, list] of groups) {
    console.log(`  ${type} (${list.length})`);
  }
  const typeAnswer = (await ask('Escolha um tipo (ou "save <arquivo>" / "quit"): ')).trim();
  if (typeAnswer === 'quit') return { quit: true };
  if (typeAnswer.startsWith('save ')) return { save: typeAnswer.slice(5).trim() };

  const chosenType = typeAnswer as Action['type'];
  const list = groups.get(chosenType);
  if (list === undefined) {
    console.log('Tipo desconhecido.');
    return null;
  }
  list.forEach((action, i) => console.log(`  ${i}: ${describeAction(action)}`));
  const indexAnswer = (await ask('Número da ação: ')).trim();
  const index = Number(indexAnswer);
  const action = list[index];
  if (action === undefined) {
    console.log('Número inválido.');
    return null;
  }
  return { action };
}

export async function runCli(argv: readonly string[]): Promise<void> {
  if (argv[0] === '--replay') {
    const path = argv[1];
    if (path === undefined) throw new Error('uso: --replay <arquivo>');
    replayCommand(path);
    return;
  }

  const rl = createInterface({ input: stdin, output: stdout });
  const ask = makeAsker(rl);
  try {
    console.log('=== Brass: Birmingham (motor autônomo) ===\n');
    const playerCountAnswer = (await ask('Quantos jogadores (2-4)? [2] ')).trim();
    const playerCount = Math.max(2, Math.min(4, Number(playerCountAnswer) || 2));
    const playerIds: PlayerId[] = [HUMAN_ID, ...Array.from({ length: playerCount - 1 }, (_, i) => `bot${i + 1}`)];

    const seedAnswer = (await ask('Semente (enter para aleatória)? ')).trim();
    const seed = seedAnswer !== '' ? Number(seedAnswer) : Date.now() % 1_000_000;
    console.log(`Semente: ${seed}`);

    let state = skipEmptyHandTurns(createInitialState(playerIds, seed));
    const actionLog: Action[] = [];
    const botRng = mulberry32(seed ^ 0x9e3779b9);
    const bot: Bot = makeIsmctsBot({ timeBudgetMs: 1000 });

    while (!state.gameOver) {
      const activeId = state.turnOrder[state.activePlayerIndex];
      if (activeId === undefined) throw new Error('unreachable');

      if (activeId === HUMAN_ID) {
        console.log(`\n${renderBoard(state)}`);
        console.log(`\n${renderPlayer(state, HUMAN_ID)}`);
        const actions = legalActions(state, HUMAN_ID);

        let handled = false;
        while (!handled) {
          const result = await promptForAction(ask, actions);
          if (result === null) continue;
          if ('quit' in result) {
            console.log('Até mais!');
            return;
          }
          if ('save' in result) {
            const saved: SavedGame = { seed, playerIds, actions: actionLog };
            saveToFile(result.save, saved);
            console.log(`Partida salva em ${result.save}`);
            continue;
          }
          actionLog.push(result.action);
          state = advanceAfterAction(applyAction(state, result.action));
          handled = true;
        }
      } else {
        const action = bot(state, activeId, botRng);
        actionLog.push(action);
        state = advanceAfterAction(applyAction(state, action));
        console.log(`\n${activeId} jogou: ${describeAction(action)}`);
        console.log(`VP estimado (${activeId}): ${evaluate(state, activeId).toFixed(1)}`);
      }
    }

    console.log(`\n${renderScoreboard(state)}`);
  } finally {
    rl.close();
  }
}

const isMainModule = process.argv[1]?.endsWith('tools/cli.ts') || process.argv[1]?.endsWith('tools/cli.js');
if (isMainModule) {
  runCli(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
