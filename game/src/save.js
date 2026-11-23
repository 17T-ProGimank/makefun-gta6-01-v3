// save.js — SOLMARA round 5: 3-slot save, payload version 3.
// Slot keys: solmara-save-v1 / v2 / v3 (slots 1/2/3). Active slot lives in
// G.save.slot (1..3, default 1). Autosaves every 30s to the active slot and
// on every mission complete (missions.js calls saveGame). Payload v3 adds
// weapons {owned, current}, seagulls [bool x12], raceBest (seconds | null)
// and racesWon on top of everything round 4 persisted. Loading a v2 payload
// migrates the missing fields to their defaults. All reads are defensive:
// a corrupt or missing slot is ignored, never a crash.

const KEYS = { 1: 'solmara-save-v1', 2: 'solmara-save-v2', 3: 'solmara-save-v3' };
const AUTOSAVE_SECS = 30;

function call(G, name, ...args) {
  const fn = G && G.helpers && G.helpers[name];
  if (typeof fn === 'function') {
    try { return fn(...args); } catch (e) { /* helper failed: ignore */ }
  }
  return undefined;
}

function clampSlot(n) {
  const s = parseInt(n, 10);
  return s >= 1 && s <= 3 ? s : 1;
}

// Rank title for a respect-points total (same thresholds as respect.js).
function rankTitle(points) {
  const thresholds = [
    [0, 'NOBODY'], [100, 'STREET HUSTLER'], [300, 'WHEELMAN'],
    [700, 'MADE'], [1400, 'SHOT CALLER'], [2500, 'KING OF SOLMARA'],
  ];
  let title = 'NOBODY';
  for (const [at, name] of thresholds) if (points >= at) title = name;
  return title;
}

