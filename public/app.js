const TYPE_LABELS = {
  build: 'Construir',
  network: 'Rede',
  develop: 'Desenvolver',
  sell: 'Vender',
  loan: 'Empréstimo',
  scout: 'Explorar',
  pass: 'Passar',
};

let currentGameId = null;
let currentView = null;
let selectedType = null;

const el = (id) => document.getElementById(id);

function incomeLevelForPosition(position) {
  if (position < 11) return position - 10;
  if (position < 31) return Math.floor((position - 9) / 2);
  if (position < 61) return Math.floor((position + 2) / 3);
  return Math.floor((position + 23) / 4);
}

function formatCard(card) {
  if (card.kind === 'location') return `Local(${card.locationId})`;
  if (card.kind === 'industry') return `Indústria(${card.industry})`;
  if (card.kind === 'wildLocation') return 'Local curinga';
  return 'Indústria curinga';
}

async function api(path, options) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `erro ${res.status}`);
  return data;
}

async function newGame() {
  el('statusMsg').textContent = 'Criando partida...';
  try {
    const playerCount = Number(el('playerCount').value);
    const seedInput = el('seed').value.trim();
    const body = { playerCount };
    if (seedInput !== '') body.seed = Number(seedInput);
    const view = await api('/api/games', { method: 'POST', body: JSON.stringify(body) });
    currentGameId = view.gameId;
    selectedType = null;
    setView(view);
    el('app').hidden = false;
    el('statusMsg').textContent = `Seed: ${view.state.rngState ?? ''}`.length ? '' : '';
  } catch (err) {
    el('statusMsg').textContent = `Erro: ${err.message}`;
  }
}

async function submitAction(index) {
  if (currentGameId === null) return;
  el('statusMsg').textContent = 'Aguardando bots...';
  try {
    const view = await api(`/api/games/${currentGameId}/actions`, {
      method: 'POST',
      body: JSON.stringify({ index }),
    });
    selectedType = null;
    setView(view);
    el('statusMsg').textContent = '';
  } catch (err) {
    el('statusMsg').textContent = `Erro: ${err.message}`;
  }
}

function setView(view) {
  currentView = view;
  render();
}

function render() {
  if (currentView === null) return;
  renderBoard();
  renderPlayers();
  renderHand();
  renderActions();
  renderLog();
  renderGameOver();
}

function renderBoard() {
  const { state } = currentView;
  const board = el('board');
  board.innerHTML = '';

  const locations = Object.values(state.locations).sort((a, b) => a.id.localeCompare(b.id));
  for (const location of locations) {
    const div = document.createElement('div');
    div.className = 'location' + (location.kind === 'market' ? ' market' : '');
    const title = document.createElement('h3');
    title.textContent = location.id.replace(/_/g, ' ');
    div.appendChild(title);

    if (location.kind === 'market') {
      const merchants = (location.merchantSlots || [])
        .map((s) => (s.icon ? `${s.icon}${s.hasBeer ? ' 🍺' : ''}` : '—'))
        .join(', ');
      const p = document.createElement('div');
      p.className = 'slot';
      p.textContent = `mercadores: ${merchants}`;
      div.appendChild(p);
    } else {
      for (const slot of location.slots) {
        const s = document.createElement('div');
        if (slot.tile) {
          s.className = `slot filled tile-${slot.tile.industry}` + (slot.tile.flipped ? ' flipped' : '');
          const res = slot.tile.flipped ? 'virada' : `${slot.tile.resourceRemaining}un.`;
          s.textContent = `${slot.tile.owner}: ${slot.tile.industry} L${slot.tile.level} (${res})`;
        } else {
          s.className = 'slot';
          s.textContent = slot.allowedIndustries.join('/');
        }
        div.appendChild(s);
      }
    }
    board.appendChild(div);
  }

  const marketBox = document.createElement('div');
  marketBox.className = 'market-box';
  marketBox.textContent = `${state.era === 'canal' ? 'Era Canal' : 'Era Ferrovia'} — rodada ${state.round}/${state.roundsPerEra} · Mercado: carvão ${state.market.coalCubes}/14 · ferro ${state.market.ironCubes}/10`;
  board.appendChild(marketBox);

  const linksBox = document.createElement('div');
  linksBox.className = 'links-box';
  linksBox.textContent =
    state.links.length === 0
      ? 'Nenhum link construído ainda.'
      : `Links: ${state.links.map((l) => `${l.slotId} (${l.owner})`).join(' · ')}`;
  board.appendChild(linksBox);
}

