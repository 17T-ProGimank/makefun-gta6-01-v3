// effects.js — SOLMARA particle effects + camera shake (round 4).
// Particles are a single THREE.Points pool (no external textures, plain
// points with vertex colours). G.effects holds {shakeAmt, shakeT}, decayed
// each frame — main.js reads them to offset the camera.

const POOL_SIZE = 600;
const GRAVITY = -9.8;

function makePool(G) {
  const positions = new Float32Array(POOL_SIZE * 3);
  const colors = new Float32Array(POOL_SIZE * 3);
  // Park every particle far underground until it is spawned.
  for (let i = 0; i < POOL_SIZE; i++) {
    positions[i * 3 + 1] = -999;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.55,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false; // particles move; never let culling hide them
  G.scene.add(points);
  return {
    points, positions, colors,
    vel: new Float32Array(POOL_SIZE * 3),
    life: new Float32Array(POOL_SIZE),
    maxLife: new Float32Array(POOL_SIZE),
    baseColor: new Float32Array(POOL_SIZE * 3),
    smoke: new Uint8Array(POOL_SIZE), // 1 = smoke particle (rises, grey)
    cursor: 0,
  };
}

function spawnParticle(pool, pos, vel, life, r, g, b, isSmoke) {
  const i = pool.cursor;
  pool.cursor = (pool.cursor + 1) % POOL_SIZE;
  pool.positions[i * 3] = pos.x + (Math.random() - 0.5) * 0.6;
  pool.positions[i * 3 + 1] = (pos.y == null ? 1 : pos.y) + Math.random() * 0.5;
  pool.positions[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.6;
  pool.vel[i * 3] = vel.x;
  pool.vel[i * 3 + 1] = vel.y;
  pool.vel[i * 3 + 2] = vel.z;
  pool.life[i] = life;
  pool.maxLife[i] = life;
  pool.baseColor[i * 3] = r;
  pool.baseColor[i * 3 + 1] = g;
  pool.baseColor[i * 3 + 2] = b;
  pool.colors[i * 3] = r;
  pool.colors[i * 3 + 1] = g;
  pool.colors[i * 3 + 2] = b;
  pool.smoke[i] = isSmoke ? 1 : 0;
}

export function initEffects(G) {
  G.effects = G.effects || {};
  G.effects.shakeAmt = 0;
  G.effects.shakeT = 0;
  G.effects.flash = null; // {light, t, max} — explosion light, decayed in update
  G.effects.pool = makePool(G);

  G.helpers = G.helpers || {};
  G.helpers.spawnExplosion = (pos, big) => spawnExplosion(G, pos, big);
  G.helpers.spawnSmoke = (pos) => spawnSmoke(G, pos);
  G.helpers.spawnGoldBurst = (pos) => spawnGoldBurst(G, pos);
  G.helpers.shake = (amt) => shake(G, amt);
}

export function spawnExplosion(G, pos, big) {
  if (!G.effects || !G.effects.pool || !pos) return;
  const pool = G.effects.pool;
  const count = big ? 140 : 60;
  const speed = big ? 16 : 10;
  const fireColors = [
    [1.0, 0.85, 0.2], // yellow core
    [1.0, 0.55, 0.1], // orange
    [0.9, 0.25, 0.05], // deep red-orange
    [0.6, 0.6, 0.6], // smoke-grey sparks
  ];
  for (let n = 0; n < count; n++) {
    // Random direction on a sphere, biased upward.
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const v = speed * (0.35 + Math.random() * 0.65);
    const vel = {
      x: Math.sin(phi) * Math.cos(theta) * v,
      y: Math.abs(Math.cos(phi)) * v * 0.9 + 2,
      z: Math.sin(phi) * Math.sin(theta) * v,
    };
    const c = fireColors[Math.floor(Math.random() * fireColors.length)];
    spawnParticle(pool, pos, vel, 0.5 + Math.random() * 0.8, c[0], c[1], c[2], false);
  }
  // Lingering smoke column on top of the fireball.
  spawnSmoke(G, pos);
  // Brief orange point light so nearby buildings and cars catch the flash.
  if (G.scene) {
    if (G.effects.flash && G.effects.flash.light) {
      G.scene.remove(G.effects.flash.light);
    }
    const light = new THREE.PointLight(0xff8c1a, big ? 60 : 30, big ? 40 : 25, 1.8);
    light.position.set(pos.x, (pos.y == null ? 1 : pos.y) + 2, pos.z);
    G.scene.add(light);
    G.effects.flash = { light, t: 0.45, max: 0.45 };
  }
  shake(G, big ? 0.9 : 0.5);
  if (G.helpers && G.helpers.playSound) G.helpers.playSound('explosion');
}

export function spawnSmoke(G, pos) {
  if (!G.effects || !G.effects.pool || !pos) return;
  const pool = G.effects.pool;
  for (let n = 0; n < 18; n++) {
    const vel = {
      x: (Math.random() - 0.5) * 1.6,
      y: 2.2 + Math.random() * 2.0,
      z: (Math.random() - 0.5) * 1.6,
    };
    const grey = 0.25 + Math.random() * 0.25;
    spawnParticle(pool, pos, vel, 1.4 + Math.random() * 1.2, grey, grey, grey, true);
  }
}

export function spawnGoldBurst(G, pos) {
  if (!G.effects || !G.effects.pool || !pos) return;
  const pool = G.effects.pool;
  // Gold burst for Golden Seagull collection (round 5): 50 bright gold
  // particles fired upward in a fountain, no external textures — plain
  // points from the shared pool, same as explosions and smoke.
  const goldColors = [
    [1.0, 0.84, 0.0], // pure gold
    [1.0, 0.92, 0.35], // pale gold spark
    [0.85, 0.65, 0.1], // deep antique gold
  ];
  for (let n = 0; n < 50; n++) {
    const theta = Math.random() * Math.PI * 2;
    const v = 4 + Math.random() * 7;
    const vel = {
      x: Math.cos(theta) * v * 0.55,
      y: 5 + Math.random() * 6,
      z: Math.sin(theta) * v * 0.55,
    };
    const c = goldColors[Math.floor(Math.random() * goldColors.length)];
    spawnParticle(pool, pos, vel, 0.8 + Math.random() * 0.7, c[0], c[1], c[2], false);
  }
  // Brief gold point-light flash so the statue and nearby ground catch it.
  if (G.scene) {
    if (G.effects.flash && G.effects.flash.light) {
      G.scene.remove(G.effects.flash.light);
    }
    const light = new THREE.PointLight(0xffd700, 35, 22, 1.8);
    light.position.set(pos.x, (pos.y == null ? 1 : pos.y) + 2, pos.z);
    G.scene.add(light);
    G.effects.flash = { light, t: 0.4, max: 0.4 };
  }
  shake(G, 0.15);
  if (G.helpers && G.helpers.playSound) G.helpers.playSound('gull');
}

export function shake(G, amt) {
  if (!G.effects) return;
  G.effects.shakeAmt = Math.max(G.effects.shakeAmt || 0, amt || 0.3);
  G.effects.shakeT = Math.max(G.effects.shakeT || 0, 0.45);
}

export function updateEffects(G, dt) {
  const eff = G.effects;
  if (!eff || !eff.pool) return;
  const pool = eff.pool;
  const step = Math.max(dt, 0.0001);

  for (let i = 0; i < POOL_SIZE; i++) {
    if (pool.life[i] <= 0) continue;
    pool.life[i] -= step;
    if (pool.life[i] <= 0) {
      // Park the dead particle underground and blank its colour.
      pool.positions[i * 3 + 1] = -999;
      pool.colors[i * 3] = 0;
      pool.colors[i * 3 + 1] = 0;
      pool.colors[i * 3 + 2] = 0;
      continue;
    }
    // Smoke rises and drifts; fire falls with gravity and drag.
    if (pool.smoke[i]) {
      pool.vel[i * 3 + 1] += 1.2 * step; // buoyant rise
      pool.vel[i * 3] *= (1 - 0.4 * step);
      pool.vel[i * 3 + 2] *= (1 - 0.4 * step);
    } else {
      pool.vel[i * 3 + 1] += GRAVITY * 0.55 * step;
      const drag = 1 - 1.6 * step;
      pool.vel[i * 3] *= drag;
      pool.vel[i * 3 + 2] *= drag;
    }
    pool.positions[i * 3] += pool.vel[i * 3] * step;
    pool.positions[i * 3 + 1] += pool.vel[i * 3 + 1] * step;
    pool.positions[i * 3 + 2] += pool.vel[i * 3 + 2] * step;
    // Ground bounce: keep particles from sinking through the street, and
    // bleed off horizontal speed on impact so debris settles, not slides.
    if (pool.positions[i * 3 + 1] < 0.15 && !pool.smoke[i]) {
      pool.positions[i * 3 + 1] = 0.15;
      pool.vel[i * 3 + 1] = Math.abs(pool.vel[i * 3 + 1]) * 0.3;
      pool.vel[i * 3] *= 0.6;
      pool.vel[i * 3 + 2] *= 0.6;
    }
    // Fade the colour toward black as the particle dies.
    const f = pool.life[i] / pool.maxLife[i];
    pool.colors[i * 3] = pool.baseColor[i * 3] * f;
    pool.colors[i * 3 + 1] = pool.baseColor[i * 3 + 1] * f;
    pool.colors[i * 3 + 2] = pool.baseColor[i * 3 + 2] * f;
  }
  pool.points.geometry.attributes.position.needsUpdate = true;
  pool.points.geometry.attributes.color.needsUpdate = true;

  // Explosion flash light decays and is removed.
  if (eff.flash) {
    eff.flash.t -= step;
    if (eff.flash.t <= 0) {
      if (G.scene) G.scene.remove(eff.flash.light);
      eff.flash = null;
    } else if (eff.flash.light) {
      eff.flash.light.intensity *= Math.max(0, eff.flash.t / eff.flash.max);
    }
  }

  // Camera shake decays; main.js applies shakeAmt as a camera offset
  // while shakeT > 0.
  if (eff.shakeT > 0) {
    eff.shakeT -= step;
    if (eff.shakeT <= 0) eff.shakeAmt = 0;
    else eff.shakeAmt *= (1 - 2.2 * step);
  } else {
    eff.shakeAmt = 0;
  }
}
