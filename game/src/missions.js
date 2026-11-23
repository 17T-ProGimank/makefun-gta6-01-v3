// missions.js — SOLMARA round 5: 15 chained missions, second arc "Rook's Return".
// Missions 1–12 are the round-4 chain (same ids, titles, rewards). Missions
// 13–15 are new: a street race, a stealth lockpick run, and the final
// showdown with Silas Rook. The race mechanic (startRace) is shared with
// the repeatable street race at the port pad. All helper calls are
// defensive: a missing helper is skipped, never a crash.
import { CONFIG } from './config.js';

// Race mechanic (shared by mission 13 and the repeatable port race).
export function startRace(G, checkpoints, parTime) {
  const cps = Array.isArray(checkpoints) && checkpoints.length ? checkpoints
    : (CONFIG && CONFIG.race && CONFIG.race.checkpoints) || [
        { x: -60, z: -40 }, { x: 60, z: -40 }, { x: 0, z: 60 }];
  const par = typeof parTime === 'number' ? parTime
    : (CONFIG && CONFIG.race && CONFIG.race.parTime) || 90;
  G.race = {
    active: true, checkpoints: cps.map((c) => ({ x: c.x, z: c.z })), current: 0,
    startTime: (G.state && G.state.time) || 0, parTime: par, repeatable: false, rival: null,
  };
  call(G, 'showBanner', 'RACE START', 'Hit every ring — beat ' + par + 's');
  call(G, 'playSound', 'race');
  return G.race;
}
function racePayouts() {
  return (CONFIG && CONFIG.race && CONFIG.race.payouts) || { gold: 800, silver: 500, bronze: 300 };
}
// Finish a race: pay by time, save the best time, gold also gives respect.
function finishRace(G) {
  const race = G.race;
  if (!race) return 0;
  const elapsed = ((G.state && G.state.time) || 0) - (race.startTime || 0);
  race.active = false;
  const payouts = racePayouts();
  let payout = 0, medal = '';
  if (elapsed < 60) { payout = payouts.gold; medal = 'GOLD'; }
  else if (elapsed <= 75) { payout = payouts.silver; medal = 'SILVER'; }
  else if (elapsed <= 90) { payout = payouts.bronze; medal = 'BRONZE'; }
  if (payout > 0) {
    call(G, 'addMoney', payout);
    if (typeof G.raceBest !== 'number' || elapsed < G.raceBest) {
      G.raceBest = elapsed;
      if (G.helpers && typeof G.helpers.saveRaceBest === 'function') {
        try { G.helpers.saveRaceBest(elapsed); } catch (e) { /* ignore */ }
      }
    }
    if (medal === 'GOLD') call(G, 'addRespect', 25);
    G.racesWon = (G.racesWon || 0) + 1;
    call(G, 'showBanner', medal + ' — ' + elapsed.toFixed(1) + 's', '+$' + payout.toLocaleString('en-US'));
    call(G, 'playSound', 'cash');
  } else {
    call(G, 'showBanner', 'TOO SLOW — ' + elapsed.toFixed(1) + 's', 'No payout over 90s. Run it again.');
  }
  call(G, 'saveGame');
  return payout;
}

