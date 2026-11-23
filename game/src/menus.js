// menus.js — SOLMARA menus (round 5).
// Start / pause / game-over / garage / crew screens + the shared banner
// and hint toasts. DOM ids (index.html must contain them):
// #menu-start, #menu-pause, #menu-gameover, #banner, #banner-title,
// #banner-sub, #menu-garage, #menu-crew, #btn-garage, #btn-crew,
// #garage-list, #crew-list, #slot-1, #slot-2, #slot-3, #hint.
// Every lookup is defensive — a missing button is skipped, never fatal.
// Pause-screen stats (round 5) add: seagulls x/12, races won, best race
// time, weapons owned. Race results go through showBanner, no new screen.
// Esc pauses/resumes. The garage/crew screens pause the game while open
// and restore it on close.

export const CREW_ROSTER = [
  { id: 'mara', name: 'Mara Voss', role: 'Fixer', bonus: '+10% mission payout', recruit: null },
  { id: 'jax', name: 'Jax Calloway', role: 'Wheelman', bonus: '+15% getaway speed, police lose you faster', recruit: 'Recruit in mission 10' },
  { id: 'lena', name: 'Lena Marlowe', role: 'Ghost Driver', bonus: '-1 wanted star on mission start, +10% payout', recruit: 'Recruit in mission 11' },
];

const UPGRADE_COSTS = [800, 1800, 3500];

function $(id) {
  return document.getElementById(id);
}

function showOnly(id) {
  const ids = ['menu-start', 'menu-pause', 'menu-gameover', 'menu-garage', 'menu-crew'];
  for (const m of ids) {
    const el = $(m);
    if (el) el.style.display = m === id ? 'block' : 'none';
  }
}

function hideAllMenus() {
  showOnly(null);
}

