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

const CARD_ICON = {
  location: '🏙',
  industry: '⚙',
  wildLocation: '★',
  wildIndustry: '☆',
};

/** Real-world [lat, lon] of each town the board is named after — see docs/ASSUMPTIONS.md #1:
 * the board's topology is an original design, but the town names are real West Midlands /
 * England places, so their actual relative positions make the map read like a real map. */
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
let selectedCard = null; // cardKey string, or null for "nothing selected yet"
let layout = null; // Map<locationId, {x,y}> — computed once per board topology
let scoutPicks = []; // cardKeys chosen as the 2 extra Scout discards, while in scout mode
let scoutMode = false;

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
  if (card.kind === 'location') return card.locationId.replace(/_/g, ' ');
  if (card.kind === 'industry') return card.industry;
  if (card.kind === 'wildLocation') return 'local curinga';
  return 'indústria curinga';
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
    resetSelection();
    setView(view);
    el('app').hidden = false;
    el('statusMsg').textContent = '';
  } catch (err) {
    el('statusMsg').textContent = `Erro: ${err.message}`;
  }
}

function resetSelection() {
  selectedCard = null;
  scoutMode = false;
  scoutPicks = [];
  hidePopup();
}

async function submitAction(index) {
  if (currentGameId === null) return;
  el('statusMsg').textContent = 'Aguardando bots...';
  hidePopup();
  try {
    const view = await api(`/api/games/${currentGameId}/actions`, {
      method: 'POST',
      body: JSON.stringify({ index }),
    });
    resetSelection();
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
  renderTopStrip();
  renderMap();
  renderHand();
  renderOtherActions();
  renderLog();
  renderGameOver();
}

// ---------- Filtering helpers ----------

function filteredActions() {
  if (currentView === null) return [];
  if (scoutMode) {
    return currentView.legalActions.filter(
      (a) => a.type === 'scout' && [selectedCard, ...scoutPicks].every((k) => a.cardKeys.includes(k)),
    );
  }
  if (selectedCard === null) return [];
  return currentView.legalActions.filter((a) => a.cardKeys.includes(selectedCard));
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

  svg.appendChild(svgEl('rect', { x: 0, y: 0, width: MAP_WIDTH, height: MAP_HEIGHT, fill: '#f1e6c8' }));
  const compass = svgEl('text', { x: MAP_WIDTH - 40, y: 46, 'text-anchor': 'middle', 'font-size': 26, fill: '#c9b787' });
  compass.textContent = '✦';
  svg.appendChild(compass);

  const builtByLinkId = new Map(state.links.map((l) => [l.slotId, l]));
  const eraColor = { canal: '#2f6ba8', rail: '#332924' };

  const active = filteredActions();
  const activeLocationIds = new Set(active.flatMap((a) => a.targets.locationIds));
  const activeLinkIds = new Set(active.flatMap((a) => a.targets.linkSlotIds));
  const haveSelection = selectedCard !== null || scoutMode;

  el('mapHint').hidden = !haveSelection || active.length > 0;

  // Edges first (so nodes draw on top).
  for (const link of board.links) {
    const pairs = [link.locations, ...link.bonusConnections];
    const built = builtByLinkId.get(link.id);
    const isActive = activeLinkIds.has(link.id);
    for (const [a, b] of pairs) {
      const na = layout.get(a);
      const nb = layout.get(b);
      if (!na || !nb) continue;
      const line = svgEl('line', {
        x1: na.x,
        y1: na.y,
        x2: nb.x,
        y2: nb.y,
        stroke: built ? eraColor[built.kind] || '#332924' : isActive ? '#c98a2c' : '#b9a97e',
        'stroke-width': built ? 4 : isActive ? 4 : 1.4,
        'stroke-dasharray': built ? 'none' : isActive ? 'none' : '5,4',
        'stroke-linecap': 'round',
        opacity: built ? 0.95 : isActive ? 0.95 : 0.6,
        class: isActive ? 'map-target-line' : '',
      });
      if (isActive && !built) {
        line.style.cursor = 'pointer';
        line.addEventListener('click', () => onLinkClick(link.id, na, nb));
      }
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
    const isActive = activeLocationIds.has(location.id);
    const g = svgEl('g', { transform: `translate(${pos.x},${pos.y})`, class: isActive ? 'map-target-node' : '' });

    const slots = (state.locations[location.id] && state.locations[location.id].slots) || [];
    const builtSlots = slots.filter((s) => s.tile);
    const hasHumanTile = builtSlots.some((s) => s.tile.owner === humanId);

    const r = location.kind === 'market' ? 15 : 11;

    if (isActive) {
      const pulse = svgEl('circle', { r: r + 9, fill: 'none', stroke: '#c98a2c', 'stroke-width': 3, class: 'pulse-ring' });
      g.appendChild(pulse);
      g.style.cursor = 'pointer';
      g.addEventListener('click', () => onLocationClick(location.id, pos));
    }

    const circle = svgEl('circle', {
      r,
      fill: KIND_COLOR[location.kind] || '#d8c9a3',
      stroke: hasHumanTile ? '#a8432f' : isActive ? '#c98a2c' : '#5a4d38',
      'stroke-width': hasHumanTile || isActive ? 3 : 1.4,
    });
    g.appendChild(circle);

    if (location.kind === 'market') {
      const m = svgEl('text', { 'text-anchor': 'middle', 'font-size': 13, y: 5 });
      m.textContent = '⚑';
      g.appendChild(m);
    }

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
      const icon = svgEl('text', { x: offset, y: r + 15.5, 'text-anchor': 'middle', 'font-size': 8 });
      icon.textContent = INDUSTRY_ICON[slot.tile.industry] || '';
      g.appendChild(icon);
    });

    const label = svgEl('text', {
      y: -(r + 6),
      'text-anchor': 'middle',
      'font-size': 11,
      'font-weight': location.kind === 'market' || isActive ? 700 : 400,
      fill: isActive ? '#8a4e0f' : '#2b2620',
      'font-family': 'Georgia, "Times New Roman", serif',
    });
    label.textContent = location.id.replace(/_/g, ' ');
    g.appendChild(label);

    svg.appendChild(g);
  }

  renderMapLegend();
}

