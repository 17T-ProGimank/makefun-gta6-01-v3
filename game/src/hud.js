// hud.js — SOLMARA HUD (round 5).
// Owns every HUD element: base + round-4 ids (stars, money, objective,
// health, speed, minimap, banner, wanted/mission labels, clock, respect bar,
// crew box, garage hint, radio box) plus round-5 ids (weapon box, seagull
// counter, race timer, bribe hint, spike warning, lockpick bar).
// Every lookup is defensive: updateHUD skips any element that is missing,
// so a stripped-down index.html can never crash the game loop.
// Radio box text is owned by audio.js (it writes the station name); hud.js
// only caches the element for it under G.hud.el.radio.

export function initHUD(G) {
  G.hud = G.hud || {};
  G.hud.el = {};
  const ids = [
    'hud', 'stars', 'money', 'objective', 'health-bar', 'health-fill',
    'speed', 'minimap', 'banner', 'banner-title', 'banner-sub',
    'wanted-label', 'mission-label', 'time', 'respect-bar', 'respect-label',
    'crew-box', 'garage-hint', 'radio-box', 'weapon-box', 'seagull-box',
    'race-timer', 'bribe-hint', 'spike-warning', 'lockpick-bar',
    'lockpick-fill',
  ];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) G.hud.el[id] = el;
  }
  // Minimap 2D context, cached once.
  const mm = G.hud.el['minimap'];
  if (mm) {
    mm.width = 180;
    mm.height = 180;
    G.hud.minimapCtx = mm.getContext('2d');
  }
  G.helpers = G.helpers || {};
  G.helpers.addMoney = (n) => {
    G.state.money = Math.max(0, (G.state.money || 0) + n);
    const moneyEl = G.hud.el['money'];
    if (moneyEl) moneyEl.textContent = '$' + G.state.money.toLocaleString('en-US');
  };
  updateHUD(G, 0);
}

function fmtMoney(n) {
  return '$' + (n || 0).toLocaleString('en-US');
}

