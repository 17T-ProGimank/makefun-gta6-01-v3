// police.js — SMPD wanted system for SOLMARA (round 5).
// Patrol cruisers chase Dante, AIR-1 circles at 3+ stars, roadblocks spawn
// ahead at 3+ stars, spike strips deploy at 4+ stars, and a bribe (B) buys
// off one star on foot at 1–2 stars. Wanted decays when the player outruns
// or hides from every unit; a cruiser touching Dante on foot for 2s busts
// him. Every cross-module helper is read defensively — this module never
// crashes when another module's helper is absent.

import { wasPressed } from './input.js';

const POLICE_BLUE = 0x1d3a6e;
const POLICE_WHITE = 0xf2f2f2;
const LIGHT_RED = 0xff2a2a;
const LIGHT_BLUE = 0x2a6aff;

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
function shake(G, amt) {
  const f = helper(G, 'shake');
  if (f) { try { f(amt); } catch (e) { /* effects missing: skip */ } }
}

function playerPos(G) {
  if (G.player && G.player.group) return G.player.group.position;
  if (G.player && G.player.pos) return G.player.pos;
  return { x: 0, y: 0, z: 0 };
}
function playerHeading(G) {
  if (G.state && G.state.inVehicle) return G.state.inVehicle.heading || 0;
  return (G.player && G.player.heading) || 0;
}
function forward(heading) {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}
function dist2D(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// ---- meshes (built fresh here; no dependency on vehicles.js) ----

function buildCruiser() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: POLICE_WHITE, roughness: 0.5, metalness: 0.3 });
  const darkMat = new THREE.MeshStandardMaterial({ color: POLICE_BLUE, roughness: 0.5, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4), bodyMat);
  body.position.y = 0.55;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), darkMat);
  cabin.position.set(0, 1.2, -0.2);
  const redMat = new THREE.MeshStandardMaterial({ color: LIGHT_RED, emissive: LIGHT_RED, emissiveIntensity: 1.4 });
  const blueMat = new THREE.MeshStandardMaterial({ color: LIGHT_BLUE, emissive: LIGHT_BLUE, emissiveIntensity: 1.4 });
  const redBar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.3), redMat);
  redBar.position.set(-0.32, 1.62, -0.2);
  const blueBar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.3), blueMat);
  blueBar.position.set(0.32, 1.62, -0.2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const wheel = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, 0.6), wheelMat);
    wheel.position.set(wx, 0.3, wz);
    group.add(wheel);
  }
  group.add(body, cabin, redBar, blueBar);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  group.userData.lightRed = redMat;
  group.userData.lightBlue = blueMat;
  return group;
}

function buildHeli() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x22303f, roughness: 0.5, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 4.5), bodyMat);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 3.5), bodyMat);
  tail.position.set(0, 0.3, -3.8);
  const rotor = new THREE.Mesh(
    new THREE.BoxGeometry(9, 0.08, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 })
  );
  rotor.position.y = 1.0;
  const skidMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 });
  for (const sx of [-0.9, 0.9]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 3.2), skidMat);
    skid.position.set(sx, -0.9, 0);
    group.add(skid);
  }
  group.add(body, tail, rotor);
  group.userData.rotor = rotor;
  return group;
}

function buildRoadblock() {
  const group = new THREE.Group();
  const orange = new THREE.MeshStandardMaterial({ color: 0xe8641c, roughness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 });
  for (let i = -1; i <= 1; i++) {
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 0.5), orange);
    barrier.position.set(i * 3.6, 0.55, 0);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.25, 0.52), white);
    stripe.position.set(i * 3.6, 0.85, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 1.2), white);
    leg.position.set(i * 3.6, 0.2, 0);
    group.add(barrier, stripe, leg);
  }
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