function renderPlayers() {
  const { state, humanId } = currentView;
  const box = el('players');
  box.innerHTML = '<h2 style="margin:0 0 8px;font-size:0.85rem;color:var(--muted)">Jogadores</h2>';
  for (const playerId of state.turnOrder.length ? state.turnOrder : Object.keys(state.players)) {
    const p = state.players[playerId];
    const row = document.createElement('div');
    row.className = 'player-row' + (playerId === humanId ? ' human' : '');
    const active = state.turnOrder[state.activePlayerIndex] === playerId && !state.gameOver;
    row.textContent = `${active ? '▶ ' : ''}${playerId} — £${p.money} · ${p.victoryPoints} VP · renda ${incomeLevelForPosition(p.incomeTrackPosition)}`;
    box.appendChild(row);
  }
}

function renderHand() {
  const { state, humanId } = currentView;
  const hand = el('hand');
  hand.innerHTML = '';
  for (const card of state.players[humanId].hand) {
    const chip = document.createElement('span');
    chip.className = 'card-chip';
    chip.textContent = formatCard(card);
    hand.appendChild(chip);
  }
}

function renderActions() {
  const { legalActions } = currentView;
  const typesBox = el('actionTypes');
  const listBox = el('actionList');
  typesBox.innerHTML = '';
  listBox.innerHTML = '';

  if (legalActions.length === 0) {
    typesBox.textContent = currentView.state.gameOver ? 'Partida encerrada.' : 'Aguardando...';
    return;
  }

  const byType = new Map();
  for (const action of legalActions) {
    if (!byType.has(action.type)) byType.set(action.type, []);
    byType.get(action.type).push(action);
  }
  if (selectedType === null || !byType.has(selectedType)) {
    selectedType = [...byType.keys()][0];
  }

  for (const [type, items] of byType) {
    const btn = document.createElement('button');
    btn.textContent = `${TYPE_LABELS[type] || type} (${items.length})`;
    btn.className = type === selectedType ? 'active' : '';
    btn.onclick = () => {
      selectedType = type;
      renderActions();
    };
    typesBox.appendChild(btn);
  }

  for (const action of byType.get(selectedType) || []) {
    const btn = document.createElement('button');
    btn.textContent = action.label;
    btn.onclick = () => submitAction(action.index);
    listBox.appendChild(btn);
  }
}

function renderLog() {
  const logBox = el('log');
  logBox.innerHTML = '';
  for (const line of currentView.log.slice().reverse()) {
    const div = document.createElement('div');
    div.textContent = line;
    logBox.appendChild(div);
  }
}

function renderGameOver() {
  const overlay = el('gameOverOverlay');
  if (!currentView.state.gameOver) {
    overlay.hidden = true;
    return;
  }
  overlay.hidden = false;
  const board = el('scoreboard');
  board.innerHTML = '';
  const players = Object.values(currentView.state.players).sort((a, b) => b.victoryPoints - a.victoryPoints);
  for (const p of players) {
    const row = document.createElement('div');
    row.className = 'score-row';
    row.textContent = `${p.id}: ${p.victoryPoints} VP`;
    board.appendChild(row);
  }
}

el('newGameBtn').addEventListener('click', newGame);
el('playAgainBtn').addEventListener('click', () => {
  el('gameOverOverlay').hidden = true;
  newGame();
});