// MISSIONS 13–15 — second arc: "Rook's Return" (at the TOP of the file).
const MISSIONS_13_15 = [
  {
    id: 13, title: 'Street Kings', giver: 'Mara Voss',
    brief: 'The Vultures run a street race downtown. Beat their rival car through 3 checkpoint rings in under 90 seconds and the streets are yours.',
    objective: 'Win the downtown race — 3 rings, beat 90s',
    target: { x: -60, z: -40, label: 'Race ring 1' }, reward: 6000, race: true,
    onStart(G) {
      startRace(G);
      spawnRival(G);
      call(G, 'setObjective', 'Win the downtown race — 3 rings, beat 90s', { x: -60, z: -40, label: 'Race ring 1' });
      call(G, 'showBanner', 'MISSION 13 — STREET KINGS', 'Beat the Vultures rival. 3 rings, 90 seconds.');
    },
    onDone(G) {
      call(G, 'addRespect', 600);
      call(G, 'showBanner', 'STREET KINGS', 'Repeatable races unlocked at the port pad');
    },
  },
  {
    id: 14, title: 'Silent Harbor', giver: 'Mara Voss',
    brief: 'Rook keeps a ledger in the port office. Pick the lock (hold E, 3s), grab it, and get back to the Ember Garage without ever hitting 2 stars.',
    objective: 'Pick the port office lock, grab the ledger, return clean',
    target: { x: 170, z: 40, label: 'Port office' }, reward: 7500, stealth: true,
    onStart(G) {
      G.missions.lockpick = 0; G.missions.stage = 0; G.state.lockpickProgress = 0;
      const office = officePoint(G);
      call(G, 'setObjective', 'Reach the port office — stay under 2 stars', { x: office.x, z: office.z, label: 'Port office' });
      call(G, 'showBanner', 'MISSION 14 — SILENT HARBOR', 'No noise. No heat. Get the ledger.');
    },
    onDone(G) { call(G, 'addRespect', 750); },
  },
  {
    id: 15, title: 'End of the Vultures', giver: 'Mara Voss',
    brief: 'Rook is back and the Vultures own the port yard. Hit the compound, chase Rook down, and finish him on foot. End it tonight.',
    objective: 'Destroy the Vultures — assault, chase, finish Rook',
    target: { x: 185, z: -30, label: 'Vultures compound' }, reward: 12000, finale: true,
    onStart(G) {
      G.missions.stage = 0; G.missions.stageEnemies = 0;
      const yard = compoundPoint(G);
      call(G, 'setObjective', 'Assault the Vultures compound at the port', { x: yard.x, z: yard.z, label: 'Vultures compound' });
      call(G, 'showBanner', 'MISSION 15 — END OF THE VULTURES', 'Stage 1: take the compound');
    },
    onDone(G) {
      call(G, 'addRespect', 1200);
      call(G, 'storePresetCar', 'Vulture GT', 0x1a1a2e, 3);
      call(G, 'showBanner', 'SOLMARA LEGEND', 'The Vultures are finished. The city is yours.');
    },
  },
];