function readSlot(slot) {
  try {
    const raw = localStorage.getItem(KEYS[clampSlot(slot)]);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch (e) { return null; }
}

function buildPayload(G) {
  const state = G.state || {};
  const respect = G.respect || {};
  const crew = G.crew || {};
  const garage = G.garage || {};
  const audio = G.audio || {};
  const weapons = G.weapons || {};
  const collectibles = G.collectibles || {};
  return {
    version: 3,
    savedAt: Date.now(),
    money: Math.max(0, state.money || 0),
    missionIndex: Math.max(0, Math.min(14, state.missionIndex || 0)),
    respect: typeof respect.points === 'number' ? respect.points : 0,
    crew: Array.isArray(crew.members) ? crew.members.slice() : ['mara'],
    garageOwned: Array.isArray(garage.owned) ? garage.owned.map((c) => ({ ...c })) : [],
    garageActive: typeof garage.active === 'number' ? garage.active : 0,
    radioStation: typeof audio.station === 'number' ? audio.station : 0,
    radioOn: !!audio.radioOn,
    stats: {
      kills: state.kills || 0,
      carsStolen: state.carsStolen || 0,
      missionsDone: Math.max(0, Math.min(14, state.missionIndex || 0)),
      time: Math.max(0, state.time || 0),
    },
    player: {
      x: (G.player && G.player.pos && G.player.pos.x) || 0,
      z: (G.player && G.player.pos && G.player.pos.z) || 0,
      heading: (G.player && G.player.heading) || 0,
    },
    health: Math.max(0, Math.min(100, state.health || 100)),
    weapons: {
      owned: Array.isArray(weapons.owned) && weapons.owned.length ? weapons.owned.slice() : ['pistol'],
      current: typeof weapons.current === 'string' ? weapons.current : 'pistol',
    },
    seagulls: Array.isArray(collectibles.found) && collectibles.found.length === 12
      ? collectibles.found.slice()
      : new Array(12).fill(false),
    raceBest: typeof G.raceBest === 'number' ? G.raceBest : null,
    racesWon: typeof G.racesWon === 'number' ? G.racesWon : 0,
  };
}

function applyPayload(G, data) {
  if (!data) return false;
  const state = G.state || {};
  state.money = Math.max(0, typeof data.money === 'number' ? data.money : 500);
  state.missionIndex = Math.max(0, Math.min(14, typeof data.missionIndex === 'number' ? data.missionIndex : 0));
  // Re-point the missions module: initMissions ran before initSave and
  // started mission 1, so a loaded save must move it to the saved mission
  // (updateMissions starts it fresh via _started = false).
  if (G.missions && Array.isArray(G.missions.list)) {
    G.missions.currentIndex = state.missionIndex;
    G.missions.current = G.missions.list[state.missionIndex] || null;
    G.missions._started = false;
    G.missions.stage = 0;
    G.missions.lockpick = 0;
  }
  state.health = Math.max(0, Math.min(100, typeof data.health === 'number' ? data.health : 100));
  if (data.stats && typeof data.stats === 'object') {
    state.kills = data.stats.kills || 0;
    state.carsStolen = data.stats.carsStolen || 0;
    state.time = data.stats.time || 0;
  }
  if (G.respect) G.respect.points = typeof data.respect === 'number' ? data.respect : 0;
  if (G.crew && Array.isArray(data.crew)) G.crew.members = data.crew.slice();
  if (G.garage) {
    G.garage.owned = Array.isArray(data.garageOwned) ? data.garageOwned.map((c) => ({ ...c })) : [];
    G.garage.active = typeof data.garageActive === 'number' ? data.garageActive : 0;
  }
  if (G.audio) {
    G.audio.station = typeof data.radioStation === 'number' ? data.radioStation : 0;
    G.audio.radioOn = !!data.radioOn;
  }
  if (data.player && typeof data.player === 'object' && G.player && G.player.pos) {
    G.player.pos.x = data.player.x || 0;
    G.player.pos.z = data.player.z || 0;
    G.player.heading = data.player.heading || 0;
  }
  // v3 fields (missing on v2 payloads → defaults: pistol-only, no seagulls,
  // no best time, no races won).
  G.weapons = G.weapons || {};
  if (data.weapons && typeof data.weapons === 'object') {
    G.weapons.owned = Array.isArray(data.weapons.owned) && data.weapons.owned.length
      ? data.weapons.owned.slice() : ['pistol'];
    G.weapons.current = typeof data.weapons.current === 'string' ? data.weapons.current : 'pistol';
  } else {
    G.weapons.owned = ['pistol'];
    G.weapons.current = 'pistol';
  }
  G.collectibles = G.collectibles || {};
  G.collectibles.found = Array.isArray(data.seagulls) && data.seagulls.length === 12
    ? data.seagulls.slice()
    : new Array(12).fill(false);
  G.raceBest = typeof data.raceBest === 'number' ? data.raceBest : null;
  G.racesWon = typeof data.racesWon === 'number' ? data.racesWon : 0;
  // Keep the raw payload around for modules that read G.saveData on init.
  G.saveData = data;
  return true;
}

export function saveGame(G, slot) {
  const s = clampSlot(typeof slot === 'number' ? slot : (G.save && G.save.slot) || 1);
  try {
    localStorage.setItem(KEYS[s], JSON.stringify(buildPayload(G)));
    return true;
  } catch (e) { return false; }
}

export function loadGame(G, slot) {
  const s = clampSlot(typeof slot === 'number' ? slot : (G.save && G.save.slot) || 1);
  const data = readSlot(s);
  if (!data) return false;
  return applyPayload(G, data);
}

// listSaves(): one entry per slot — {slot, money, missionIndex, rank, savedAt}
// or null when the slot is empty/corrupt.
export function listSaves() {
  const out = [];
  for (let slot = 1; slot <= 3; slot++) {
    const data = readSlot(slot);
    if (!data) { out.push(null); continue; }
    out.push({
      slot,
      money: typeof data.money === 'number' ? data.money : 0,
      missionIndex: Math.max(0, Math.min(14, typeof data.missionIndex === 'number' ? data.missionIndex : 0)),
      rank: rankTitle(typeof data.respect === 'number' ? data.respect : 0),
      savedAt: data.savedAt || null,
    });
  }
  return out;
}

export function initSave(G) {
  G.save = G.save || {};
  if (typeof G.save.slot !== 'number') G.save.slot = 1;
  G.save.slot = clampSlot(G.save.slot);
  G.save._autosaveT = 0;
  G.helpers = G.helpers || {};

  // Load the active slot if one exists (applies money/mission/position and
  // the v3 fields; v2 payloads migrate with defaults).
  loadGame(G, G.save.slot);

  G.helpers.saveGame = (slot) => saveGame(G, slot);
  G.helpers.loadGame = (slot) => loadGame(G, slot);
  G.helpers.listSaves = () => listSaves();
  G.helpers.setSlot = (n) => {
    G.save.slot = clampSlot(n);
    return G.save.slot;
  };
  // saveRaceBest: persist a new best race time (called by missions.js).
  G.helpers.saveRaceBest = (seconds) => {
    if (typeof seconds !== 'number') return false;
    if (typeof G.raceBest !== 'number' || seconds < G.raceBest) G.raceBest = seconds;
    return saveGame(G);
  };

  // Autosave every 30s to the active slot while the game is running.
  try {
    if (typeof setInterval === 'function') {
      setInterval(() => {
        try {
          if (G.state && G.state.started && !G.state.paused && !G.state.gameOver) saveGame(G);
        } catch (e) { /* ignore */ }
      }, AUTOSAVE_SECS * 1000);
    }
  } catch (e) { /* timers unavailable: updateSave covers it */ }
}

// updateSave(G, dt): frame-driven autosave fallback (main.js may call it;
// the setInterval in initSave is the primary path).
export function updateSave(G, dt) {
  if (!G || !G.save || !G.state) return;
  if (!G.state.started || G.state.paused || G.state.gameOver) return;
  G.save._autosaveT = (G.save._autosaveT || 0) + (dt || 0);
  if (G.save._autosaveT >= AUTOSAVE_SECS) {
    G.save._autosaveT = 0;
    saveGame(G);
  }
}
