// SOLMARA — pedestrians.js (round 4)
// 28 Solmara locals (CONFIG.peds.count) walking the sidewalks, wandering
// between blocks, and fleeing from explosions and the police at 3+ stars.
import { randomRoadPos, clampToCity } from './city.js';

const SHIRT_COLORS = [0xd96a4a, 0x4a7ad9, 0x53a86b, 0xd9b84a, 0x8a5fc0, 0xd94a8a, 0x4aa8a0, 0xe8e0d0];
const PANTS_COLORS = [0x2e3a4a, 0x3a2e2e, 0x2e4a3a, 0x444444, 0x5a4a2e];
const SKIN_COLORS = [0xc98a5e, 0x8a5a3a, 0xe8b88a, 0x6b4a2e, 0xd9a87a];

function makePedFigure(G, shirt, pants, skin) {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.66, 0.32), shirtMat);
  torso.position.y = 1.02;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skinMat);
  head.position.y = 1.58;
  g.add(head);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), shirtMat);
  armL.position.set(-0.38, 1.02, 0);
  g.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), shirtMat);
  armR.position.set(0.38, 1.02, 0);
  g.add(armR);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.2), pantsMat);
  legL.position.set(-0.14, 0.35, 0);
  g.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.2), pantsMat);
  legR.position.set(0.14, 0.35, 0);
  g.add(legR);
  g.userData.arms = [armL, armR];
  g.userData.legs = [legL, legR];
  return g;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Where the danger is, defensively: a recent explosion position if the