function fmtClock(t) {
  const s = Math.max(0, Math.floor(t || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

const RANKS = [
  { at: 0, title: 'NOBODY' },
  { at: 100, title: 'STREET HUSTLER' },
  { at: 300, title: 'WHEELMAN' },
  { at: 700, title: 'MADE' },
  { at: 1400, title: 'SHOT CALLER' },
  { at: 2500, title: 'KING OF SOLMARA' },
];

function rankFor(points) {
  let cur = RANKS[0];
  let next = null;
  for (let i = 0; i < RANKS.length; i++) {
    if (points >= RANKS[i].at) cur = RANKS[i];
    else { next = RANKS[i]; break; }
  }
  return { title: cur.title, points, nextAt: next ? next.at : null };
}

const WEAPON_NAMES = { pistol: 'PISTOL', smg: 'SMG', shotgun: 'SHOTGUN' };

export function updateHUD(G, dt) {
  const el = (G.hud && G.hud.el) || {};
  const st = G.state || {};

  if (el['money']) el['money'].textContent = fmtMoney(st.money);

  if (el['stars']) {
    const wanted = Math.max(0, Math.min(5, st.wanted || 0));
    const spans = el['stars'].querySelectorAll('span');
    if (spans.length) {
      spans.forEach((s, i) => {
        s.textContent = i < wanted ? '★' : '☆';
        s.classList.toggle('lit', i < wanted);
      });
    } else {
      el['stars'].textContent = '★'.repeat(wanted) + '☆'.repeat(5 - wanted);
    }
  }

  if (el['wanted-label']) {
    el['wanted-label'].textContent = (st.wanted || 0) > 0
      ? 'WANTED ' + st.wanted + '★ — SMPD'
      : 'WANTED — CLEAR';
  }

  if (el['objective']) el['objective'].textContent = st.objectiveText || '';

  if (el['mission-label']) {
    const total = (G.missions && G.missions.list && G.missions.list.length) || 15;
    const idx = Math.min(st.missionIndex || 0, total - 1);
    const cur = G.missions && G.missions.list && G.missions.list[idx];
    el['mission-label'].textContent = cur
      ? 'MISSION ' + (idx + 1) + '/' + total + ' — ' + cur.title
      : 'MISSION ' + (idx + 1) + '/' + total;
  }

  if (el['health-fill']) {
    el['health-fill'].style.width = Math.max(0, Math.min(100, st.health || 0)) + '%';
  }
  if (el['health-bar']) {
    el['health-bar'].classList.toggle('low', (st.health || 0) <= 25);
  }

  if (el['speed']) {
    const sp = st.inVehicle ? (st.speed || 0) : (G.player ? G.player.speed || 0 : 0);
    el['speed'].textContent = Math.round(sp * 3.6) + ' km/h';
  }

  if (el['time']) el['time'].textContent = fmtClock(st.time);

  // Respect bar + label (round 4).
  let rank = null;
  if (G.helpers && G.helpers.respectRank) {
    try { rank = G.helpers.respectRank(); } catch (e) { rank = null; }
  }
  if (!rank) rank = rankFor((G.respect && G.respect.points) || 0);
  if (el['respect-label']) {
    el['respect-label'].textContent = rank.nextAt
      ? rank.title + ' · ' + rank.points + '/' + rank.nextAt
      : rank.title + ' · ' + rank.points + ' (MAX)';
  }
  if (el['respect-bar']) {
    const fill = el['respect-bar'].querySelector('.respect-fill')
      || document.getElementById('respect-fill');
    const pct = rank.nextAt
      ? Math.max(0, Math.min(100, (rank.points / rank.nextAt) * 100))
      : 100;
    if (fill) fill.style.width = pct + '%';
    else el['respect-bar'].style.setProperty('--fill', pct + '%');
  }

  // Crew box (round 4): "CREW: Mara +2".
  if (el['crew-box']) {
    let names = null;
    if (G.helpers && G.helpers.crewList) {
      try {
        names = G.helpers.crewList().map((m) => m.name.split(' ')[0]);
      } catch (e) { names = null; }
    }
    if (!names && G.crew && Array.isArray(G.crew.members)) {
      names = G.crew.members.map((id) => String(id).charAt(0).toUpperCase() + String(id).slice(1));
    }
    el['crew-box'].textContent = names && names.length
      ? 'CREW: ' + names.join(' + ')
      : 'CREW: —';
  }

  // Garage hint (round 4).
  if (el['garage-hint']) {
    el['garage-hint'].style.display = st.nearGarage ? 'block' : 'none';
    if (st.nearGarage) el['garage-hint'].textContent = 'GARAGE — press G';
  }

  // Weapon box (round 5): "PISTOL · 1/2/3" — current weapon + owned keys.
  if (el['weapon-box']) {
    const w = G.weapons || { owned: ['pistol'], current: 'pistol' };
    const owned = Array.isArray(w.owned) && w.owned.length ? w.owned : ['pistol'];
    const keys = ['pistol', 'smg', 'shotgun'].map((id, i) => {
      const n = String(i + 1);
      return owned.includes(id) ? '[' + n + ']' : n;
    }).join(' ');
    const name = WEAPON_NAMES[w.current] || String(w.current || 'PISTOL').toUpperCase();
    el['weapon-box'].textContent = name + ' · ' + keys;
  }

  // Seagull counter (round 5): "SEAGULLS 3/12".
  if (el['seagull-box']) {
    let found = 0;
    let total = 12;
    if (G.helpers && G.helpers.seagullCount) {
      try {
        const c = G.helpers.seagullCount();
        found = c.found; total = c.total;
      } catch (e) { /* fall through to G.collectibles */ }
    }
    if (G.collectibles && Array.isArray(G.collectibles.found)) {
      found = G.collectibles.found.filter(Boolean).length;
      total = G.collectibles.found.length || 12;
    }
    if (G.config && G.config.collectibles && G.config.collectibles.count) {
      total = G.config.collectibles.count;
    }
    el['seagull-box'].textContent = 'SEAGULLS ' + found + '/' + total;
  }

  // Race timer (round 5): "⏱ 42.3s · CHECKPOINT 2/3".
  if (el['race-timer']) {
    const race = G.race;
    if (race && race.active && race.checkpoints && race.checkpoints.length) {
      const elapsed = Math.max(0, (st.time || 0) - (race.startTime || 0));
      const cp = Math.min((race.current || 0) + 1, race.checkpoints.length);
      el['race-timer'].style.display = 'block';
      el['race-timer'].textContent = '⏱ ' + elapsed.toFixed(1) + 's · CHECKPOINT '
        + cp + '/' + race.checkpoints.length + ' · PAR ' + (race.parTime || 90) + 's';
    } else {
      el['race-timer'].style.display = 'none';
    }
  }

  // Bribe hint (round 5).
  if (el['bribe-hint']) {
    el['bribe-hint'].style.display = st.bribeAvailable ? 'block' : 'none';
    if (st.bribeAvailable) el['bribe-hint'].textContent = 'BRIBE — press B ($500)';
  }

  // Spike warning (round 5).
  if (el['spike-warning']) {
    const ahead = !!st.spikeAhead;
    const slowed = st.spikeSlowUntil && (st.time || 0) < st.spikeSlowUntil;
    el['spike-warning'].style.display = (ahead || slowed) ? 'block' : 'none';
    el['spike-warning'].textContent = slowed
      ? '⚠ TIRE BLOWN — SLOW!'
      : '⚠ SPIKE STRIP AHEAD';
  }

  // Lockpick bar (round 5, mission 14): progress 0..1 in G.state.lockpickProgress.
  const lp = el['lockpick-bar'];
  if (lp) {
    const p = st.lockpickProgress;
    const active = typeof p === 'number' && p > 0 && p < 1;
    lp.style.display = active ? 'block' : 'none';
    if (active) {
      const fill = el['lockpick-fill'] || lp.querySelector('.lockpick-fill');
      if (fill) fill.style.width = Math.round(p * 100) + '%';
      lp.dataset.progress = String(Math.round(p * 100));
      lp.setAttribute('aria-valuenow', String(Math.round(p * 100)));
    }
  }

  drawMinimap(G);
}

function drawMinimap(G) {
  const ctx = G.hud && G.hud.minimapCtx;
  const canvas = G.hud && G.hud.el && G.hud.el['minimap'];
  if (!ctx || !canvas) return;
  const S = 180;
  const half = 210; // city half-size (CONFIG.city.size / 2)
  const scale = S / (half * 2);
  const toX = (x) => (x + half) * scale;
  const toY = (z) => (z + half) * scale; // north (-z) is up

  // Sea + ground.
  ctx.fillStyle = '#1d5f7a';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#3d5a3a';
  ctx.fillRect(0, 0, S, S * 0.82); // land mass; south strip stays sea (bay/beach)
  ctx.fillStyle = '#d9c08a';
  ctx.fillRect(0, S * 0.80, S, 3); // beach line

  // Roads: use the city's road list when available, else the regular grid.
  ctx.strokeStyle = '#5a6068';
  ctx.lineWidth = 3;
  const roads = (G.city && G.city.roads) || [];
  if (roads.length) {
    for (const r of roads) {
      ctx.beginPath();
      if (r.x1 != null && r.z1 != null && r.x2 != null && r.z2 != null) {
        ctx.moveTo(toX(r.x1), toY(r.z1));
        ctx.lineTo(toX(r.x2), toY(r.z2));
      } else if (r.x != null && r.z != null) {
        ctx.moveTo(toX(r.x - 21), toY(r.z));
        ctx.lineTo(toX(r.x + 21), toY(r.z));
        ctx.moveTo(toX(r.x), toY(r.z - 21));
        ctx.lineTo(toX(r.x), toY(r.z + 21));
      }
      ctx.stroke();
    }
  } else {
    // Fallback: 9x9 block grid, block 42, road every block line.
    ctx.beginPath();
    for (let i = -4; i <= 4; i++) {
      const c = i * 42;
      ctx.moveTo(toX(c), toY(-half));
      ctx.lineTo(toX(c), toY(half));
      ctx.moveTo(toX(-half), toY(c));
      ctx.lineTo(toX(half), toY(c));
    }
    ctx.stroke();
  }

  // Race checkpoints (round 5): gold rings, current one drawn larger.
  const race = G.race;
  if (race && race.active && race.checkpoints) {
    race.checkpoints.forEach((cp, i) => {
      if (cp == null || cp.x == null || cp.z == null) return;
      ctx.strokeStyle = i === (race.current || 0) ? '#ffd23f' : 'rgba(255,210,63,0.45)';
      ctx.lineWidth = i === (race.current || 0) ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(toX(cp.x), toY(cp.z), i === (race.current || 0) ? 6 : 4, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  // Mission target: yellow star.
  const tgt = G.state && G.state.objectiveTarget;
  if (tgt && tgt.x != null && tgt.z != null) {
    const x = toX(tgt.x);
    const y = toY(tgt.z);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
      const px = x + Math.cos(a) * 6;
      const py = y + Math.sin(a) * 6;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Police dots (blue/red).
  const police = (G.police && G.police.cars) || [];
  for (const car of police) {
    if (!car || !car.pos) continue;
    ctx.fillStyle = '#3fa7ff';
    ctx.beginPath();
    ctx.arc(toX(car.pos.x), toY(car.pos.z), 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (G.police && G.police.heli && G.police.heli.pos) {
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(toX(G.police.heli.pos.x), toY(G.police.heli.pos.z), 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player: white dot + heading wedge.
  const p = G.player && G.player.pos;
  if (p) {
    const x = toX(p.x);
    const y = toY(p.z);
    const h = G.player.heading || 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    // Heading wedge: heading 0 faces -z (north).
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x + Math.sin(h) * 9, y - Math.cos(h) * 9);
    ctx.lineTo(x + Math.sin(h + 2.6) * 5, y - Math.cos(h + 2.6) * 5);
    ctx.lineTo(x + Math.sin(h - 2.6) * 5, y - Math.cos(h - 2.6) * 5);
    ctx.closePath();
    ctx.fill();
  }

  // North marker.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('N', S - 12, 12);
}