function renderMapLegend() {
  const legend = el('mapLegend');
  legend.innerHTML = `
    <span><i class="dot" style="background:${KIND_COLOR.industrial}"></i> vila</span>
    <span><i class="dot" style="background:${KIND_COLOR.farm_brewery}"></i> fazenda</span>
    <span><i class="dot" style="background:${KIND_COLOR.market}"></i> ⚑ mercador</span>
    <span><i class="dot" style="background:#c98a2c"></i> jogável agora</span>
    <span><i class="line built" style="background:#2f6ba8"></i> canal</span>
    <span><i class="line built" style="background:#332924"></i> ferrovia</span>
  `;
}

// ---------- Popup (compact, anchored, for the few options at one map spot) ----------

function popupPosition(pos) {
  const svg = el('map');
  const rect = svg.getBoundingClientRect();
  const stageRect = el('stage').getBoundingClientRect();
  const scaleX = rect.width / MAP_WIDTH;
  const scaleY = rect.height / MAP_HEIGHT;
  return {
    left: rect.left - stageRect.left + pos.x * scaleX,
    top: rect.top - stageRect.top + pos.y * scaleY,
  };
}

function showPopup(pos, title, actions) {
  const popup = el('mapPopup');
  const { left, top } = popupPosition(pos);
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
  popup.innerHTML = '';
  const h = document.createElement('div');
  h.className = 'map-popup-title';
  h.textContent = title;
  popup.appendChild(h);
  for (const action of actions) {
    const btn = document.createElement('button');
    btn.textContent = action.label;
    btn.onclick = () => submitAction(action.index);
    popup.appendChild(btn);
  }
  const closeBtn = document.createElement('button');
  closeBtn.className = 'popup-close';
  closeBtn.textContent = 'fechar';
  closeBtn.onclick = hidePopup;
  popup.appendChild(closeBtn);
  popup.hidden = false;
}

function hidePopup() {
  el('mapPopup').hidden = true;
}

