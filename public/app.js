const TYPE_LABELS = {
  build: 'Construir',
  network: 'Rede',
  develop: 'Desenvolver',
  sell: 'Vender',
  loan: 'Empréstimo',
  scout: 'Explorar',
  pass: 'Passar',
};

const KIND_COLOR = {
  industrial: '#c9c0aa',
  farm_brewery: '#8fae7a',
  market: '#e0b23d',
};

const PLAYER_COLORS = ['#a8432f', '#2f6b47', '#2f5a8a', '#8a5a2f'];

let currentGameId = null;
let currentView = null;
let selectedType = null;
let selectedCard = null; // cardKey string, or null for "show all"
let layout = null; // Map<locationId, {x,y}> — computed once per board topology

const el = (id) => document.getElementById(id);

function incomeLevelForPosition(position) {
  if (position < 11) return position - 10;
  if (position < 31) return Math.floor((position - 9) / 2);
  if (position < 61) return Math.floor((position + 2) / 3);
  return Math.floor((position + 23) / 4);
}

function cardKeyOf(card) {
  if (card.kind === 'location') return `location:${card.locationId}`;
  if (card.kind === 'industry') return `industry:${card.industry}`;
  return card.kind;
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
    selectedCard = null;
    setView(view);
    el('app').hidden = false;
    el('statusMsg').textContent = '';
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
    selectedCard = null;
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
  renderMap();
  renderBoard();
  renderPlayers();
  renderHand();
  renderActions();
  renderLog();
  renderGameOver();
}

// ---------- Map (force-directed layout + SVG) ----------

function computeLayout(board) {
  const ids = board.locations.map((l) => l.id);
  const edges = [];
  for (const link of board.links) {
    edges.push(link.locations);
    for (const pair of link.bonusConnections) edges.push(pair);
  }

  const width = 900;
  const height = 620;
  const nodes = new Map();
  ids.forEach((id, i) => {
    const angle = (i / ids.length) * 2 * Math.PI;
    nodes.set(id, {
      x: width / 2 + Math.cos(angle) * 260,
      y: height / 2 + Math.sin(angle) * 220,
    });
  });

  const k = Math.sqrt((width * height) / ids.length) * 1.35;
  for (let iter = 0; iter < 300; iter++) {
    const disp = new Map(ids.map((id) => [id, { x: 0, y: 0 }]));

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = nodes.get(ids[i]);
        const b = nodes.get(ids[j]);
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = (k * k) / dist;
        dx /= dist;
        dy /= dist;
        disp.get(ids[i]).x += dx * force;
        disp.get(ids[i]).y += dy * force;
        disp.get(ids[j]).x -= dx * force;
        disp.get(ids[j]).y -= dy * force;
      }
    }

    for (const [a, b] of edges) {
      const na = nodes.get(a);
      const nb = nodes.get(b);
      let dx = na.x - nb.x;
      let dy = na.y - nb.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (dist * dist) / k;
      dx /= dist;
      dy /= dist;
      disp.get(a).x -= dx * force;
      disp.get(a).y -= dy * force;
      disp.get(b).x += dx * force;
      disp.get(b).y += dy * force;
    }

    const temp = 12 * (1 - iter / 300);
    for (const id of ids) {
      const d = disp.get(id);
      const dist = Math.sqrt(d.x * d.x + d.y * d.y) || 0.01;
      const move = Math.min(dist, temp);
      const n = nodes.get(id);
      n.x += (d.x / dist) * move;
      n.y += (d.y / dist) * move;
      n.x = Math.max(60, Math.min(width - 60, n.x));
      n.y = Math.max(45, Math.min(height - 45, n.y));
    }
  }

  return nodes;
}

function svgEl(tag, attrs) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function playerColor(playerId, humanId) {
  if (playerId === humanId) return '#a8432f';
  const idx = Number(String(playerId).replace(/\D/g, '')) || 1;
  return PLAYER_COLORS[idx % PLAYER_COLORS.length];
}