function buildSpikeStrip() {
  const group = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.9 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb8c0c8, roughness: 0.3, metalness: 0.8 });
  const strip = new THREE.Mesh(new THREE.BoxGeometry(9, 0.18, 1.4), dark);
  strip.position.y = 0.09;
  group.add(strip);
  for (let i = 0; i < 7; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 4), steel);
    spike.position.set(-4 + i * (8 / 6), 0.42, 0);
    group.add(spike);
  }
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

// ---- spawners ----

function spawnPoliceCar(G) {
  const p = playerPos(G);
  const a = Math.random() * Math.PI * 2;
  const r = 55 + Math.random() * 20;
  const bounds = (G.city && G.city.bounds) || 210;
  const x = clamp(p.x + Math.cos(a) * r, -bounds, bounds);
  const z = clamp(p.z + Math.sin(a) * r, -bounds, bounds);
  const group = buildCruiser();
  group.position.set(x, 0, z);
  G.scene.add(group);
  const car = { group, pos: group.position, heading: 0, speed: 0, kind: 'police' };
  G.police.cars.push(car);
  return car;
}

function removePoliceCar(G, car) {
  G.scene.remove(car.group);
  const i = G.police.cars.indexOf(car);
  if (i >= 0) G.police.cars.splice(i, 1);
}

function spawnHeli(G) {
  const group = buildHeli();
  G.scene.add(group);
  G.police.heli = { group, angle: Math.random() * Math.PI * 2 };
}

function spawnRoadblock(G) {
  const p = playerPos(G);
  const f = forward(playerHeading(G));
  const group = buildRoadblock();
  group.position.set(p.x + f.x * 55, 0, p.z + f.z * 55);
  group.rotation.y = playerHeading(G);
  G.scene.add(group);
  G.police.roadblocks.push({ group, timer: 20, x: group.position.x, z: group.position.z });
}

function spawnSpikeStrip(G) {
  const p = playerPos(G);
  const f = forward(playerHeading(G));
  const group = buildSpikeStrip();
  group.position.set(p.x + f.x * 48, 0, p.z + f.z * 48);
  group.rotation.y = playerHeading(G);
  G.scene.add(group);
  G.police.spikeStrips.push({ group, timer: 12, x: group.position.x, z: group.position.z });
}

function clearUnits(G) {
  for (const c of [...G.police.cars]) removePoliceCar(G, c);
  if (G.police.heli) {
    G.scene.remove(G.police.heli.group);
    G.police.heli = null;
  }
  for (const r of G.police.roadblocks) G.scene.remove(r.group);
  G.police.roadblocks = [];
  for (const s of G.police.spikeStrips) G.scene.remove(s.group);
  G.police.spikeStrips = [];
}

// ---- public contract ----

export function initPolice(G) {
  G.police = {
    cars: [],
    heli: null,
    roadblocks: [],
    spikeStrips: [],
    bribed: false,
    arrestTimer: 0,
    decayTimer: 0,
    roadblockTimer: 6,
    spikeTimer: 8,
  };
  if (!G.state) G.state = {};
  G.state.bribeAvailable = false;
  G.state.spikeAhead = false;
  if (G.state.spikeSlowUntil === undefined) G.state.spikeSlowUntil = 0;
  G.helpers = G.helpers || {};
  // setWanted clamps 0–5; clearing the heat also clears the bribe flag.
  G.helpers.setWanted = (n) => {
    const v = clamp(Math.round(n) || 0, 0, 5);
    const changed = G.state.wanted !== v;
    G.state.wanted = v;
    if (v === 0 && G.police) G.police.bribed = false;
    return changed;
  };
}