// effects module recorded one, otherwise the nearest police cruiser.
function threatPos(G) {
  try {
    const fx = G.effects || null;
    const cand = (fx && (fx.lastExplosionPos || fx.lastExplosion || fx.explosionPos))
      || G.lastExplosionPos || G.lastExplosion
      || (G.state && (G.state.lastExplosionPos || G.state.lastExplosion));
    if (cand && typeof cand.x === 'number' && typeof cand.z === 'number') {
      const age = (G.state && typeof G.state.time === 'number' && typeof cand.t === 'number')
        ? G.state.time - cand.t : 0;
      if (age < 5) return { x: cand.x, z: cand.z, kind: 'explosion' };
    }
  } catch (err) { /* no explosion threat recorded */ }
  try {
    const cars = (G.police && G.police.cars) || [];
    let best = null;
    let bestD = 12;
    for (const car of cars) {
      if (!car || !car.pos) continue;
      const d = Math.hypot(car.pos.x - G.player.pos.x, car.pos.z - G.player.pos.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    if (best) return { x: best.pos.x, z: best.pos.z, kind: 'police' };
  } catch (err) { /* no police threat */ }
  return null;
}

export function initPedestrians(G) {
  const count = (G.config && G.config.peds && G.config.peds.count) || 28;
  G.peds = [];
  for (let i = 0; i < count; i++) {
    let x = (Math.random() - 0.5) * 320;
    let z = (Math.random() - 0.5) * 320;
    try {
      if (typeof randomRoadPos === 'function') {
        const p = randomRoadPos(G);
        // Sidewalk offset: a few units off the road centreline.
        x = p.x + (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 2);
        z = p.z + (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 2);
      }
    } catch (err) { /* keep the random spot */ }
    try {
      if (typeof clampToCity === 'function') {
        const c = clampToCity(G, x, z); x = c.x; z = c.z;
      }
    } catch (err) { /* keep the raw spot */ }
    const group = makePedFigure(G, pick(SHIRT_COLORS), pick(PANTS_COLORS), pick(SKIN_COLORS));
    group.position.set(x, 0, z);
    if (G.scene) G.scene.add(group);
    G.peds.push({
      group,
      pos: new THREE.Vector3(x, 0, z),
      heading: Math.random() * Math.PI * 2,
      speed: 1.0 + Math.random() * 1.1,
      wanderTimer: 2 + Math.random() * 4,
      fleeing: false,
    });
  }
}

export function updatePedestrians(G, dt) {
  if (!G || !Array.isArray(G.peds) || !G.player) return;
  if (G.state && (G.state.paused || G.state.gameOver || !G.state.started)) return;
  if (!dt || dt <= 0) dt = 0.016;
  dt = Math.min(dt, 0.05);

  const hot = (G.state && (G.state.wanted || 0) >= 3);
  const threat = threatPos(G);
  const bounds = (G.city && G.city.bounds) || 210;

  for (const ped of G.peds) {
    if (!ped || !ped.pos) continue;

    // Step aside: a car (Dante's or traffic) bearing down within 5 units
    // makes a ped sidestep instead of standing in the road to be hit.
    const carNear = (G.state && G.state.inVehicle && G.state.inVehicle.pos)
      ? G.state.inVehicle : null;
    if (carNear) {
      const cdx = ped.pos.x - carNear.pos.x;
      const cdz = ped.pos.z - carNear.pos.z;
      const cd = Math.hypot(cdx, cdz);
      if (cd > 0.01 && cd < 5) {
        ped.heading = Math.atan2(cdx / cd, cdz / cd);
        ped.pos.x += Math.sin(ped.heading) * 3.2 * dt;
        ped.pos.z += Math.cos(ped.heading) * 3.2 * dt;
        ped.group.position.copy(ped.pos);
        ped.group.rotation.y = ped.heading;
        continue;
      }
    }

    // Race-awareness (round 5): during an active race, peds near the current
    // checkpoint ring step away from it so they don't stand in the racing line.
    try {
      const race = G.race;
      if (race && race.active && Array.isArray(race.checkpoints)
        && typeof race.current === 'number' && race.checkpoints[race.current]) {
        const cp = race.checkpoints[race.current];
        const rdx = ped.pos.x - cp.x;
        const rdz = ped.pos.z - cp.z;
        const rd = Math.hypot(rdx, rdz);
        if (rd > 0.01 && rd < 15) {
          ped.heading = Math.atan2(rdx / rd, rdz / rd);
          ped.pos.x += Math.sin(ped.heading) * 4.0 * dt;
          ped.pos.z += Math.cos(ped.heading) * 4.0 * dt;
          ped.group.position.copy(ped.pos);
          ped.group.rotation.y = ped.heading;
          continue;
        }
      }
    } catch (err) { /* race-awareness is optional */ }

    // Flee: at 3+ stars, or from a recent explosion / a cruiser right on top.
    let fleeX = 0, fleeZ = 0;
    if (hot && threat) {
      fleeX = ped.pos.x - threat.x;
      fleeZ = ped.pos.z - threat.z;
    } else if (threat && threat.kind === 'explosion') {
      fleeX = ped.pos.x - threat.x;
      fleeZ = ped.pos.z - threat.z;
    }
    const fleeLen = Math.hypot(fleeX, fleeZ);
    if (fleeLen > 0.01 && fleeLen < 40) {
      ped.fleeing = true;
      ped.heading = Math.atan2(fleeX / fleeLen, fleeZ / fleeLen);
      ped.pos.x += Math.sin(ped.heading) * 5.0 * dt;
      ped.pos.z += Math.cos(ped.heading) * 5.0 * dt;
    } else {
      ped.fleeing = false;
      // Wander: stroll along, picking a new direction every few seconds.
      ped.wanderTimer -= dt;
      if (ped.wanderTimer <= 0) {
        ped.wanderTimer = 2 + Math.random() * 4;
        // Bias new headings to the road grid (N/S/E/W) so peds read as
        // walking the sidewalks rather than cutting across blocks.
        const grid = Math.floor(Math.random() * 4) * (Math.PI / 2);
        ped.heading = grid + (Math.random() - 0.5) * 0.5;
      }
      ped.pos.x += Math.sin(ped.heading) * ped.speed * dt;
      ped.pos.z += Math.cos(ped.heading) * ped.speed * dt;
    }

    // Turn around at the city edge instead of walking out of the world.
    if (Math.abs(ped.pos.x) > bounds || Math.abs(ped.pos.z) > bounds) {
      ped.pos.x = Math.max(-bounds, Math.min(bounds, ped.pos.x));
      ped.pos.z = Math.max(-bounds, Math.min(bounds, ped.pos.z));
      ped.heading += Math.PI;
      ped.wanderTimer = 1 + Math.random() * 2;
    }

    ped.group.position.copy(ped.pos);
    ped.group.rotation.y = ped.heading;
    const swing = Math.sin(G.state.time * (ped.fleeing ? 14 : 7) + ped.pos.x) * 0.45;
    const arms = ped.group.userData.arms || [];
    const legs = ped.group.userData.legs || [];
    if (arms[0]) arms[0].rotation.x = swing;
    if (arms[1]) arms[1].rotation.x = -swing;
    if (legs[0]) legs[0].rotation.x = -swing;
    if (legs[1]) legs[1].rotation.x = swing;
  }
}