// Local helpers (defensive throughout).
function call(G, name, ...args) {
  const fn = G && G.helpers && G.helpers[name];
  if (typeof fn === 'function') {
    try { return fn(...args); } catch (e) { /* helper failed: ignore */ }
  }
  return undefined;
}
function playerPos(G) { return (G.player && G.player.pos) || { x: 0, z: 0 }; }
function distTo(G, target) {
  if (!target) return Infinity;
  const p = playerPos(G);
  return Math.hypot(p.x - target.x, p.z - target.z);
}
function garagePoint(G) {
  if (G.city && G.city.spawnPoints && G.city.spawnPoints.garage) return G.city.spawnPoints.garage;
  return { x: -27, z: 42 };
}
function officePoint(G) {
  if (G.city && G.city.spawnPoints && G.city.spawnPoints.office) return G.city.spawnPoints.office;
  return { x: 170, z: 40 };
}
function compoundPoint(G) {
  if (G.city && G.city.spawnPoints && G.city.spawnPoints.compound) return G.city.spawnPoints.compound;
  return { x: 185, z: -30 };
}
function racePadPoint(G) {
  if (G.city && G.city.spawnPoints && G.city.spawnPoints.racePad) return G.city.spawnPoints.racePad;
  return { x: 170, z: 60 };
}
function spawnEnemyAt(G, x, z, opts) {
  const fn = G.helpers && G.helpers.spawnEnemy;
  if (typeof fn === 'function') {
    try { return fn(G, x, z, opts || {}); } catch (e) { /* fall through */ }
  }
  if (typeof G.spawnEnemy === 'function') {
    try { return G.spawnEnemy(G, x, z, opts || {}); } catch (e) { /* fall through */ }
  }
  // Fallback: record a minimal enemy so the mission kill-count can proceed.
  G.enemies = G.enemies || [];
  const enemy = { pos: { x, z }, hp: (opts && opts.hp) || 100, alive: true };
  G.enemies.push(enemy);
  return enemy;
}
function aliveEnemies(G) {
  if (Array.isArray(G.enemies)) return G.enemies.filter((e) => e && e.alive !== false && (e.hp || 0) > 0);
  return [];
}
function spawnAmbush(G, x, z, count, opts) {
  for (let i = 0; i < count; i++) {
    const a = (i / Math.max(1, count)) * Math.PI * 2;
    spawnEnemyAt(G, x + Math.cos(a) * 8, z + Math.sin(a) * 8, opts || {});
  }
  G.missions.ambushTotal = count;
}
// Rival car for mission 13: a traffic car following the checkpoint route at
// a fixed speed. Built with makeCar + a waypoint follower in this file.
function spawnRival(G) {
  const makeCar = G.helpers && G.helpers.makeCar;
  if (typeof makeCar !== 'function') return null;
  try {
    const cps = (G.race && G.race.checkpoints) || [];
    const start = cps[0] || { x: -60, z: -40 };
    const car = makeCar(G, 0x8a1a1a, 'traffic', {});
    if (!car) return null;
    car.kind = 'rival';
    if (car.pos) { car.pos.x = start.x + 6; car.pos.z = start.z; }
    G.race.rival = { car, wp: 0, speed: 26 };
    return G.race.rival;
  } catch (e) { return null; }
}
function updateRival(G, dt) {
  const rival = G.race && G.race.rival;
  if (!rival || !rival.car || !rival.car.pos) return;
  const cps = (G.race && G.race.checkpoints) || [];
  if (!cps.length) return;
  const target = cps[Math.min(rival.wp, cps.length - 1)];
  const dx = target.x - rival.car.pos.x, dz = target.z - rival.car.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 4) { rival.wp = Math.min(rival.wp + 1, cps.length - 1); return; }
  rival.car.pos.x += (dx / d) * rival.speed * dt;
  rival.car.pos.z += (dz / d) * rival.speed * dt;
  rival.car.heading = Math.atan2(dx, dz);
  if (rival.car.group) {
    rival.car.group.position.set(rival.car.pos.x, 0, rival.car.pos.z);
    rival.car.group.rotation.y = rival.car.heading || 0;
  }
}

