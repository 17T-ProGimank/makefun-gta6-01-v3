// collectibles.js — SOLMARA round 5: the 12 Golden Seagulls.
// Small gold bird statues on plinths at fixed spots across the city (spots
// come from G.city.seagullSpots(), read defensively). Walk or drive within
// 3 units to collect one: +$250, +10 respect, a chime. All 12 → $2,000 bonus
// and the GOLDEN GULL banner. Found state persists through save.js.

import { CONFIG } from './config.js';

const TOTAL = 12;

function call(G, name, ...args) {
  const fn = G && G.helpers && G.helpers[name];
  if (typeof fn === 'function') {
    try { return fn(...args); } catch (e) { /* helper failed: ignore */ }
  }
  return undefined;
}

function spots(G) {
  // Prefer the city's own list (built from CONFIG.collectibles.spots);
  // fall back to the config directly, then to an empty list.
  if (G.city && typeof G.city.seagullSpots === 'function') {
    try {
      const list = G.city.seagullSpots(G);
      if (Array.isArray(list) && list.length) return list;
    } catch (e) { /* ignore */ }
  }
  if (CONFIG && CONFIG.collectibles && Array.isArray(CONFIG.collectibles.spots)) {
    return CONFIG.collectibles.spots;
  }
  return [];
}

function reward() {
  return (CONFIG && CONFIG.collectibles && CONFIG.collectibles.reward) || 250;
}

function respectPer() {
  return (CONFIG && CONFIG.collectibles && CONFIG.collectibles.respect) || 10;
}

function allBonus() {
  return (CONFIG && CONFIG.collectibles && CONFIG.collectibles.bonus) || 2000;
}

export function initCollectibles(G) {
  G.collectibles = G.collectibles || {};
  // Loaded from save if present (save.js restores G.saveData.seagulls first,
  // or G.collectibles.found directly); otherwise start empty.
  let found = null;
  if (Array.isArray(G.collectibles.found) && G.collectibles.found.length === TOTAL) {
    found = G.collectibles.found;
  } else if (G.saveData && Array.isArray(G.saveData.seagulls) && G.saveData.seagulls.length === TOTAL) {
    found = G.saveData.seagulls.slice();
  }
  G.collectibles.found = found || new Array(TOTAL).fill(false);
  G.collectibles._meshes = G.collectibles._meshes || [];
  // If city.js exposed the statue meshes, cache them and hide any statue
  // that was already collected in a previous session.
  if (G.city && Array.isArray(G.city.seagullMeshes)) {
    G.collectibles._meshes = G.city.seagullMeshes;
    for (let i = 0; i < Math.min(TOTAL, G.collectibles._meshes.length); i++) {
      if (G.collectibles.found[i]) {
        const mesh = G.collectibles._meshes[i];
        if (mesh && mesh.scale && typeof mesh.scale.setScalar === 'function') {
          try { mesh.scale.setScalar(0); } catch (e) { /* ignore */ }
        } else if (mesh && mesh.visible !== undefined) {
          mesh.visible = false;
        }
      }
    }
  }
  G.helpers = G.helpers || {};

  // collectSeagull(i): mark statue i found, pay out, chime, bonus on 12th.
  G.helpers.collectSeagull = (i) => {
    if (typeof i !== 'number' || i < 0 || i >= TOTAL) return false;
    if (G.collectibles.found[i]) return false;
    G.collectibles.found[i] = true;
    call(G, 'addMoney', reward());
    call(G, 'addRespect', respectPer());
    call(G, 'playSound', 'gull');
    const burst = G.helpers && G.helpers.spawnGoldBurst;
    if (typeof burst === 'function') {
      try {
        const list = spots(G);
        const spot = list[i];
        if (spot) burst({ x: spot.x, y: 1.5, z: spot.z });
      } catch (e) { /* ignore */ }
    }
    const count = G.collectibles.found.filter(Boolean).length;
    if (count >= TOTAL) {
      call(G, 'addMoney', allBonus());
      call(G, 'showBanner', 'GOLDEN GULL', 'All 12 seagulls found — +$' + allBonus().toLocaleString('en-US') + ' bonus');
      call(G, 'playSound', 'cash');
    } else {
      call(G, 'showBanner', 'GOLDEN SEAGULL ' + count + '/' + TOTAL, '+$' + reward().toLocaleString('en-US') + ' · +' + respectPer() + ' respect');
    }
    call(G, 'saveGame');
    return true;
  };

  // seagullCount(): {found, total} for the HUD and pause screen.
  G.helpers.seagullCount = () => {
    const foundCount = (G.collectibles.found || []).filter(Boolean).length;
    return { found: foundCount, total: TOTAL };
  };
}

export function updateCollectibles(G, dt) {
  if (!G || !G.collectibles || !G.state) return;
  if (!G.state.started || G.state.paused || G.state.gameOver) return;
  const list = spots(G);
  if (!list.length) return;
  const p = (G.player && G.player.pos) || { x: 0, z: 0 };
  for (let i = 0; i < Math.min(list.length, TOTAL); i++) {
    if (G.collectibles.found[i]) continue;
    const spot = list[i];
    if (!spot) continue;
    const dx = p.x - spot.x, dz = p.z - spot.z;
    if (Math.sqrt(dx * dx + dz * dz) <= 3) {
      call(G, 'collectSeagull', i);
      // Hide the statue mesh (scale 0) so it reads as collected.
      const mesh = (G.collectibles._meshes && G.collectibles._meshes[i]) || null;
      if (mesh && mesh.scale && typeof mesh.scale.setScalar === 'function') {
        try { mesh.scale.setScalar(0); } catch (e) { /* ignore */ }
      } else if (mesh && mesh.visible !== undefined) {
        mesh.visible = false;
      }
    }
  }
}