function renderMap() {
  const { state, board, humanId } = currentView;
  if (layout === null) layout = computeLayout(board);

  const svg = el('map');
  svg.innerHTML = '';

  const builtByLinkId = new Map(state.links.map((l) => [l.slotId, l]));

  // Edges first (so nodes draw on top).
  for (const link of board.links) {
    const pairs = [link.locations, ...link.bonusConnections];
    const built = builtByLinkId.get(link.id);
    for (const [a, b] of pairs) {
      const na = layout.get(a);
      const nb = layout.get(b);
      if (!na || !nb) continue;
      const line = svgEl('line', {
        x1: na.x,
        y1: na.y,
        x2: nb.x,
        y2: nb.y,
        stroke: built ? playerColor(built.owner, humanId) : '#c9c0aa',
        'stroke-width': built ? 3.5 : 1.2,
        'stroke-dasharray': built ? 'none' : '4,4',
        opacity: built ? 0.9 : 0.5,
      });
      svg.appendChild(line);
    }
  }

  // Nodes.
  for (const location of board.locations) {
    const pos = layout.get(location.id);
    if (!pos) continue;
    const g = svgEl('g', { transform: `translate(${pos.x},${pos.y})` });

    const hasHumanTile =
      state.locations[location.id] &&
      (state.locations[location.id].slots || []).some((s) => s.tile && s.tile.owner === humanId);

    const circle = svgEl('circle', {
      r: location.kind === 'market' ? 16 : 12,
      fill: KIND_COLOR[location.kind] || '#c9c0aa',
      stroke: hasHumanTile ? '#a8432f' : '#7a7266',
      'stroke-width': hasHumanTile ? 3 : 1,
    });
    g.appendChild(circle);

    const label = svgEl('text', {
      y: location.kind === 'market' ? 30 : 26,
      'text-anchor': 'middle',
      'font-size': '10',
      fill: '#2b2620',
    });
    label.textContent = location.id.replace(/_/g, ' ');
    g.appendChild(label);

    svg.appendChild(g);
  }
}

function renderMapLegend() {
  const legend = el('mapLegend');
  legend.innerHTML = `
    <span><i class="dot" style="background:${KIND_COLOR.industrial}"></i> industrial</span>
    <span><i class="dot" style="background:${KIND_COLOR.farm_brewery}"></i> fazenda cervejeira</span>
    <span><i class="dot" style="background:${KIND_COLOR.market}"></i> mercador</span>
    <span><i class="line"></i> link livre</span>
    <span><i class="line built" style="background:#a8432f"></i> seu link</span>
  `;
}

// ---------- Board detail grid ----------

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

// ---------- Hand (clickable cards) ----------

function renderHand() {
  const { state, humanId } = currentView;
  const hand = el('hand');
  hand.innerHTML = '';
  for (const card of state.players[humanId].hand) {
    const key = cardKeyOf(card);
    const chip = document.createElement('button');
    chip.className = 'card-chip' + (key === selectedCard ? ' selected' : '');
    chip.textContent = formatCard(card);
    chip.onclick = () => {
      selectedCard = selectedCard === key ? null : key;
      selectedType = null;
      renderActions();
      renderHand();
    };
    hand.appendChild(chip);
  }
}

// ---------- Actions (filtered by selected card, grouped by type) ----------

function renderActions() {
  const { legalActions } = currentView;
  const typesBox = el('actionTypes');
  const listBox = el('actionList');
  const filterLabel = el('cardFilterLabel');
  typesBox.innerHTML = '';
  listBox.innerHTML = '';

  const pool =
    selectedCard === null
      ? legalActions
      : legalActions.filter((a) => a.cardKeys.includes(selectedCard));

  filterLabel.textContent = selectedCard === null ? '' : `— só ações com a carta selecionada (${pool.length})`;

  if (legalActions.length === 0) {
    typesBox.textContent = currentView.state.gameOver ? 'Partida encerrada.' : 'Aguardando...';
    return;
  }
  if (pool.length === 0) {
    typesBox.textContent = 'Essa carta não habilita nenhuma ação legal agora (ela ainda pode ser usada para Rede/Desenvolver/Vender/Empréstimo/Passar caso tenham entradas próprias).';
    return;
  }

  const byType = new Map();
  for (const action of pool) {
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

renderMapLegend();
el('newGameBtn').addEventListener('click', newGame);
el('playAgainBtn').addEventListener('click', () => {
  el('gameOverOverlay').hidden = true;
  newGame();
});