function fmtClock(t) {
  const s = Math.max(0, Math.floor(t || 0));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function fmtRaceTime(sec) {
  if (sec == null || !isFinite(sec)) return '—';
  return Number(sec).toFixed(1) + 's';
}

export function initMenus(G) {
  G.menus = G.menus || {};
  G.menus.bannerTimer = null;
  G.menus.hintTimer = null;
  G.menus.prevEsc = false;
  G.menus.prevKeyG = false;
  G.menus.prevKeyC = false;
  G.menus.garageWasPaused = false;

  G.helpers = G.helpers || {};
  G.helpers.showBanner = (title, sub) => showBanner(G, title, sub);
  G.helpers.showHint = (text) => showHint(G, text);
  G.helpers.openGarageMenu = () => openGarageMenu(G);
  G.helpers.openCrewMenu = () => openCrewMenu(G);
  G.helpers.closeMenus = () => {
    hideAllMenus();
    if (G.state) G.state.paused = false;
  };

  // --- Start screen -------------------------------------------------------
  const btnStart = $('btn-start');
  if (btnStart) {
    btnStart.addEventListener('click', () => {
      if (G.helpers.resumeAudio) G.helpers.resumeAudio();
      if (G.helpers.playSound) G.helpers.playSound('click');
      startGame(G);
    });
  }
  const btnNew = $('btn-new-game');
  if (btnNew) {
    btnNew.addEventListener('click', () => {
      if (G.helpers.resumeAudio) G.helpers.resumeAudio();
      if (G.helpers.playSound) G.helpers.playSound('click');
      // Fresh run: clear any loaded save state back to the defaults.
      if (G.state) {
        G.state.money = 500;
        G.state.missionIndex = 0;
        G.state.health = 100;
        G.state.wanted = 0;
      }
      if (G.respect) G.respect.points = 0;
      if (G.crew) G.crew.members = ['mara'];
      if (G.garage) { G.garage.owned = []; G.garage.active = 0; }
      if (G.weapons) { G.weapons.owned = ['pistol']; G.weapons.current = 'pistol'; }
      if (G.collectibles) G.collectibles.found = new Array(12).fill(false);
      startGame(G);
    });
  }
  // 3 slot buttons: CONTINUE — SLOT n (money / mission / rank, or EMPTY).
  for (let slot = 1; slot <= 3; slot++) {
    const btn = $('slot-' + slot);
    if (!btn) continue;
    btn.addEventListener('click', () => {
      if (G.helpers.resumeAudio) G.helpers.resumeAudio();
      if (G.helpers.loadGame) {
        try { G.helpers.loadGame(slot); } catch (e) { /* empty slot: stay */ }
      }
      if (G.helpers.playSound) G.helpers.playSound('click');
      startGame(G);
    });
  }
  refreshSlotButtons(G);

  // --- Pause screen -------------------------------------------------------
  const btnResume = $('btn-resume');
  if (btnResume) {
    btnResume.addEventListener('click', () => {
      if (G.helpers.playSound) G.helpers.playSound('click');
      resumeGame(G);
    });
  }
  for (let slot = 1; slot <= 3; slot++) {
    const btn = $('btn-save-' + slot);
    if (!btn) continue;
    btn.addEventListener('click', () => {
      if (G.helpers.saveGame) {
        try { G.helpers.saveGame(slot); } catch (e) { /* ignore */ }
      }
      if (G.helpers.playSound) G.helpers.playSound('cash');
      if (G.helpers.showHint) G.helpers.showHint('SAVED TO SLOT ' + slot);
      refreshSlotButtons(G);
    });
  }
  const btnGarage = $('btn-garage');
  if (btnGarage) {
    btnGarage.addEventListener('click', () => {
      if (G.helpers.playSound) G.helpers.playSound('click');
      openGarageMenu(G);
    });
  }
  const btnCrew = $('btn-crew');
  if (btnCrew) {
    btnCrew.addEventListener('click', () => {
      if (G.helpers.playSound) G.helpers.playSound('click');
      openCrewMenu(G);
    });
  }
  const btnRestart = $('btn-restart');
  if (btnRestart) {
    btnRestart.addEventListener('click', () => {
      if (G.helpers.playSound) G.helpers.playSound('click');
      if (G.state) {
        G.state.health = 100;
        G.state.wanted = 0;
        G.state.gameOver = false;
      }
      resumeGame(G);
    });
  }
  const btnQuit = $('btn-quit');
  if (btnQuit) {
    btnQuit.addEventListener('click', () => {
      if (G.helpers.playSound) G.helpers.playSound('click');
      if (G.state) G.state.started = false;
      refreshSlotButtons(G);
      showOnly('menu-start');
    });
  }

  // --- Game over ----------------------------------------------------------
  const btnRetry = $('btn-retry');
  if (btnRetry) {
    btnRetry.addEventListener('click', () => {
      if (G.helpers.playSound) G.helpers.playSound('click');
      if (G.state) {
        G.state.health = 100;
        G.state.wanted = 0;
        G.state.gameOver = false;
      }
      if (G.helpers.loadGame) {
        try { G.helpers.loadGame(); } catch (e) { /* no save: respawn here */ }
      }
      resumeGame(G);
    });
  }

  // --- Garage screen ------------------------------------------------------
  const btnGarageClose = $('btn-garage-close');
  if (btnGarageClose) {
    btnGarageClose.addEventListener('click', () => {
      if (G.helpers.playSound) G.helpers.playSound('click');
      closeSubMenu(G);
    });
  }
  const btnStoreCar = $('btn-store-car');
  if (btnStoreCar) {
    btnStoreCar.addEventListener('click', () => {
      if (G.helpers.storeCar && G.state && G.state.inVehicle) {
        try { G.helpers.storeCar(G.state.inVehicle); } catch (e) { /* full */ }
      } else if (G.helpers.showHint) {
        G.helpers.showHint('No car to store — drive one here first');
      }
      renderGarageList(G);
    });
  }
  const garageList = $('garage-list');
  if (garageList) {
    // One delegated listener for every per-car REPAIR / PAINT / UPGRADE button.
    garageList.addEventListener('click', (ev) => {
      const btn = ev.target && ev.target.closest ? ev.target.closest('button[data-car]') : null;
      if (!btn) return;
      const idx = Number(btn.dataset.car);
      const action = btn.dataset.action;
      if (G.helpers.playSound) G.helpers.playSound('click');
      if (action === 'repair' && G.helpers.repairCar) {
        try { G.helpers.repairCar(idx); } catch (e) { /* not enough cash */ }
      } else if (action === 'paint' && G.helpers.paintCar) {
        try { G.helpers.paintCar(idx); } catch (e) { /* not enough cash */ }
      } else if (action === 'upgrade' && G.helpers.upgradeCar) {
        try { G.helpers.upgradeCar(idx); } catch (e) { /* maxed / poor / rank */ }
      }
      renderGarageList(G);
    });
  }

  // --- Crew screen --------------------------------------------------------
  const btnCrewClose = $('btn-crew-close');
  if (btnCrewClose) {
    btnCrewClose.addEventListener('click', () => {
      if (G.helpers.playSound) G.helpers.playSound('click');
      closeSubMenu(G);
    });
  }

  // Start screen is up until the player presses START.
  if (G.state && !G.state.started) showOnly('menu-start');
  updatePauseStats(G);
}

function startGame(G) {
  if (G.state) {
    G.state.started = true;
    G.state.paused = false;
    G.state.gameOver = false;
  }
  hideAllMenus();
  if (G.helpers && G.helpers.showBanner && G.state && (G.state.missionIndex || 0) === 0) {
    G.helpers.showBanner('SOLMARA', 'Meet Mara at the Ember Garage');
  }
}

function resumeGame(G) {
  if (G.state) G.state.paused = false;
  hideAllMenus();
}

function closeSubMenu(G) {
  hideAllMenus();
  if (G.state) G.state.paused = !!G.menus.garageWasPaused;
  if (!G.state.paused && G.state.started) {
    // Back to the game.
  } else if (G.state && G.state.started) {
    showOnly('menu-pause');
  }
}

export function openGarageMenu(G) {
  G.menus = G.menus || {};
  G.menus.garageWasPaused = !!(G.state && G.state.paused);
  if (G.state) G.state.paused = true;
  renderGarageList(G);
  showOnly('menu-garage');
}

export function openCrewMenu(G) {
  G.menus = G.menus || {};
  G.menus.garageWasPaused = !!(G.state && G.state.paused);
  if (G.state) G.state.paused = true;
  renderCrewList(G);
  showOnly('menu-crew');
}

function renderGarageList(G) {
  const list = $('garage-list');
  if (!list) return;
  let cars = [];
  if (G.helpers && G.helpers.garageCars) {
    try { cars = G.helpers.garageCars() || []; } catch (e) { cars = []; }
  } else if (G.garage && Array.isArray(G.garage.owned)) {
    cars = G.garage.owned;
  }
  const money = (G.state && G.state.money) || 0;
  if (!cars.length) {
    list.innerHTML = '<p>Garage is empty — drive a car here and press STORE CURRENT CAR.</p>'
      + '<p>Max ' + ((G.config && G.config.garage && G.config.garage.maxCars) || 4) + ' cars.</p>';
    return;
  }
  list.innerHTML = cars.map((car, i) => {
    const name = car.name || 'Car ' + (i + 1);
    const paint = car.paint || car.color || '—';
    const up = car.upgrade || 0;
    const nextCost = up < 3 ? UPGRADE_COSTS[up] : null;
    const upLabel = nextCost ? 'UPGRADE $' + nextCost + ' (Lv ' + (up + 1) + ')' : 'MAX LEVEL';
    return '<div class="garage-car">'
      + '<strong>' + name + '</strong> · ' + paint + ' · Lv ' + up
      + ' <button data-car="' + i + '" data-action="repair"' + (money < 150 ? ' disabled' : '') + '>REPAIR $150</button>'
      + ' <button data-car="' + i + '" data-action="paint"' + (money < 200 ? ' disabled' : '') + '>PAINT $200</button>'
      + ' <button data-car="' + i + '" data-action="upgrade"' + (nextCost == null || money < nextCost ? ' disabled' : '') + '>' + upLabel + '</button>'
      + '</div>';
  }).join('');
}

function renderCrewList(G) {
  const list = $('crew-list');
  if (!list) return;
  let owned = [];
  if (G.helpers && G.helpers.crewList) {
    try { owned = G.helpers.crewList().map((m) => m.id); } catch (e) { owned = []; }
  } else if (G.crew && Array.isArray(G.crew.members)) {
    owned = G.crew.members;
  }
  list.innerHTML = CREW_ROSTER.map((m) => {
    const has = owned.includes(m.id);
    const cls = has ? 'crew-member' : 'crew-member locked';
    const status = has ? m.bonus : (m.recruit || 'Locked');
    return '<div class="' + cls + '"><strong>' + m.name + '</strong> — ' + m.role
      + '<br><span>' + status + '</span></div>';
  }).join('');
}

export function refreshSlotButtons(G) {
  let saves = null;
  if (G.helpers && G.helpers.listSaves) {
    try { saves = G.helpers.listSaves(); } catch (e) { saves = null; }
  }
  for (let slot = 1; slot <= 3; slot++) {
    const btn = $('slot-' + slot);
    if (!btn) continue;
    const s = saves && saves[slot - 1];
    if (s) {
      const rank = s.rank || 'NOBODY';
      btn.textContent = 'CONTINUE — SLOT ' + slot + ': $'
        + (s.money || 0).toLocaleString('en-US')
        + ' · Mission ' + ((s.missionIndex || 0) + 1) + ' · ' + rank;
      btn.disabled = false;
    } else {
      btn.textContent = 'CONTINUE — SLOT ' + slot + ': EMPTY';
      btn.disabled = false;
    }
  }
}

function updatePauseStats(G) {
  const stats = $('pause-stats');
  if (!stats) return;
  const st = G.state || {};
  const missionsDone = st.missionIndex || 0;
  let rank = 'NOBODY';
  if (G.helpers && G.helpers.respectRank) {
    try { rank = G.helpers.respectRank().title; } catch (e) { /* keep default */ }
  } else if (G.respect) {
    const pts = G.respect.points || 0;
    rank = pts >= 2500 ? 'KING OF SOLMARA' : pts >= 1400 ? 'SHOT CALLER'
      : pts >= 700 ? 'MADE' : pts >= 300 ? 'WHEELMAN'
      : pts >= 100 ? 'STREET HUSTLER' : 'NOBODY';
  }
  // Round-5 lines: seagulls, races, best race time, weapons owned.
  let seagulls = '0/12';
  if (G.helpers && G.helpers.seagullCount) {
    try {
      const c = G.helpers.seagullCount();
      seagulls = c.found + '/' + c.total;
    } catch (e) { /* fall through */ }
  } else if (G.collectibles && Array.isArray(G.collectibles.found)) {
    seagulls = G.collectibles.found.filter(Boolean).length + '/' + G.collectibles.found.length;
  }
  const racesWon = (G.stats && G.stats.racesWon) || (G.race && G.race.won) || 0;
  const best = (G.stats && G.stats.raceBest != null) ? G.stats.raceBest
    : (G.race && G.race.best) || null;
  const weapons = (G.weapons && Array.isArray(G.weapons.owned))
    ? G.weapons.owned.map((w) => w.toUpperCase()).join(', ') : 'PISTOL';
  const lines = [
    'Missions done: ' + missionsDone,
    'Kills: ' + (st.kills || 0),
    'Cars stolen: ' + (st.carsStolen || 0),
    'Playtime: ' + fmtClock(st.time),
    'Respect: ' + rank,
    'Seagulls: ' + seagulls,
    'Races won: ' + racesWon,
    'Best race time: ' + fmtRaceTime(best),
    'Weapons: ' + weapons,
  ];
  stats.textContent = lines.join(' · ');
}

export function showBanner(G, title, sub) {
  const banner = $('banner');
  const titleEl = $('banner-title');
  const subEl = $('banner-sub');
  if (!banner) return;
  if (titleEl) titleEl.textContent = title || '';
  if (subEl) subEl.textContent = sub || '';
  banner.style.display = 'block';
  banner.classList.add('show');
  if (G.menus && G.menus.bannerTimer) clearTimeout(G.menus.bannerTimer);
  if (G.menus) {
    G.menus.bannerTimer = setTimeout(() => {
      banner.style.display = 'none';
      banner.classList.remove('show');
    }, 3000);
  }
}

export function showHint(G, text) {
  const hint = $('hint');
  if (!hint) return;
  hint.textContent = text || '';
  hint.style.display = 'block';
  hint.style.opacity = '1';
  if (G.menus && G.menus.hintTimer) clearTimeout(G.menus.hintTimer);
  if (G.menus) {
    G.menus.hintTimer = setTimeout(() => {
      hint.style.opacity = '0';
      hint.style.display = 'none';
    }, 4000);
  }
}

export function updateMenus(G, dt) {
  if (!G.state) return;
  const keys = (G.input && G.input.keys) || new Set();

  // Esc pauses / resumes (edge-triggered).
  const escDown = keys.has('Escape');
  if (escDown && !G.menus.prevEsc) {
    if (G.state.started && !G.state.gameOver) {
      if (G.state.paused) {
        resumeGame(G);
      } else {
        G.state.paused = true;
        updatePauseStats(G);
        showOnly('menu-pause');
      }
    }
  }
  G.menus.prevEsc = escDown;

  // G opens the garage near the Ember Garage (garage.js sets nearGarage).
  const gDown = keys.has('KeyG');
  if (gDown && !G.menus.prevKeyG && G.state.started && !G.state.paused && G.state.nearGarage) {
    openGarageMenu(G);
  }
  G.menus.prevKeyG = gDown;

  // C opens the crew screen (round-4 controls list: G garage, C crew).
  const cDown = keys.has('KeyC');
  if (cDown && !G.menus.prevKeyC && G.state.started && !G.state.paused) {
    openCrewMenu(G);
  }
  G.menus.prevKeyC = cDown;

  // Game-over screen appears once, when health hits 0.
  if (G.state.gameOver) {
    const go = $('menu-gameover');
    if (go && go.style.display !== 'block') {
      const label = $('gameover-label');
      if (label) label.textContent = 'BUSTED BY THE SMPD — Dante is down.';
      showOnly('menu-gameover');
    }
    return;
  }

  // Keep the pause stats fresh while the pause menu is visible.
  const pause = $('menu-pause');
  if (pause && pause.style.display === 'block') updatePauseStats(G);
}
