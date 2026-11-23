// combat.js — shooting, enemies and the 3-weapon system for SOLMARA (round 5).
// Hitscan fire from the camera (mouse click or hold F), infinite ammo.
// Three weapons: PISTOL (default), SMG and SHOTGUN (glowing pickup crates at
// the port warehouse and the beach hut). Enemies have health and shoot back;
// Rook-class enemies are spawned with opts {hp: 300}. Every cross-module
// helper is read defensively — this module never crashes when one is absent.

import { isDown, wasPressed } from './input.js';

export const WEAPONS = {
  pistol: { dmg: 34, rate: 0.35, name: 'PISTOL' },
  smg: { dmg: 16, rate: 0.09, name: 'SMG' },
  shotgun: { dmg: 90, rate: 0.9, name: 'SHOTGUN' },
};

const WEAPON_ORDER = ['pistol', 'smg', 'shotgun'];
const WEAPON_KEYS = ['Digit1', 'Digit2', 'Digit3'];
const CRATE_SPOTS_FALLBACK = {
  smg: { x: 170, z: 20 }, // port warehouse (east)
  shotgun: { x: -40, z: 185 }, // beach lifeguard hut (south)
};
const SHOOT_RANGE = 70;
const HIT_ANGLE = 0.055;

let _G = null;

function helper(G, name) {
  return G.helpers && typeof G.helpers[name] === 'function' ? G.helpers[name] : null;
}
function sfx(G, name) {
  const f = helper(G, 'playSound');
  if (f) { try { f(name); } catch (e) { /* audio missing: stay silent */ } }
}
function banner(G, title, sub) {
  const f = helper(G, 'showBanner');
  if (f) { try { f(title, sub); } catch (e) { /* menus missing: skip */ } }
}
function addRespect(G, n) {
  const f = helper(G, 'addRespect');
  if (f) { try { f(n); } catch (e) { /* respect missing: skip */ } }
}
function playerPos(G) {
  if (G.player && G.player.group) return G.player.group.position;
  if (G.player && G.player.pos) return G.player.pos;
  return { x: 0, y: 0, z: 0 };
}

// ---- enemies ----

export function spawnEnemy(G, x, z, opts) {
  const o = opts || {};
  const hp = o.hp || 100;
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a1f1f, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.4), bodyMat);
  body.position.y = 0.9;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xc89878, roughness: 0.7 })
  );
  head.position.y = 1.7;
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 })
  );
  gun.position.set(0.3, 1.1, 0.3);
  group.add(body, head, gun);
  group.position.set(x, 0, z);
  group.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  G.scene.add(group);
  const enemy = {
    group,
    pos: group.position,
    hp,
    maxHp: hp,
    speed: 3.4,
    shootT: 1 + Math.random() * 1.5,
    alive: true,
    bodyMat,
    hitT: 0,
  };
  if (!G.enemies) G.enemies = [];
  G.enemies.push(enemy);
  return enemy;
}

function damageEnemy(G, e, dmg, dir) {
  e.hp -= dmg;
  // Hit flash + knockback: the shot shoves the enemy back along the ray.
  if (dir) {
    e.pos.x += dir.x * 0.5;
    e.pos.z += dir.z * 0.5;
  }
  if (e.bodyMat) e.bodyMat.emissive.setHex(0x881111);
  e.hitT = 0.08;
  if (e.hp <= 0 && e.alive) {
    e.alive = false;
    G.scene.remove(e.group);
    const i = G.enemies.indexOf(e);
    if (i >= 0) G.enemies.splice(i, 1);
    G.state.kills = (G.state.kills || 0) + 1;
    addRespect(G, 5);
    const boom = helper(G, 'spawnExplosion');
    if (boom) { try { boom(e.pos, false); } catch (err) { /* effects missing */ } }
    sfx(G, 'explosion');
  }
}

// damagePlayer supports both signatures: damagePlayer(G, n) and the
// helper-bound damagePlayer(n) (G captured at initCombat).
export function damagePlayer(a, b) {
  const G = b === undefined ? _G : a;
  const n = b === undefined ? a : b;
  if (!G || !G.state || typeof n !== 'number') return;
  if (G.state.gameOver) return;
  G.state.health = Math.max(0, (G.state.health || 0) - n);
  G.state.lastDamageAt = G.state.time || 0;
  if (G.state.health <= 0) {
    G.state.gameOver = true;
    banner(G, 'WASTED', 'Dante went down in Solmara');
    sfx(G, 'explosion');
  }
}

// ---- shooting ----

function hitScan(G, dir, dmg) {
  if (!G.camera) return;
  const origin = G.camera.position;
  let best = null;
  let bestD = SHOOT_RANGE;
  for (const e of G.enemies) {
    if (!e.alive) continue;
    const to = new THREE.Vector3(e.pos.x - origin.x, (e.pos.y + 1) - origin.y, e.pos.z - origin.z);
    const dist = to.length();
    if (dist > SHOOT_RANGE) continue;
    to.normalize();
    const ang = Math.acos(Math.max(-1, Math.min(1, to.dot(dir))));
    if (ang < HIT_ANGLE && dist < bestD) {
      best = e;
      bestD = dist;
    }
  }
  if (best) damageEnemy(G, best, dmg, dir);
}

