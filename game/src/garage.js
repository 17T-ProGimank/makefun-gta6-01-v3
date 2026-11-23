// garage.js — SOLMARA round 4: the Ember Garage management system.
// Stores up to 4 owned cars, repairs, repaints and upgrades them. The garage
// menu itself lives in menus.js (openGarageMenu); this module owns the data,
// the near-garage detection and the G-key shortcut. All helper calls are
// defensive: a missing helper is skipped, never a crash.

export const GARAGE = {
  maxCars: 4,
  repairCost: 150,
  paintCost: 200,
  paints: ['Ember Orange', 'Midnight', 'Seafoam', 'Bone White', 'Crimson', 'Lime'],
  upgrades: [
    { level: 1, cost: 800, top: 6, grip: 0.2 },
    { level: 2, cost: 1800, top: 12, grip: 0.4 },
    { level: 3, cost: 3500, top: 20, grip: 0.6 },
  ],
};

const PAINT_COLORS = {
  'Ember Orange': 0xff7a1a,
  'Midnight': 0x1a2233,
  'Seafoam': 0x7fd4b5,
  'Bone White': 0xf2ead8,
  'Crimson': 0xc81e3a,
  'Lime': 0xa8d81e,
};

const CAR_NAMES = ['Ember GT', 'Bay Runner', 'Port Hauler', 'Sunset Coupe'];

function call(G, name, ...args) {
  const fn = G && G.helpers && G.helpers[name];
  if (typeof fn === 'function') {
    try { return fn(...args); } catch (e) { /* helper failed: ignore */ }
  }
  return undefined;
}

function money(G) { return (G.state && G.state.money) || 0; }

function charge(G, amount) {
  if (money(G) < amount) {
    call(G, 'showBanner', 'NOT ENOUGH CASH', 'You need $' + amount.toLocaleString('en-US'));
    return false;
  }
  call(G, 'addMoney', -amount);
  return true;
}

function nameForColor(color) {
  const idx = Math.abs(Math.floor((color || 0) / 7919)) % CAR_NAMES.length;
  return CAR_NAMES[idx];
}

function garagePoint(G) {
  if (G.city && G.city.spawnPoints && G.city.spawnPoints.garage) {
    return G.city.spawnPoints.garage;
  }
  return { x: -27, z: 66 };
}

function activeCar(G) {
  const owned = (G.garage && G.garage.owned) || [];
  const idx = Math.max(0, Math.min(owned.length - 1, (G.garage && G.garage.active) || 0));
  return owned[idx] || null;
}