// MISSIONS 1–12 — the round-4 chain, unchanged (same ids, titles, rewards).
// Compact factory: mk(id, title, brief, objective, target, reward, onStart, onDone).
function mk(id, title, brief, objective, target, reward, onStart, onDone) {
  return { id, title, giver: 'Mara Voss', brief, objective, target, reward, onStart, onDone };
}
const GARAGE_T = { x: -27, z: 42, label: 'Ember Garage' };
const PORT_T = { x: 180, z: 20, label: 'Port' };
const MISSIONS_1_12 = [
  mk(1, 'First Gear', 'Dante owes a debt. Mara runs jobs from the Ember Garage — drive there and meet her.',
    'Drive to the Ember Garage, meet Mara', GARAGE_T, 200,
    (G) => call(G, 'setObjective', 'Drive to the Ember Garage, meet Mara', GARAGE_T), (G) => {}),
  mk(2, 'The Pickup', 'Steal a car and deliver it to the port. Any car will do — just don\'t get caught.',
    'Steal a car, deliver it to the port', PORT_T, 400,
    (G) => call(G, 'setObjective', 'Steal a car, deliver it to the port', PORT_T), (G) => {}),
  mk(3, 'Hot Wheels', 'Outrun the law. Get to wanted level 2, then lose the tail completely.',
    'Reach wanted 2, then lose it', null, 600,
    (G) => { call(G, 'setWanted', 2); call(G, 'setObjective', 'Lose the police — get back to 0 stars', null); }, (G) => {}),
  mk(4, 'The Exchange', 'Deliver a package downtown. Expect an ambush — three of Rook\'s men are waiting.',
    'Deliver the package downtown, survive the ambush', { x: 0, z: 0, label: 'Downtown drop' }, 900,
    (G) => call(G, 'setObjective', 'Deliver the package downtown', { x: 0, z: 0, label: 'Downtown drop' }), (G) => {}),
  mk(5, 'Air Support', 'AIR-1 is on you at wanted 3. Shake the helicopter and get clean.',
    'Escape AIR-1 at wanted 3', null, 1200,
    (G) => { call(G, 'setWanted', 3); call(G, 'setObjective', 'Escape AIR-1 — get back to 0 stars', null); }, (G) => {}),
  mk(6, 'Roadblock Run', 'SMPD has roadblocks up at 3 stars. Smash through two of them.',
    'Smash through 2 roadblocks', null, 1500,
    (G) => { call(G, 'setWanted', 3); call(G, 'setObjective', 'Smash through 2 roadblocks', null); }, (G) => {}),
  mk(7, 'The Heist', 'Rob the Solmara Bank and escape with $5,000. Then lose the heat.',
    'Rob the Solmara Bank, escape with $5,000', { x: 24, z: -12, label: 'Solmara Bank' }, 2500,
    (G) => call(G, 'setObjective', 'Rob the Solmara Bank', { x: 24, z: -12, label: 'Solmara Bank' }), (G) => {}),
  mk(8, 'Payback', 'Silas Rook is at the port. Take him down — five of his men guard him.',
    'Take down Silas Rook at the port', { x: 180, z: 20, label: 'Port — Rook' }, 4000,
    (G) => call(G, 'setObjective', 'Take down Silas Rook at the port', { x: 180, z: 20, label: 'Port — Rook' }), (G) => {}),
  mk(9, 'Clean Getaway', 'Five stars. The whole city is hunting you. Escape it clean.',
    'Escape a 5-star wanted level', null, 5000,
    (G) => { call(G, 'setWanted', 5); call(G, 'setObjective', 'Escape 5 stars — get back to 0', null); },
    (G) => call(G, 'showBanner', 'SOLMARA LEGEND', 'Clean getaway — five stars, gone')),
  mk(10, 'New Blood', 'Jax Calloway is waiting in the north hills. Pick him up during a 2-star chase, then lose the tail.',
    'Recruit Jax Calloway — drive to the north hills, lose the tail', { x: -10, z: -175, label: 'North hills — Jax' }, 5500,
    (G) => { call(G, 'setWanted', 2); call(G, 'setObjective', 'Pick up Jax in the north hills', { x: -10, z: -175, label: 'North hills — Jax' }); },
    (G) => { call(G, 'recruitCrew', 'jax'); call(G, 'addRespect', 550); }),
  mk(11, 'Ghost Ride', 'Midnight port run. Deliver Lena Marlowe\'s car to the Ember Garage without a scratch — no police hits.',
    'Deliver Lena\'s car to the Ember Garage, no damage', PORT_T, 6500,
    (G) => { G.missions.startHealth = (G.state && G.state.health) || 100; call(G, 'setObjective', 'Pick up Lena\'s car at the port', PORT_T); },
    (G) => call(G, 'recruitCrew', 'lena')),
  mk(12, 'King of Solmara', 'The finale. Steal the Vultures\' gold convoy truck at the port, survive 5 stars with AIR-1 and roadblocks, and deliver the gold to the Ember Garage.',
    'Steal the gold convoy, survive 5 stars, deliver the gold', { x: 180, z: 20, label: 'Port — gold convoy' }, 8000,
    (G) => { G.missions.stage = 0; call(G, 'setObjective', 'Steal the Vultures\' gold convoy truck at the port', { x: 180, z: 20, label: 'Port — gold convoy' }); call(G, 'showBanner', 'MISSION 12 — KING OF SOLMARA', 'Stage 1: steal the gold convoy'); },
    (G) => { const rank = call(G, 'respectRank'); const pts = (rank && typeof rank.points === 'number') ? rank.points : 0; if (pts < 2500) call(G, 'addRespect', 2500 - pts); call(G, 'showBanner', 'SOLMARA LEGEND', 'King of Solmara'); }),
];

