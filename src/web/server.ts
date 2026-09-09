import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createInitialState } from '../core/state.js';
import type { GameState, PlayerId } from '../core/types.js';
import { applyAction } from '../engine/apply-action.js';
import { advanceAfterAction, skipEmptyHandTurns } from '../engine/cycle.js';
import { legalActions } from '../engine/legal/index.js';
import { makeIsmctsBot } from '../bots/ismcts.js';
import { evaluate } from '../bots/heuristic.js';
import type { Bot } from '../bots/random.js';
import { mulberry32, type Rng } from '../core/rng.js';
import { describeAction } from '../cli/render.js';

const HUMAN_ID: PlayerId = 'você';
const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');
const MAX_LOG = 60;

interface Game {
  state: GameState;
  playerIds: readonly PlayerId[];
  bot: Bot;
  botRng: Rng;
  log: string[];
}

const games = new Map<string, Game>();

function botTimeBudgetMs(playerIds: readonly PlayerId[]): number {
  // Keep total wait per human turn reasonable even with 3 bots in a row.
  return playerIds.length <= 2 ? 1000 : 600;
}

function advanceBotsUntilHumanOrOver(game: Game): void {
  while (!game.state.gameOver) {
    const activeId = game.state.turnOrder[game.state.activePlayerIndex];
    if (activeId === undefined || activeId === HUMAN_ID) break;
    const action = game.bot(game.state, activeId, game.botRng);
    game.state = advanceAfterAction(applyAction(game.state, action));
    const est = evaluate(game.state, activeId).toFixed(1);
    game.log.push(`${activeId}: ${describeAction(action)} (VP est. ${est})`);
    if (game.log.length > MAX_LOG) game.log.shift();
  }
}

function view(gameId: string, game: Game): unknown {
  const actions = game.state.gameOver ? [] : legalActions(game.state, HUMAN_ID);
  return {
    gameId,
    humanId: HUMAN_ID,
    state: game.state,
    legalActions: actions.map((action, index) => ({
      index,
      type: action.type,
      label: describeAction(action),
    })),
    log: game.log,
  };
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

const MIME_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

async function serveStatic(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const safePath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  try {
    const content = await readFile(filePath);
    const mime = MIME_TYPES[extname(filePath)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

function createGame(playerCount: number, seed: number): { id: string; game: Game } {
  const count = Math.max(2, Math.min(4, playerCount));
  const playerIds: PlayerId[] = [HUMAN_ID, ...Array.from({ length: count - 1 }, (_, i) => `bot${i + 1}`)];
  const game: Game = {
    state: skipEmptyHandTurns(createInitialState(playerIds, seed)),
    playerIds,
    bot: makeIsmctsBot({ timeBudgetMs: botTimeBudgetMs(playerIds) }),
    botRng: mulberry32(seed ^ 0x9e3779b9),
    log: [],
  };
  advanceBotsUntilHumanOrOver(game);
  const id = randomUUID();
  games.set(id, game);
  return { id, game };
}

const server = createServer((req, res) => {
  handleRequest(req, res).catch((err: unknown) => {
    sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
  });
});

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (req.method === 'POST' && url.pathname === '/api/games') {
    const body = await readBody(req);
    const parsed = body ? (JSON.parse(body) as { playerCount?: number; seed?: number }) : {};
    const playerCount = parsed.playerCount ?? 2;
    const seed = parsed.seed ?? Date.now() % 1_000_000;
    const { id, game } = createGame(playerCount, seed);
    sendJson(res, 200, view(id, game));
    return;
  }

  const gameMatch = /^\/api\/games\/([^/]+)$/.exec(url.pathname);
  if (req.method === 'GET' && gameMatch?.[1] !== undefined) {
    const game = games.get(gameMatch[1]);
    if (game === undefined) {
      sendJson(res, 404, { error: 'jogo não encontrado' });
      return;
    }
    sendJson(res, 200, view(gameMatch[1], game));
    return;
  }

  const actionMatch = /^\/api\/games\/([^/]+)\/actions$/.exec(url.pathname);
  if (req.method === 'POST' && actionMatch?.[1] !== undefined) {
    const gameId = actionMatch[1];
    const game = games.get(gameId);
    if (game === undefined) {
      sendJson(res, 404, { error: 'jogo não encontrado' });
      return;
    }
    if (game.state.gameOver) {
      sendJson(res, 400, { error: 'a partida já terminou' });
      return;
    }
    const body = await readBody(req);
    const parsed = JSON.parse(body) as { index?: number };
    const actions = legalActions(game.state, HUMAN_ID);
    const action = parsed.index === undefined ? undefined : actions[parsed.index];
    if (action === undefined) {
      sendJson(res, 400, { error: 'índice de ação inválido' });
      return;
    }
    game.state = advanceAfterAction(applyAction(game.state, action));
    game.log.push(`${HUMAN_ID}: ${describeAction(action)}`);
    if (game.log.length > MAX_LOG) game.log.shift();
    advanceBotsUntilHumanOrOver(game);
    sendJson(res, 200, view(gameId, game));
    return;
  }

  if (req.method === 'GET') {
    await serveStatic(req, res);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
}

const port = Number(process.env['PORT'] ?? 3000);
server.listen(port, () => {
  console.log(`Brass: Birmingham — GUI web em http://localhost:${port}`);
});