function onLocationClick(locationId, pos) {
  const matches = filteredActions().filter((a) => a.targets.locationIds.includes(locationId));
  if (matches.length === 0) return;
  if (matches.length === 1) {
    submitAction(matches[0].index);
    return;
  }
  showPopup(pos, locationId.replace(/_/g, ' '), matches);
}

function onLinkClick(linkSlotId, na, nb) {
  const matches = filteredActions().filter((a) => a.targets.linkSlotIds.includes(linkSlotId));
  if (matches.length === 0) return;
  const mid = { x: (na.x + nb.x) / 2, y: (na.y + nb.y) / 2 };
  if (matches.length === 1) {
    submitAction(matches[0].index);
    return;
  }
  showPopup(mid, 'construir link', matches);
}

// ---------- Top strip (compact player/era status) ----------

function renderTopStrip() {
  const { state, humanId } = currentView;
  const strip = el('topStrip');
  strip.innerHTML = '';

  const era = document.createElement('div');
  era.className = 'strip-era';
  era.textContent = `${state.era === 'canal' ? 'Era Canal' : 'Era Ferrovia'} · rodada ${state.round}/${state.roundsPerEra} · carvão ${state.market.coalCubes}/14 · ferro ${state.market.ironCubes}/10`;
  strip.appendChild(era);

  for (const playerId of state.turnOrder.length ? state.turnOrder : Object.keys(state.players)) {
    const p = state.players[playerId];
    const chip = document.createElement('div');
    const active = state.turnOrder[state.activePlayerIndex] === playerId && !state.gameOver;
    chip.className = 'strip-player' + (playerId === humanId ? ' human' : '') + (active ? ' active' : '');
    chip.style.setProperty('--pcolor', playerColor(playerId, humanId));
    chip.textContent = `${playerId} · £${p.money} · ${p.victoryPoints}VP · renda ${incomeLevelForPosition(p.incomeTrackPosition)}`;
    strip.appendChild(chip);
  }
}

// ---------- Hand (Hearthstone-like fanned cards) ----------

function renderHand() {
  const { state, humanId } = currentView;
  const hand = el('hand');
  hand.innerHTML = '';
  const cards = state.players[humanId].hand;
  const n = cards.length;

  cards.forEach((card, i) => {
    const key = cardKeyOf(card);
    const isSelected = key === selectedCard;
    const isScoutPick = scoutPicks.includes(key);
    const card_ = document.createElement('button');
    card_.className = 'hand-card' + (isSelected ? ' selected' : '') + (isScoutPick ? ' scout-pick' : '');
    const mid = (n - 1) / 2;
    const rotate = (i - mid) * 4;
    const lift = isSelected || isScoutPick ? -26 : 0;
    card_.style.setProperty('--rotate', `${rotate}deg`);
    card_.style.setProperty('--lift', `${lift}px`);
    card_.style.zIndex = String(isSelected ? 100 : i);

    const isWild = card.kind === 'wildLocation' || card.kind === 'wildIndustry';
    card_.innerHTML = `
      <div class="hand-card-icon">${CARD_ICON[card.kind]}</div>
      <div class="hand-card-label">${formatCard(card)}</div>
      <div class="hand-card-type">${card.kind === 'location' || card.kind === 'wildLocation' ? 'local' : 'indústria'}</div>
    `;
    if (isWild) card_.classList.add('wild');

    card_.onclick = () => onCardClick(key);
    hand.appendChild(card_);
  });
}

function onCardClick(key) {
  hidePopup();
  if (scoutMode) {
    if (key === selectedCard) return;
    if (scoutPicks.includes(key)) {
      scoutPicks = scoutPicks.filter((k) => k !== key);
    } else if (scoutPicks.length < 2) {
      scoutPicks.push(key);
    }
    if (scoutPicks.length === 2) {
      const match = filteredActions()[0];
      if (match) submitAction(match.index);
    } else {
      render();
    }
    return;
  }
  selectedCard = selectedCard === key ? null : key;
  render();
}

// ---------- Other actions (Loan / Develop / Scout / Pass — not map-shaped) ----------