function fire(G) {
  const id = (G.weapons && G.weapons.current) || 'pistol';
  const w = WEAPONS[id] || WEAPONS.pistol;
  G.combat.cooldown = w.rate;
  sfx(G, 'shot');
  const cam = G.camera;
  if (!cam) return;
  const dir = new THREE.Vector3();
  cam.getWorldDirection(dir);
  // Muzzle flash: a bright quad at the camera, gone in one frame burst.
  const flash = G.combat.flash;
  if (flash) {
    const right = new THREE.Vector3().crossVectors(dir, cam.up).normalize();
    flash.position.copy(cam.position).addScaledVector(dir, 1.4).addScaledVector(right, 0.35);
    flash.position.y -= 0.2;
    flash.lookAt(cam.position);
    flash.visible = true;
    G.combat.flashT = 0.06;
  }
  const pellets = id === 'shotgun' ? 5 : 1;
  const perPellet = id === 'shotgun' ? w.dmg / 5 : w.dmg;
  for (let i = 0; i < pellets; i++) {
    const d = dir.clone();
    if (pellets > 1) {
      // Spread: random small offsets perpendicular to the shot direction.
      const right = new THREE.Vector3().crossVectors(d, cam.up).normalize();
      const up = new THREE.Vector3().crossVectors(right, d).normalize();
      d.addScaledVector(right, (Math.random() - 0.5) * 0.12)
        .addScaledVector(up, (Math.random() - 0.5) * 0.12)
        .normalize();
    }
    hitScan(G, d, perPellet);
  }
}

// ---- weapon pickup crates ----

function buildCrates(G) {
  const spots = (G.config && G.config.weapons && G.config.weapons.spots) || {};
  const defs = [
    { id: 'smg', key: '2', spot: spots.smg || CRATE_SPOTS_FALLBACK.smg, color: 0x37e08a },
    { id: 'shotgun', key: '3', spot: spots.shotgun || CRATE_SPOTS_FALLBACK.shotgun, color: 0xffb347 },
  ];
  for (const d of defs) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: d.color, emissive: d.color, emissiveIntensity: 0.9, roughness: 0.4,
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    box.position.y = 0.6;
    const lid = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.15, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 })
    );
    lid.position.y = 1.15;
    group.add(box, lid);
    group.position.set(d.spot.x, 0, d.spot.z);
    G.scene.add(group);
    G.combat.crates.push({
      id: d.id, key: d.key, group, x: d.spot.x, z: d.spot.z, collected: false,
    });
  }
}

// ---- public contract ----

export function initCombat(G) {
  _G = G;
  G.weapons = { owned: ['pistol'], current: 'pistol' };
  G.enemies = [];
  G.combat = { cooldown: 0, crates: [], flash: null, flashT: 0, trigger: false };
  G.helpers = G.helpers || {};
  G.helpers.damagePlayer = (n) => damagePlayer(G, n);
  G.helpers.spawnEnemy = (x, z, opts) => spawnEnemy(G, x, z, opts);
  // Mouse click = shoot (edge: consumed by updateCombat each frame).
  // Guarded to the running game so clicks on the start button do not queue a shot.
  window.addEventListener('mousedown', (e) => {
    if (e.button === 0 && G.combat && G.state && G.state.started && !G.state.paused) {
      G.combat.trigger = true;
    }
  });
  buildCrates(G);
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.5),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95, depthWrite: false })
  );
  flash.visible = false;
  G.scene.add(flash);
  G.combat.flash = flash;
}

export function updateCombat(G, dt) {
  if (!G.combat || !G.state) return;
  if (!G.state.started || G.state.paused || G.state.gameOver) return;

  G.combat.cooldown = Math.max(0, G.combat.cooldown - dt);
  if (G.combat.flashT > 0) {
    G.combat.flashT -= dt;
    if (G.combat.flashT <= 0 && G.combat.flash) G.combat.flash.visible = false;
  }

  // --- weapon switch (1/2/3, owned only, edge-triggered) ---
  for (let i = 0; i < WEAPON_ORDER.length; i++) {
    if (wasPressed(G, WEAPON_KEYS[i])) {
      const id = WEAPON_ORDER[i];
      if (G.weapons.owned.includes(id) && G.weapons.current !== id) {
        G.weapons.current = id;
        sfx(G, 'weapon');
      }
      break;
    }
  }

  // --- shooting: mouse click (edge) or hold F ---
  const wantShoot = G.combat.trigger || isDown(G, 'KeyF');
  G.combat.trigger = false;
  if (wantShoot && G.combat.cooldown <= 0) fire(G);

  // --- enemies: advance, shoot back, clear hit flash ---
  const p = playerPos(G);
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    if (!e.alive) continue;
    if (e.hitT > 0) {
      e.hitT -= dt;
      if (e.hitT <= 0 && e.bodyMat) e.bodyMat.emissive.setHex(0x000000);
    }
    const dx = p.x - e.pos.x;
    const dz = p.z - e.pos.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > 6) {
      e.pos.x += (dx / d) * e.speed * dt;
      e.pos.z += (dz / d) * e.speed * dt;
    }
    e.group.rotation.y = Math.atan2(dx, dz);
    e.shootT -= dt;
    if (d < 28 && e.shootT <= 0) {
      e.shootT = 1.6 + Math.random() * 0.8;
      damagePlayer(G, 6 + Math.random() * 4);
      sfx(G, 'shot');
    }
  }

  // --- weapon pickup crates: walk within 3 units to collect ---
  for (const c of G.combat.crates) {
    if (c.collected) continue;
    c.group.rotation.y += dt * 0.8; // slow spin so crates read as pickups
    const d = Math.hypot(p.x - c.x, p.z - c.z);
    if (d < 3) {
      c.collected = true;
      c.group.visible = false;
      if (!G.weapons.owned.includes(c.id)) G.weapons.owned.push(c.id);
      G.weapons.current = c.id;
      sfx(G, 'pickup');
      banner(G, `${WEAPONS[c.id].name} ACQUIRED`, `Press ${c.key} to switch weapons`);
    }
  }
}