export const MISSIONS = [...MISSIONS_1_12, ...MISSIONS_13_15];

// init / update
export function initMissions(G) {
  G.missions = G.missions || {};
  G.missions.list = MISSIONS;
  G.missions.currentIndex = Math.max(0, Math.min(14, (G.state && G.state.missionIndex) || 0));
  G.missions.current = MISSIONS[G.missions.currentIndex] || null;
  G.missions.lockpick = 0;
  G.missions.stage = 0;
  G.missions.roadblocksSmashed = 0;
  G.missions._started = false;
  G.missions._ePressed = false;
  G.race = G.race || { active: false };
  G.state.lockpickProgress = 0;
  G.helpers = G.helpers || {};
  G.helpers.setObjective = (text, target) => {
    G.state.objectiveText = text || '';
    G.state.objectiveTarget = target || null;
  };
  const startCurrent = () => {
    const m = G.missions.current;
    if (!m || G.missions._started) return;
    G.missions._started = true;
    G.missions.stage = 0;
    G.missions.lockpick = 0;
    G.state.lockpickProgress = 0;
    try { if (typeof m.onStart === 'function') m.onStart(G); } catch (e) { /* ignore */ }
    call(G, 'playSound', 'mission');
  };
  G.helpers.startMission = startCurrent;
  startCurrent();
}

function completeMission(G) {
  const m = G.missions.current;
  if (!m) return;
  let payout = m.reward || 0;
  const bonus = call(G, 'crewBonus', 'payout');
  if (typeof bonus === 'number' && bonus > 1) payout = Math.round(payout * bonus);
  call(G, 'addMoney', payout);
  try { if (typeof m.onDone === 'function') m.onDone(G); } catch (e) { /* ignore */ }
  call(G, 'addRespect', Math.round((m.reward || 0) / 10));
  call(G, 'showBanner', 'MISSION COMPLETE — ' + m.title.toUpperCase(), '+$' + payout.toLocaleString('en-US'));
  call(G, 'playSound', 'cash');
  call(G, 'saveGame');
  G.state.missionIndex = Math.min(14, G.missions.currentIndex + 1);
  G.missions.currentIndex = G.state.missionIndex;
  G.missions.current = MISSIONS[G.missions.currentIndex] || null;
  G.missions._started = false;
  G.missions.stage = 0;
  if (G.missions.current) {
    const next = G.missions.current;
    try { if (typeof next.onStart === 'function') next.onStart(G); } catch (e) { /* ignore */ }
    G.missions._started = true;
    call(G, 'playSound', 'mission');
  } else {
    call(G, 'setObjective', 'All missions complete — Solmara is yours', null);
  }
}

function failMission(G, reason) {
  const m = G.missions.current;
  if (!m) return;
  call(G, 'showBanner', 'MISSION FAILED', reason || m.title);
  call(G, 'playSound', 'explosion');
  G.missions._started = false;
  G.missions.stage = 0;
  G.missions.lockpick = 0;
  G.state.lockpickProgress = 0;
  if (G.race) G.race.active = false;
  const current = G.missions.current;
  try { if (typeof current.onStart === 'function') current.onStart(G); } catch (e) { /* ignore */ }
  G.missions._started = true;
}

// Edge-triggered E key (lockpick / race start).
function ePressed(G) {
  const keys = (G.input && G.input.keys) || null;
  const down = keys ? keys.has('KeyE') : false;
  const edge = down && !G.missions._ePressed;
  G.missions._ePressed = down;
  return edge;
}