function renderOtherActions() {
  const box = el('otherActions');
  box.innerHTML = '';

  if (scoutMode) {
    const hint = document.createElement('div');
    hint.className = 'other-actions-hint';
    hint.textContent = `Explorar: escolha mais ${2 - scoutPicks.length} carta(s) na mão`;
    box.appendChild(hint);
    const cancel = document.createElement('button');
    cancel.className = 'other-action-btn';
    cancel.textContent = 'cancelar';
    cancel.onclick = () => {
      resetSelection();
      render();
    };
    box.appendChild(cancel);
    return;
  }

  if (selectedCard === null) {
    const hint = document.createElement('div');
    hint.className = 'other-actions-hint';
    hint.textContent = currentView.state.gameOver ? '' : 'Selecione uma carta na mão para jogar';
    box.appendChild(hint);
    return;
  }

  const matches = filteredActions();
  if (matches.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'other-actions-hint';
    hint.textContent = 'Essa carta não tem jogadas legais agora.';
    box.appendChild(hint);
    return;
  }

  const byType = new Map();
  for (const a of matches) {
    if (!byType.has(a.type)) byType.set(a.type, []);
    byType.get(a.type).push(a);
  }

  if (byType.has('loan')) {
    box.appendChild(makeOtherActionButton('Empréstimo', () => submitAction(byType.get('loan')[0].index)));
  }
  if (byType.has('pass')) {
    box.appendChild(makeOtherActionButton('Passar', () => submitAction(byType.get('pass')[0].index)));
  }
  if (byType.has('develop')) {
    box.appendChild(
      makeOtherActionButton('Desenvolver ▾', (btn) => showInlineChoices(btn, byType.get('develop'))),
    );
  }
  if (byType.has('sell')) {
    box.appendChild(makeOtherActionButton('Vender ▾', (btn) => showInlineChoices(btn, byType.get('sell'))));
  }
  if (byType.has('scout')) {
    box.appendChild(
      makeOtherActionButton('Explorar', () => {
        scoutMode = true;
        scoutPicks = [];
        render();
      }),
    );
  }
}

function makeOtherActionButton(label, onClick) {
  const btn = document.createElement('button');
  btn.className = 'other-action-btn';
  btn.textContent = label;
  btn.onclick = () => onClick(btn);
  return btn;
}

function showInlineChoices(anchorBtn, actions) {
  // #mapPopup's `position: absolute` is relative to `.stage` (its actual positioned
  // ancestor — see the CSS), not to the button's own container, which lives below `.stage`
  // in the hand dock. Anchoring against the wrong element here was a real bug: it placed the
  // popup off-screen. Anchor the popup's bottom edge just above the stage's own bottom edge,
  // rather than trying to track the button's position across a different containing block —
  // combined with the CSS max-height/scroll, this always stays fully on screen.
  const stageRect = el('stage').getBoundingClientRect();
  const popup = el('mapPopup');
  popup.style.left = '16px';
  popup.style.top = 'auto';
  popup.style.bottom = '16px';
  popup.style.right = 'auto';
  popup.style.maxHeight = `${Math.max(160, stageRect.height - 32)}px`;
  popup.style.transform = 'none';
  popup.innerHTML = '';
  for (const action of actions) {
    const b = document.createElement('button');
    b.textContent = action.label;
    b.onclick = () => submitAction(action.index);
    popup.appendChild(b);
  }
  const closeBtn = document.createElement('button');
  closeBtn.className = 'popup-close';
  closeBtn.textContent = 'fechar';
  closeBtn.onclick = hidePopup;
  popup.appendChild(closeBtn);
  popup.hidden = false;
}

// ---------- Log ----------

function renderLog() {
  const logBox = el('log');
  logBox.innerHTML = '';
  for (const line of currentView.log.slice().reverse()) {
    const div = document.createElement('div');
    div.textContent = line;
    logBox.appendChild(div);
  }
}

// ---------- Game over ----------

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
el('logToggleBtn').addEventListener('click', () => {
  el('log').hidden = !el('log').hidden;
});
el('mapHint').textContent = 'Selecione uma carta na mão para ver as jogadas possíveis';