export function initGarage(G) {
  G.garage = G.garage || {};
  if (!Array.isArray(G.garage.owned)) G.garage.owned = [];
  if (typeof G.garage.active !== 'number') G.garage.active = 0;
  G.garage._gPressed = false;
  G.helpers = G.helpers || {};

  // Store the car the player is currently driving (or a given car object).
  G.helpers.storeCar = (car) => {
    const owned = G.garage.owned;
    if (owned.length >= GARAGE.maxCars) {
      call(G, 'showBanner', 'GARAGE FULL', 'The Ember Garage holds ' + GARAGE.maxCars + ' cars');
      return false;
    }
    const src = car || (G.state && G.state.inVehicle) || null;
    if (!src) {
      call(G, 'showBanner', 'NO CAR TO STORE', 'Get in a car first');
      return false;
    }
    const paint = src.paint || 'Ember Orange';
    const entry = {
      color: typeof src.color === 'number' ? src.color : (PAINT_COLORS[paint] || 0xff7a1a),
      paint,
      upgrade: Math.max(0, Math.min(3, src.upgrade || 0)),
      name: src.name || nameForColor(src.color),
    };
    owned.push(entry);
    G.garage.active = owned.length - 1;
    call(G, 'showBanner', 'STORED IN GARAGE', entry.name + ' — ' + entry.paint);
    call(G, 'playSound', 'cash');
    call(G, 'saveGame');
    return true;
  };

  // storePresetCar(name, color, upgrade): add a preset owned-car entry
  // directly (used by mission 15 to award Rook's "Vulture GT" with its
  // level-3 upgrade pre-applied). No live car object is needed.
  G.helpers.storePresetCar = (name, color, upgrade) => {
    const owned = G.garage.owned;
    if (owned.length >= GARAGE.maxCars) {
      call(G, 'showBanner', 'GARAGE FULL', 'The Ember Garage holds ' + GARAGE.maxCars + ' cars');
      return false;
    }
    const entry = {
      color: typeof color === 'number' ? color : 0x1a1a2e,
      paint: 'Midnight',
      upgrade: Math.max(0, Math.min(3, upgrade || 0)),
      name: name || 'Vulture GT',
    };
    owned.push(entry);
    G.garage.active = owned.length - 1;
    call(G, 'showBanner', 'VULTURE GT ADDED TO GARAGE', entry.name + ' — level ' + entry.upgrade + ' upgrade');
    call(G, 'playSound', 'cash');
    call(G, 'saveGame');
    return true;
  };

  // Repair the active owned car (restores its health) for repairCost.
  G.helpers.repairCar = () => {
    const car = activeCar(G);
    if (!car) {
      call(G, 'showBanner', 'NO CAR IN GARAGE', 'Store a car first');
      return false;
    }
    if (!charge(G, GARAGE.repairCost)) return false;
    car.health = 100;
    const live = G.state && G.state.inVehicle;
    if (live) live.health = 100;
    call(G, 'showBanner', 'CAR REPAIRED', car.name + ' is back to full health');
    call(G, 'playSound', 'cash');
    call(G, 'saveGame');
    return true;
  };

  // Cycle the paint of owned car i (or the active car) for paintCost.
  G.helpers.paintCar = (i) => {
    const owned = G.garage.owned;
    const idx = typeof i === 'number' ? i : (G.garage.active || 0);
    const car = owned[idx];
    if (!car) {
      call(G, 'showBanner', 'NO CAR IN GARAGE', 'Store a car first');
      return false;
    }
    if (!charge(G, GARAGE.paintCost)) return false;
    const cur = GARAGE.paints.indexOf(car.paint);
    const next = GARAGE.paints[(cur + 1) % GARAGE.paints.length];
    car.paint = next;
    car.color = PAINT_COLORS[next];
    const live = G.state && G.state.inVehicle;
    if (live) {
      live.paint = next;
      live.color = PAINT_COLORS[next];
      // Recolour the live car's body mesh so the new paint shows immediately.
      if (live.group && live.group.traverse) {
        try {
          live.group.traverse((o) => {
            if (o && o.isMesh && o.material && o.material.color && o.userData && o.userData.body) {
              o.material.color.setHex(PAINT_COLORS[next]);
            }
          });
        } catch (e) { /* ignore */ }
      }
    }
    call(G, 'showBanner', 'NEW PAINT', car.name + ' — ' + next);
    call(G, 'playSound', 'cash');
    call(G, 'saveGame');
    return true;
  };

  // Buy the next upgrade level for the active car. Level 3 needs rank MADE
  // or higher (checked defensively; if the helper is absent, allow it).
  G.helpers.upgradeCar = () => {
    const car = activeCar(G);
    if (!car) {
      call(G, 'showBanner', 'NO CAR IN GARAGE', 'Store a car first');
      return false;
    }
    const nextLevel = (car.upgrade || 0) + 1;
    if (nextLevel > 3) {
      call(G, 'showBanner', 'FULLY UPGRADED', car.name + ' is already level 3');
      return false;
    }
    const up = GARAGE.upgrades[nextLevel - 1];
    if (nextLevel === 3) {
      const rank = call(G, 'respectRank');
      if (rank && typeof rank.title === 'string' && rank.title !== 'MADE'
        && rank.title !== 'SHOT CALLER' && rank.title !== 'KING OF SOLMARA') {
        call(G, 'showBanner', 'RANK TOO LOW', 'Level 3 needs rank MADE or higher');
        return false;
      }
    }
    if (!charge(G, up.cost)) return false;
    car.upgrade = nextLevel;
    const live = G.state && G.state.inVehicle;
    if (live) {
      live.upgrade = nextLevel;
      live._upgradeTop = up.top;
    }
    call(G, 'showBanner', 'UPGRADE LEVEL ' + nextLevel, car.name + ' — +' + up.top + ' top speed');
    call(G, 'playSound', 'cash');
    call(G, 'saveGame');
    return true;
  };

  // garageCars(): the owned cars array (live reference, for menus/HUD).
  G.helpers.garageCars = () => G.garage.owned;
}

export function updateGarage(G, dt) {
  if (!G || !G.garage || !G.state) return;
  if (!G.state.started || G.state.paused || G.state.gameOver) {
    G.state.nearGarage = false;
    return;
  }
  const gp = garagePoint(G);
  const p = (G.player && G.player.pos) || { x: 0, z: 0 };
  const dx = p.x - gp.x, dz = p.z - gp.z;
  const near = Math.sqrt(dx * dx + dz * dz) <= 12;
  G.state.nearGarage = near;
  if (near) {
    call(G, 'showHint', 'GARAGE — press G');
  }

  // G opens the garage menu (edge-triggered so holding G does not spam it).
  const keys = (G.input && G.input.keys) || null;
  const gDown = keys ? keys.has('KeyG') : false;
  if (gDown && !G.garage._gPressed && near) {
    call(G, 'openGarageMenu');
  }
  G.garage._gPressed = gDown;
}