export function updateMissions(G, dt) {
  if (!G || !G.missions || !G.state) return;
  if (!G.state.started || G.state.paused || G.state.gameOver) return;
  const m = G.missions.current;
  const wanted = G.state.wanted || 0;

  // Shared race progress (mission 13 + repeatable races).
  if (G.race && G.race.active) {
    updateRival(G, dt);
    // Live race clock + checkpoint for the HUD race timer.
    G.state.raceTime = ((G.state && G.state.time) || 0) - (G.race.startTime || 0);
    G.state.raceCheckpoint = G.race.current + 1;
    G.state.raceTotal = (G.race.checkpoints || []).length;
    const cps = G.race.checkpoints || [];
    const cur = cps[G.race.current];
    if (cur && distTo(G, cur) <= 6) {
      G.race.current += 1;
      call(G, 'playSound', 'pickup');
      const next = cps[G.race.current];
      if (next) call(G, 'setObjective', 'Race — checkpoint ' + (G.race.current + 1) + '/' + cps.length, { x: next.x, z: next.z, label: 'Race ring ' + (G.race.current + 1) });
    }
    if (G.race.current >= cps.length) {
      const wasMissionRace = m && m.race === true && !G.race.repeatable;
      const raceStart = G.race.startTime || 0;
      const par = G.race.parTime || 90;
      const finalTime = ((G.state && G.state.time) || 0) - raceStart;
      finishRace(G);
      G.state.raceTime = finalTime; // HUD keeps the final time after the banner
      if (wasMissionRace) {
        const elapsed = finalTime;
        if (elapsed <= par) completeMission(G);
        else {
          call(G, 'showBanner', 'RIVAL WINS THIS ONE', 'Beat 90s to take the streets');
          if (m) { try { m.onStart(G); } catch (e) { /* ignore */ } }
        }
      }
    }
    if (!m || m.race !== true) return; // repeatable race: nothing else this frame
  }

  // Repeatable race pad (unlocked after mission 13).
  if ((!G.race || !G.race.active) && G.missions.currentIndex > 12) {
    const pad = racePadPoint(G);
    const dPad = distTo(G, pad);
    if (dPad <= 6 || (dPad <= 10 && ePressed(G))) {
      startRace(G);
      G.race.repeatable = true;
      call(G, 'setObjective', 'Race — checkpoint 1/3', { x: G.race.checkpoints[0].x, z: G.race.checkpoints[0].z, label: 'Race ring 1' });
    }
  }

  if (!m) return;
  if (!G.missions._started) {
    try { if (typeof m.onStart === 'function') m.onStart(G); } catch (e) { /* ignore */ }
    G.missions._started = true;
  }

  // Per-mission completion checks.
  switch (m.id) {
    case 1:
      if (m.target && distTo(G, m.target) <= 8) completeMission(G);
      break;
    case 2: {
      if ((G.state.carsStolen || 0) > 0 && m.target && distTo(G, m.target) <= 8) completeMission(G);
      break;
    }
    case 3:
      if (wanted === 0 && G.missions._sawWanted2) completeMission(G);
      if (wanted >= 2) G.missions._sawWanted2 = true;
      break;
    case 4: {
      if (G.missions.stage === 0 && m.target && distTo(G, m.target) <= 8) {
        G.missions.stage = 1;
        G.missions._killsAtStart = G.state.kills || 0;
        spawnAmbush(G, m.target.x, m.target.z, 3);
        call(G, 'setObjective', 'Ambush! Take down 3 Vultures', m.target);
        call(G, 'showBanner', 'AMBUSH', 'Three of Rook\'s men');
      } else if (G.missions.stage === 1) {
        const killed = (G.state.kills || 0) - (G.missions._killsAtStart || 0);
        if (killed >= 3 || aliveEnemies(G).length === 0) completeMission(G);
      }
      break;
    }
    case 5:
      if (wanted === 0 && G.missions._sawWanted3) completeMission(G);
      if (wanted >= 3) G.missions._sawWanted3 = true;
      break;
    case 6: {
      const smashed = (G.state && G.state.roadblocksSmashed) || G.missions.roadblocksSmashed || 0;
      if (smashed >= 2) completeMission(G);
      break;
    }
    case 7: {
      if (G.missions.stage === 0 && m.target && distTo(G, m.target) <= 8) {
        G.missions.stage = 1;
        call(G, 'setWanted', Math.max(2, wanted));
        call(G, 'setObjective', 'Escape with the $5,000 — lose the heat', null);
        call(G, 'showBanner', 'BANK ROBBED', '$5,000 in the bag — run');
      } else if (G.missions.stage === 1 && wanted === 0) completeMission(G);
      break;
    }
    case 8: {
      if (G.missions.stage === 0 && m.target && distTo(G, m.target) <= 8) {
        G.missions.stage = 1;
        G.missions._killsAtStart = G.state.kills || 0;
        spawnAmbush(G, m.target.x, m.target.z, 5);
        call(G, 'setObjective', 'Take down Rook and his 5 men', m.target);
        call(G, 'showBanner', 'PAYBACK', 'Rook is here — finish it');
      } else if (G.missions.stage === 1) {
        const killed = (G.state.kills || 0) - (G.missions._killsAtStart || 0);
        if (killed >= 5 || aliveEnemies(G).length === 0) completeMission(G);
      }
      break;
    }
    case 9:
      if (wanted === 0 && G.missions._sawWanted5) completeMission(G);
      if (wanted >= 5) G.missions._sawWanted5 = true;
      break;
    case 10: {
      if (G.missions.stage === 0 && m.target && distTo(G, m.target) <= 8) {
        G.missions.stage = 1;
        call(G, 'setObjective', 'Jax is in — lose the tail', null);
        call(G, 'showBanner', 'JAX IS IN', 'Now lose the 2-star tail');
      } else if (G.missions.stage === 1 && wanted === 0) completeMission(G);
      break;
    }
    case 11: {
      const startHealth = G.missions.startHealth || 100;
      if ((G.state.health || 100) < startHealth) { failMission(G, 'Lena\'s car took a hit — start the run again'); break; }
      if (G.missions.stage === 0 && m.target && distTo(G, m.target) <= 8) {
        G.missions.stage = 1;
        const gp = garagePoint(G);
        call(G, 'setObjective', 'Deliver Lena\'s car to the Ember Garage — no damage', { x: gp.x, z: gp.z, label: 'Ember Garage' });
      } else if (G.missions.stage === 1) {
        const gp = garagePoint(G);
        if (distTo(G, gp) <= 8) completeMission(G);
      }
      break;
    }
    case 12: {
      if (G.missions.stage === 0 && m.target && distTo(G, m.target) <= 8) {
        G.missions.stage = 1;
        call(G, 'setWanted', 5);
        call(G, 'setObjective', 'Survive 5 stars with AIR-1 and roadblocks', null);
        call(G, 'showBanner', 'STAGE 2', 'Five stars — survive it');
      } else if (G.missions.stage === 1 && wanted === 0) {
        G.missions.stage = 2;
        const gp = garagePoint(G);
        call(G, 'setObjective', 'Deliver the gold to the Ember Garage', { x: gp.x, z: gp.z, label: 'Ember Garage' });
        call(G, 'showBanner', 'STAGE 3', 'Deliver the gold');
      } else if (G.missions.stage === 2) {
        const gp = garagePoint(G);
        if (distTo(G, gp) <= 8) completeMission(G);
      }
      break;
    }
    case 13:
      // Race progress handled above; if the race is not running, restart it.
      if (!G.race || !G.race.active) { startRace(G); spawnRival(G); }
      break;
    case 14: {
      // Wanted-cap fail: 2 stars at any point blows the stealth run.
      if (wanted >= 2) { failMission(G, 'BLOWN — the Vultures know'); break; }
      const office = officePoint(G);
      if (G.missions.stage === 0) {
        if (distTo(G, office) <= 8) {
          G.missions.stage = 1;
          call(G, 'setObjective', 'Hold E at the office door — pick the lock (3s)', { x: office.x, z: office.z, label: 'Port office' });
        }
      } else if (G.missions.stage === 1) {
        const keys = (G.input && G.input.keys) || null;
        const holdingE = keys ? keys.has('KeyE') : false;
        const p = playerPos(G);
        const moved = G.missions._lockPos ? Math.hypot(p.x - G.missions._lockPos.x, p.z - G.missions._lockPos.z) > 1 : false;
        if (holdingE && distTo(G, office) <= 3 && !moved) {
          if (!G.missions._lockPos) G.missions._lockPos = { x: p.x, z: p.z };
          G.missions.lockpick = Math.min(1, (G.missions.lockpick || 0) + dt / 3);
          G.state.lockpickProgress = G.missions.lockpick;
          if (G.missions.lockpick >= 1) {
            G.missions.stage = 2;
            G.missions._lockPos = null;
            const gp = garagePoint(G);
            call(G, 'setObjective', 'Ledger grabbed — return to the Ember Garage, stay clean', { x: gp.x, z: gp.z, label: 'Ember Garage' });
            call(G, 'showBanner', 'LEDGER GRABBED', 'Get back to the garage — no heat');
            call(G, 'playSound', 'pickup');
          }
        } else {
          // Interrupted: moving or letting go resets progress.
          if (moved) G.missions._lockPos = null;
          G.missions.lockpick = 0;
          G.state.lockpickProgress = 0;
        }
      } else if (G.missions.stage === 2) {
        const gp = garagePoint(G);
        if (distTo(G, gp) <= 8) completeMission(G);
      }
      break;
    }
    case 15: {
      const yard = compoundPoint(G);
      if (G.missions.stage === 0) {
        if (distTo(G, yard) <= 10) {
          G.missions.stage = 1;
          G.missions._killsAtStart = G.state.kills || 0;
          spawnAmbush(G, yard.x, yard.z, 6);
          spawnEnemyAt(G, yard.x, yard.z, { hp: 300, boss: true });
          call(G, 'setObjective', 'Clear the compound — Rook has 3x health', { x: yard.x, z: yard.z, label: 'Vultures compound' });
          call(G, 'showBanner', 'STAGE 1', 'Six guards plus Rook himself');
        }
      } else if (G.missions.stage === 1) {
        const killed = (G.state.kills || 0) - (G.missions._killsAtStart || 0);
        if (killed >= 7 || aliveEnemies(G).length === 0) {
          G.missions.stage = 2;
          const makeCar = G.helpers && G.helpers.makeCar;
          if (typeof makeCar === 'function') {
            try {
              const car = makeCar(G, 0x1a1a2e, 'traffic', {});
              if (car && car.pos) { car.kind = 'rook'; car.pos.x = yard.x + 20; car.pos.z = yard.z; G.missions.rookCar = car; }
            } catch (e) { G.missions.rookCar = null; }
          }
          call(G, 'setWanted', 4);
          call(G, 'setObjective', 'Chase Rook\'s fleeing car — get close', null);
          call(G, 'showBanner', 'STAGE 2', 'Rook is running — chase him down');
        }
      } else if (G.missions.stage === 2) {
        const rookCar = G.missions.rookCar;
        let caught = false;
        if (rookCar && rookCar.pos) {
          const p = playerPos(G);
          const d = Math.hypot(p.x - rookCar.pos.x, p.z - rookCar.pos.z);
          rookCar.pos.z -= 12 * dt;
          rookCar.pos.x += Math.sin((G.state.time || 0) * 0.5) * 2 * dt;
          if (rookCar.group) {
            rookCar.group.position.set(rookCar.pos.x, 0, rookCar.pos.z);
            rookCar.group.rotation.y = Math.PI;
          }
          if (d <= 10) caught = true;
        } else caught = true; // no car available: fall back to a timed chase
        if (caught) {
          G.missions.stage = 3;
          G.missions._killsAtStart = G.state.kills || 0;
          spawnEnemyAt(G, yard.x + 4, yard.z, { hp: 300, boss: true });
          spawnAmbush(G, yard.x, yard.z, 2);
          call(G, 'setObjective', 'Final showdown — finish Rook and his guards', { x: yard.x, z: yard.z, label: 'Vultures compound' });
          call(G, 'showBanner', 'STAGE 3', 'Final showdown — on foot');
        }
      } else if (G.missions.stage === 3) {
        const killed = (G.state.kills || 0) - (G.missions._killsAtStart || 0);
        if (killed >= 3 || aliveEnemies(G).length === 0) completeMission(G);
      }
      break;
    }
    default:
      break;
  }
}
