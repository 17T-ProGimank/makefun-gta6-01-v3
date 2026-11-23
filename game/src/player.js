// SOLMARA — player.js (round 4)
// Dante Reyes on foot: box-built figure, WASD + Shift run + Space jump,
// E to enter/exit the nearest car, +10 health/s inside the safehouse.
import { inSafehouse } from './city.js';

let ePrev = false;
let vy = 0;
let grounded = true;
let dustTimer = 0;

function makeFigure(G) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5e });
  const jacket = new THREE.MeshLambertMaterial({ color: 0x27324a });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2e4a6b });
  const shoes = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const hair = new THREE.MeshLambertMaterial({ color: 0x14100c });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), jacket);
  torso.position.y = 1.08;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
  head.position.y = 1.68;
  g.add(head);
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.42), hair);
  hairTop.position.y = 1.86;
  g.add(hairTop);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.66, 0.16), jacket);
  armL.position.set(-0.42, 1.08, 0);
  g.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.66, 0.16), jacket);
  armR.position.set(0.42, 1.08, 0);
  g.add(armR);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.68, 0.22), jeans);
  legL.position.set(-0.16, 0.38, 0);
  g.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.68, 0.22), jeans);
  legR.position.set(0.16, 0.38, 0);
  g.add(legR);
  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.36), shoes);
  shoeL.position.set(-0.16, 0.05, 0.05);
  g.add(shoeL);
  const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.36), shoes);
  shoeR.position.set(0.16, 0.05, 0.05);
  g.add(shoeR);
  g.userData.arms = [armL, armR];
  g.userData.legs = [legL, legR];
  return g;
}

