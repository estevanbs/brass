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
  industrial: '#d8c9a3',
  farm_brewery: '#8fae7a',
  market: '#d4a537',
};

const PLAYER_COLORS = ['#a8432f', '#2f6b47', '#2f5a8a', '#8a5a2f'];

const INDUSTRY_ICON = {
  coal: '⚫',
  iron: '⛓',
  cotton: '🧵',
  manufacturer: '⚙',
  pottery: '🏺',
  brewery: '🍺',
};

/** Real-world [lat, lon] of each town the board is named after (docs/ASSUMPTIONS.md #1: the
 * board's topology is an original design, but the town names are real West Midlands / England
 * places — using their actual relative positions makes the map read like a real map instead
 * of an abstract graph, without reproducing any of the physical game's own artwork). Farm
 * breweries aren't real places; each is plotted near the town(s) it connects to. */
const LOCATION_COORDS = {
  birmingham: [52.4862, -1.8904],
  wolverhampton: [52.5862, -2.1281],
  dudley: [52.5083, -2.0807],
  walsall: [52.586, -1.9822],
  west_bromwich: [52.5186, -1.9945],
  coventry: [52.4068, -1.5197],
  tamworth: [52.6335, -1.6947],
  nuneaton: [52.5231, -1.4677],
  redditch: [52.3057, -1.9428],
  bromsgrove: [52.3357, -2.0611],
  kidderminster: [52.3891, -2.2494],
  worcester: [52.1936, -2.2216],
  cannock: [52.6883, -2.0311],
  coalbrookdale: [52.6267, -2.4839],
  stoke_on_trent: [53.0027, -2.1794],
  stone: [52.9022, -2.1522],
  leek: [53.1039, -2.0233],
  stourbridge: [52.4573, -2.1483],
  warrington: [53.39, -2.5972],
  shrewsbury: [52.7069, -2.7527],
  nottingham: [52.9548, -1.1581],
  gloucester: [51.8642, -2.2382],
  oxford: [51.752, -1.2577],
  farm_brewery_north: [52.735, -2.09],
  farm_brewery_south: [52.27, -2.29],
};

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

// ---------- Map (projected from each town's real-world position) ----------

const MAP_WIDTH = 900;
const MAP_HEIGHT = 700;
const MAP_PAD = 70;

function computeLayout(board) {
  const ids = board.locations.map((l) => l.id);
  const coords = ids.map((id) => LOCATION_COORDS[id] || [52.3, -2.0]);
  const lats = coords.map((c) => c[0]);
  const lons = coords.map((c) => c[1]);
  const latMin = Math.min(...lats);
  const latMax = Math.max(...lats);
  const lonMin = Math.min(...lons);
  const lonMax = Math.max(...lons);

  const nodes = new Map();
  ids.forEach((id) => {
    const [lat, lon] = LOCATION_COORDS[id] || [52.3, -2.0];
    const x = MAP_PAD + ((lon - lonMin) / (lonMax - lonMin || 1)) * (MAP_WIDTH - 2 * MAP_PAD);
    // Latitude grows northward; SVG y grows downward, so invert.
    const y = MAP_PAD + ((latMax - lat) / (latMax - latMin || 1)) * (MAP_HEIGHT - 2 * MAP_PAD);
    nodes.set(id, { x, y });
  });
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

  // Parchment backdrop with a faint compass rose, like an old survey map.
  svg.appendChild(svgEl('rect', { x: 0, y: 0, width: MAP_WIDTH, height: MAP_HEIGHT, fill: '#f1e6c8' }));
  const compass = svgEl('text', {
    x: MAP_WIDTH - 40,
    y: 46,
    'text-anchor': 'middle',
    'font-size': 26,
    fill: '#c9b787',
  });
  compass.textContent = '✦';
  svg.appendChild(compass);

  const builtByLinkId = new Map(state.links.map((l) => [l.slotId, l]));
  const eraColor = { canal: '#2f6ba8', rail: '#332924' };

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
        stroke: built ? eraColor[built.kind] || '#332924' : '#b9a97e',
        'stroke-width': built ? 4 : 1.4,
        'stroke-dasharray': built ? 'none' : '5,4',
        'stroke-linecap': 'round',
        opacity: built ? 0.95 : 0.6,
      });
      svg.appendChild(line);

      if (built) {
        const mid = { x: (na.x + nb.x) / 2, y: (na.y + nb.y) / 2 };
        svg.appendChild(
          svgEl('circle', { cx: mid.x, cy: mid.y, r: 6, fill: playerColor(built.owner, humanId), stroke: '#f1e6c8', 'stroke-width': 1.5 }),
        );
      }
    }
  }

  // Nodes: town marker + small badges for any tiles already built there.
  for (const location of board.locations) {
    const pos = layout.get(location.id);
    if (!pos) continue;
    const g = svgEl('g', { transform: `translate(${pos.x},${pos.y})` });

    const slots = (state.locations[location.id] && state.locations[location.id].slots) || [];
    const builtSlots = slots.filter((s) => s.tile);
    const hasHumanTile = builtSlots.some((s) => s.tile.owner === humanId);

    const r = location.kind === 'market' ? 15 : 11;
    const circle = svgEl('circle', {
      r,
      fill: KIND_COLOR[location.kind] || '#d8c9a3',
      stroke: hasHumanTile ? '#a8432f' : '#5a4d38',
      'stroke-width': hasHumanTile ? 3 : 1.4,
    });
    g.appendChild(circle);

    if (location.kind === 'market') {
      const m = svgEl('text', { 'text-anchor': 'middle', 'font-size': 13, y: 5 });
      m.textContent = '⚑';
      g.appendChild(m);
    }

    // Tile badges in a small arc under the town marker.
    builtSlots.forEach((slot, i) => {
      const offset = (i - (builtSlots.length - 1) / 2) * 15;
      const badge = svgEl('circle', {
        cx: offset,
        cy: r + 12,
        r: 7,
        fill: playerColor(slot.tile.owner, humanId),
        opacity: slot.tile.flipped ? 0.55 : 1,
        stroke: '#f1e6c8',
        'stroke-width': 1,
      });
      g.appendChild(badge);
      const icon = svgEl('text', {
        x: offset,
        y: r + 15.5,
        'text-anchor': 'middle',
        'font-size': 8,
      });
      icon.textContent = INDUSTRY_ICON[slot.tile.industry] || '';
      g.appendChild(icon);
    });

    const label = svgEl('text', {
      y: -(r + 6),
      'text-anchor': 'middle',
      'font-size': 11,
      'font-weight': location.kind === 'market' ? 700 : 400,
      fill: '#2b2620',
      'font-family': 'Georgia, "Times New Roman", serif',
    });
    label.textContent = location.id.replace(/_/g, ' ');
    g.appendChild(label);

    svg.appendChild(g);
  }
}

function renderMapLegend() {
  const legend = el('mapLegend');
  legend.innerHTML = `
    <span><i class="dot" style="background:${KIND_COLOR.industrial}"></i> vila industrial</span>
    <span><i class="dot" style="background:${KIND_COLOR.farm_brewery}"></i> fazenda cervejeira</span>
    <span><i class="dot" style="background:${KIND_COLOR.market}"></i> ⚑ mercador</span>
    <span><i class="line"></i> linha não construída</span>
    <span><i class="line built" style="background:#2f6ba8"></i> canal construído</span>
    <span><i class="line built" style="background:#332924"></i> ferrovia construída</span>
    <span><i class="dot" style="background:#a8432f"></i> dono do link/peça</span>
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