export function updatePolice(G, dt) {
  if (!G.police || !G.scene) return;
  if (!G.state || !G.state.started || G.state.paused || G.state.gameOver) return;

  const cfg = (G.config && G.config.police) || {};
  const maxCars = cfg.maxCars || 6;
  const roadblockAt = cfg.roadblockAtStars || 3;
  const spikesCfg = (G.config && G.config.spikes) || {};
  const spikeAt = spikesCfg.atStars || 4;
  const spikeMax = spikesCfg.maxStrips || 2;
  const spikeSecs = spikesCfg.slowSecs || 10;
  const bribeCfg = (G.config && G.config.bribe) || {};
  const bribeCost = bribeCfg.cost || 500;
  const bribeMax = bribeCfg.maxStars || 2;
  const bounds = (G.city && G.city.bounds) || 210;

  const wanted = G.state.wanted || 0;
  const p = playerPos(G);
  const onFoot = !G.state.inVehicle;

  // No heat: every unit stands down.
  if (wanted === 0) {
    if (G.police.cars.length || G.police.heli || G.police.roadblocks.length || G.police.spikeStrips.length) {
      clearUnits(G);
    }
    G.state.bribeAvailable = false;
    G.state.spikeAhead = false;
    G.police.arrestTimer = 0;
    G.police.decayTimer = 0;
    return;
  }

  // --- patrol cruisers: match count to the wanted level ---
  const want = Math.min(wanted, maxCars);
  while (G.police.cars.length < want) spawnPoliceCar(G);
  while (G.police.cars.length > want) removePoliceCar(G, G.police.cars[G.police.cars.length - 1]);

  // --- chase: steer toward the player, ease up when right on top of him on foot ---
  const chaseSpeed = 24 + wanted * 2.5;
  let nearest = Infinity;
  for (const car of G.police.cars) {
    const dx = p.x - car.pos.x;
    const dz = p.z - car.pos.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < nearest) nearest = d;
    const desired = Math.atan2(dx, dz);
    car.heading = angleLerp(car.heading, desired, Math.min(1, dt * 2.2));
    const target = d < 4 && onFoot ? 0 : chaseSpeed;
    car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
    car.pos.x += Math.sin(car.heading) * car.speed * dt;
    car.pos.z += Math.cos(car.heading) * car.speed * dt;
    car.group.rotation.y = car.heading;
    car.pos.x = clamp(car.pos.x, -bounds, bounds);
    car.pos.z = clamp(car.pos.z, -bounds, bounds);
    // Light bars flash red/blue in turns, like a real SMPD cruiser.
    const phase = Math.floor((G.state.time || 0) * 4) % 2 === 0;
    const red = car.group.userData.lightRed;
    const blue = car.group.userData.lightBlue;
    if (red) red.emissiveIntensity = phase ? 2.2 : 0.25;
    if (blue) blue.emissiveIntensity = phase ? 0.25 : 2.2;
  }

  // --- AIR-1 helicopter: circles the player at 3+ stars ---
  if (wanted >= 3) {
    if (!G.police.heli) spawnHeli(G);
    const heli = G.police.heli;
    heli.angle += dt * 0.45;
    const hx = p.x + Math.cos(heli.angle) * 30;
    const hz = p.z + Math.sin(heli.angle) * 30;
    heli.group.position.set(hx, 42, hz);
    heli.group.rotation.y = Math.atan2(p.x - hx, p.z - hz);
    if (heli.group.userData.rotor) heli.group.userData.rotor.rotation.y += dt * 30;
  } else if (G.police.heli) {
    G.scene.remove(G.police.heli.group);
    G.police.heli = null;
  }

  // --- roadblocks: up to 2 ahead of the travel direction, 14s cadence ---
  if (wanted >= roadblockAt) {
    G.police.roadblockTimer -= dt;
    if (G.police.roadblockTimer <= 0) {
      G.police.roadblockTimer = 14;
      if (G.police.roadblocks.length < 2) spawnRoadblock(G);
    }
  }
  for (let i = G.police.roadblocks.length - 1; i >= 0; i--) {
    const rb = G.police.roadblocks[i];
    rb.timer -= dt;
    if (rb.timer <= 0) {
      G.scene.remove(rb.group);
      G.police.roadblocks.splice(i, 1);
      continue;
    }
    // Smash through in a vehicle: counts toward the Roadblock Run mission.
    if (!onFoot && dist2D(p, rb) < 4) {
      G.scene.remove(rb.group);
      G.police.roadblocks.splice(i, 1);
      G.state.roadblocksSmashed = (G.state.roadblocksSmashed || 0) + 1;
      shake(G, 0.6);
      sfx(G, 'explosion');
    }
  }

  // --- spike strips (round 5): up to 2 ahead of travel, 12s cadence ---
  if (wanted >= spikeAt) {
    G.police.spikeTimer -= dt;
    if (G.police.spikeTimer <= 0) {
      G.police.spikeTimer = 12;
      if (G.police.spikeStrips.length < spikeMax) spawnSpikeStrip(G);
    }
  }
  let spikeNear = false;
  for (let i = G.police.spikeStrips.length - 1; i >= 0; i--) {
    const s = G.police.spikeStrips[i];
    s.timer -= dt;
    const d = dist2D(p, s);
    if (d < 40) spikeNear = true;
    if (s.timer <= 0) {
      G.scene.remove(s.group);
      G.police.spikeStrips.splice(i, 1);
      continue;
    }
    // Driving over a strip pops the tires: half speed for 10s. On foot: nothing.
    if (!onFoot && d < 4.5) {
      G.state.spikeSlowUntil = G.state.time + spikeSecs;
      shake(G, 0.8);
      sfx(G, 'spike');
      G.scene.remove(s.group);
      G.police.spikeStrips.splice(i, 1);
    }
  }
  G.state.spikeAhead = spikeNear;

  // --- bribe (round 5): on foot, 1–2 stars, within 8 units of a cruiser ---
  const bribeOk = onFoot && wanted >= 1 && wanted <= bribeMax && !G.police.bribed && nearest <= 8;
  G.state.bribeAvailable = bribeOk;
  if (bribeOk && wasPressed(G, 'KeyB')) {
    if ((G.state.money || 0) >= bribeCost) {
      const addMoney = helper(G, 'addMoney');
      if (addMoney) { try { addMoney(-bribeCost); } catch (e) { /* hud missing */ } }
      else G.state.money = (G.state.money || 0) - bribeCost;
      const setWanted = helper(G, 'setWanted');
      if (setWanted) { try { setWanted(wanted - 1); } catch (e) { G.state.wanted = Math.max(0, wanted - 1); } }
      else G.state.wanted = Math.max(0, wanted - 1);
      G.police.bribed = true;
      G.state.bribeAvailable = false;
      sfx(G, 'cash');
      banner(G, 'BRIBED', 'One star bought off — drive clean');
    } else {
      banner(G, 'NOT ENOUGH CASH', `A bribe costs $${bribeCost}`);
    }
  }

  // --- wanted decay: outrun or hide from every unit for ~8s ---
  let evade = 0;
  const crewBonus = helper(G, 'crewBonus');
  if (crewBonus) { try { evade = crewBonus('evade') || 0; } catch (e) { /* crew missing */ } }
  const decayAfter = 8 / (1 + Math.max(0, evade));
  if (nearest > 60) {
    G.police.decayTimer += dt;
    if (G.police.decayTimer >= decayAfter) {
      G.police.decayTimer = 0;
      const setWanted = helper(G, 'setWanted');
      if (setWanted) { try { setWanted(wanted - 1); } catch (e) { /* keep heat */ } }
    }
  } else {
    G.police.decayTimer = 0;
  }

  // --- arrest: a cruiser touching Dante on foot for 2s busts him ---
  if (onFoot && nearest < 2.5) {
    G.police.arrestTimer += dt;
    if (G.police.arrestTimer >= 2) {
      G.police.arrestTimer = 0;
      G.state.gameOver = true;
      banner(G, 'BUSTED', 'The SMPD caught Dante');
      sfx(G, 'siren');
    }
  } else {
    G.police.arrestTimer = 0;
  }
}