function nearestCar(G, maxDist) {
  let best = null;
  let bestD = maxDist;
  const cars = Array.isArray(G.cars) ? G.cars : [];
  for (const car of cars) {
    if (!car || !car.pos) continue;
    if (car.kind === 'police') continue;
    const dx = car.pos.x - G.player.pos.x;
    const dz = car.pos.z - G.player.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function initPlayer(G) {
  const spawn = (G.city && G.city.spawnPoints && G.city.spawnPoints.garage)
    ? G.city.spawnPoints.garage : { x: -27, z: 66 };
  if (!G.player) G.player = {};
  G.player.pos = new THREE.Vector3(spawn.x, 0, spawn.z);
  G.player.heading = 0;
  G.player.speed = 0;
  G.player.onFoot = true;
  if (!G.player.group) {
    G.player.group = makeFigure(G);
    if (G.scene) G.scene.add(G.player.group);
  }
  G.player.group.position.copy(G.player.pos);
  G.player.group.visible = true;
  G.state.inVehicle = null;
  ePrev = false;
  vy = 0;
  grounded = true;
}

export function updatePlayer(G, dt) {
  if (!G || !G.player || !G.state) return;
  if (G.state.paused || G.state.gameOver || !G.state.started) return;
  if (!dt || dt <= 0) dt = 0.016;
  dt = Math.min(dt, 0.05);

  // Safehouse heal: +10 health/s while inside the zone (city.js helper).
  try {
    if (typeof inSafehouse === 'function' && inSafehouse(G)) {
      G.state.health = Math.min(100, (G.state.health ?? 100) + 10 * dt);
    }
  } catch (err) { /* safehouse check must never break the player loop */ }
  G.state.health = Math.max(0, Math.min(100, G.state.health ?? 100));

  const keys = (G.input && G.input.keys) ? G.input.keys : new Set();
  const eDown = keys.has('KeyE');
  if (eDown && !ePrev) {
    if (G.player.onFoot) {
      const car = nearestCar(G, 4.5);
      if (car) {
        G.state.inVehicle = car;
        G.player.onFoot = false;
        G.player.group.visible = false;
        G.state.carsStolen = (G.state.carsStolen || 0) + 1;
        try {
          if (G.helpers && typeof G.helpers.addRespect === 'function') G.helpers.addRespect(2);
        } catch (err) { /* respect is optional */ }
        try {
          if (G.helpers && typeof G.helpers.playSound === 'function') G.helpers.playSound('click');
        } catch (err) { /* audio is optional */ }
      }
    } else if (G.state.inVehicle) {
      const car = G.state.inVehicle;
      const sideX = Math.cos(car.heading || 0);
      const sideZ = -Math.sin(car.heading || 0);
      G.player.pos.set(car.pos.x + sideX * 2.2, 0, car.pos.z + sideZ * 2.2);
      // Clamp the exit spot so Dante never steps out beyond the city edge.
      const b = (G.city && G.city.bounds) || 210;
      G.player.pos.x = Math.max(-b, Math.min(b, G.player.pos.x));
      G.player.pos.z = Math.max(-b, Math.min(b, G.player.pos.z));
      vy = 0;
      grounded = true;
      G.state.speed = 0;
      G.player.heading = car.heading || 0;
      G.state.inVehicle = null;
      G.player.onFoot = true;
      G.player.speed = 0;
      G.player.group.visible = true;
      G.player.group.position.copy(G.player.pos);
    }
  }
  ePrev = eDown;

  // Driving: vehicles.js owns the car physics; keep the figure glued to the car.
  if (!G.player.onFoot) {
    const car = G.state.inVehicle;
    if (car && car.pos) {
      G.player.pos.set(car.pos.x, 0, car.pos.z);
      G.player.heading = car.heading || 0;
      G.player.group.position.copy(G.player.pos);
    }
    return;
  }

  // On-foot movement, camera-relative so W always walks away from the camera.
  const cam = G.camera;
  let fwdX = 0, fwdZ = -1;
  if (cam) {
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const len = Math.hypot(dir.x, dir.z);
    if (len > 0.001) { fwdX = dir.x / len; fwdZ = dir.z / len; }
  }
  const rightX = -fwdZ, rightZ = fwdX;
  let mx = 0, mz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) { mx += fwdX; mz += fwdZ; }
  if (keys.has('KeyS') || keys.has('ArrowDown')) { mx -= fwdX; mz -= fwdZ; }
  if (keys.has('KeyA') || keys.has('ArrowLeft')) { mx -= rightX; mz -= rightZ; }
  if (keys.has('KeyD') || keys.has('ArrowRight')) { mx += rightX; mz += rightZ; }
  const mLen = Math.hypot(mx, mz);
  const running = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const speed = running ? (G.config.player.runSpeed || 10) : (G.config.player.walkSpeed || 6);
  if (mLen > 0.001) {
    mx /= mLen; mz /= mLen;
    G.player.pos.x += mx * speed * dt;
    G.player.pos.z += mz * speed * dt;
    G.player.speed = speed;
    // Run-dust puffs (round 5): sprinting on foot kicks up dust at the heels.
    dustTimer -= dt;
    if (running && dustTimer <= 0) {
      dustTimer = 0.3;
      try {
        if (G.helpers && typeof G.helpers.spawnSmoke === 'function') {
          G.helpers.spawnSmoke(G, new THREE.Vector3(G.player.pos.x, 0.15, G.player.pos.z));
        }
      } catch (err) { /* dust is purely visual */ }
    }
    const targetHeading = Math.atan2(mx, mz);
    let dh = targetHeading - G.player.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    G.player.heading += dh * Math.min(1, 12 * dt);
  } else {
    G.player.speed = 0;
  }

  // Jump: a small hop, gravity pulls back to the ground.
  if (keys.has('Space') && grounded) {
    vy = 5.2;
    grounded = false;
  }
  if (!grounded) {
    vy -= 14 * dt;
    G.player.pos.y += vy * dt;
    if (G.player.pos.y <= 0) { G.player.pos.y = 0; vy = 0; grounded = true; }
  }

  // Stay inside the city.
  const bounds = (G.city && G.city.bounds) || 210;
  G.player.pos.x = Math.max(-bounds, Math.min(bounds, G.player.pos.x));
  G.player.pos.z = Math.max(-bounds, Math.min(bounds, G.player.pos.z));

  // Pose the figure: swing arms/legs while walking, idle bob otherwise.
  G.player.group.position.copy(G.player.pos);
  G.player.group.rotation.y = G.player.heading;
  const swing = G.player.speed > 0 ? Math.sin(G.state.time * 10) * 0.55 : 0;
  const arms = G.player.group.userData.arms || [];
  const legs = G.player.group.userData.legs || [];
  if (arms[0]) arms[0].rotation.x = swing;
  if (arms[1]) arms[1].rotation.x = -swing;
  if (legs[0]) legs[0].rotation.x = -swing;
  if (legs[1]) legs[1].rotation.x = swing;
}
