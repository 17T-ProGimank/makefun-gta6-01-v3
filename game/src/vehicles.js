// SOLMARA — vehicles.js (round 5)
// makeCar / initVehicles / updateVehicles: traffic AI on the road grid +
// arcade player-car physics (W/S accel-brake, A/D steer).
// Round 4: honours car._upgradeTop (extra top speed) and car.paint (body
// colour); makeCar accepts opts {paint, upgrade}.
// Round 5 (at the TOP): spike-slow — while G.state.spikeSlowUntil is in the
// future, the player car runs at half speed (read defensively).

export function spikeSlowActive(G) {
  if (!G || !G.state) return false;
  const until = G.state.spikeSlowUntil || 0;
  const now = G.state.time || 0;
  return until > now;
}

export function spikeSlowFactor(G) {
  if (!spikeSlowActive(G)) return 1;
  const f = (G.config && G.config.spikes && G.config.spikes.slowFactor) || 0.5;
  return f;
}

const TRAFFIC_COLORS = [0xc0c0c0, 0x8a2a2a, 0x2a6ab0, 0xd9b84a, 0x3a8a4a, 0x6a5a8a, 0xd9d9d9, 0x1a1a1a];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function makeCar(G, color, kind, opts) {
  const o = opts || {};
  // paint overrides the passed colour; upgrade adds top speed.
  const paint = (o.paint !== undefined && o.paint !== null) ? o.paint : color;
  const upgrade = o.upgrade || 0;
  const upgradeTop = (upgrade > 0) ? upgrade * 6 : 0;

  const group = new THREE.Group();
  const bodyColor = (paint !== undefined && paint !== null) ? paint : 0x888888;
  const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x14181d });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.65, 4.4), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), darkMat);
  cabin.position.set(0, 1.15, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheelPos = [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]];
  const wheels = [];
  for (const [wx, wz] of wheelPos) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    group.add(w);
    wheels.push(w);
  }
  // Headlights: on at golden hour.
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const lx of [-0.65, 0.65]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), lightMat);
    lamp.position.set(lx, 0.6, 2.25);
    group.add(lamp);
  }
  // Brake lights (lit while the player brakes; see updateVehicles).
  const brakeMat = new THREE.MeshBasicMaterial({ color: 0x550000 });
  const brakeLights = [];
  for (const lx of [-0.65, 0.65]) {
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), brakeMat);
    bl.position.set(lx, 0.6, -2.25);
    group.add(bl);
    brakeLights.push(bl);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.18, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
    );
    bar.position.set(0, 1.55, -0.2);
    group.add(bar);
  }
  if (G.scene) G.scene.add(group);

  const car = {
    group,
    mesh: group,
    pos: new THREE.Vector3(0, 0, 0),
    heading: 0,
    speed: 0,
    color: bodyColor,
    paint: bodyColor,
    kind: kind || 'traffic',
    upgrade: upgrade,
    _upgradeTop: upgradeTop,
    wheels,
    brakeLights,
    // Traffic AI state.
    target: null,
    waitTimer: 0,
    cruise: 8 + Math.random() * 8,
  };
  group.position.copy(car.pos);
  return car;
}

function placeOnRoad(G, car) {
  try {
    if (typeof G.helpers === 'object' && G.helpers && typeof G.helpers.randomRoadPos === 'function') {
      const p = G.helpers.randomRoadPos(G);
      car.pos.set(p.x, 0, p.z);
      return;
    }
  } catch (err) { /* fall through to the local grid pick */ }
  const lines = [-168, -126, -84, -42, 0, 42, 84, 126, 168];
  const line = lines[Math.floor(Math.random() * lines.length)];
  const along = (Math.random() - 0.5) * 360;
  if (Math.random() < 0.5) car.pos.set(line, 0, along);
  else car.pos.set(along, 0, line);
  car.heading = (Math.random() < 0.5) ? 0 : Math.PI / 2;
}

export function initVehicles(G) {
  const count = (G.config && G.config.traffic && G.config.traffic.count) || 18;
  G.cars = G.cars || [];
  // Attach makeCar so missions/crew can spawn cars (rival + chase + crew assist).
  if (G.helpers) G.helpers.makeCar = (color, kind, opts) => makeCar(G, color, kind, opts);
  // Player car: Ember Orange, parked at the garage forecourt.
  const playerCar = makeCar(G, 0xff6a1a, 'player', {});
  const g = (G.city && G.city.spawnPoints && G.city.spawnPoints.garage) || { x: -27, z: 42 };
  playerCar.pos.set(g.x - 4, 0, g.z + 8);
  playerCar.heading = Math.PI;
  playerCar.group.position.copy(playerCar.pos);
  playerCar.group.rotation.y = playerCar.heading;
  G.cars.push(playerCar);
  G.playerCar = playerCar;
  // Traffic.
  for (let i = 0; i < count; i++) {
    const car = makeCar(G, pick(TRAFFIC_COLORS), 'traffic', {});
    placeOnRoad(G, car);
    car.group.position.copy(car.pos);
    car.group.rotation.y = car.heading;
    G.cars.push(car);
  }
}

function steerToward(car, tx, tz, dt, turnRate) {
  const dx = tx - car.pos.x;
  const dz = tz - car.pos.z;
  const want = Math.atan2(dx, dz);
  let dh = want - car.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  car.heading += Math.max(-turnRate * dt, Math.min(turnRate * dt, dh));
}

export function updateVehicles(G, dt) {
  if (!G || !Array.isArray(G.cars)) return;
  if (G.state && (G.state.paused || G.state.gameOver || !G.state.started)) return;
  if (!dt || dt <= 0) dt = 0.016;
  dt = Math.min(dt, 0.05);
  const cfg = (G.config && G.config.car) || {};
  const baseMax = cfg.maxSpeed || 40;
  const accel = cfg.accel || 20;
  const brake = cfg.brake || 32;
  const reverseMax = cfg.reverseMax || 12;
  const turn = cfg.turn || 2.4;
  const keys = (G.input && G.input.keys) ? G.input.keys : new Set();
  const bounds = (G.city && G.city.bounds) || 210;

  for (const car of G.cars) {
    if (!car || !car.pos) continue;
    if (car.kind === 'player' && G.state.inVehicle === car) {
      // Player driving: arcade physics.
      const top = baseMax + (car._upgradeTop || 0);
      const slow = spikeSlowFactor(G);
      const effTop = top * slow;
      if (keys.has('KeyW') || keys.has('ArrowUp')) {
        car.speed += accel * dt;
      } else if (keys.has('KeyS') || keys.has('ArrowDown')) {
        if (car.speed > 0.5) car.speed -= brake * dt;
        else car.speed -= accel * 0.6 * dt;
      } else {
        // Coast: gentle drag.
        car.speed -= Math.sign(car.speed) * 6 * dt;
        if (Math.abs(car.speed) < 0.2) car.speed = 0;
      }
      car.speed = Math.max(-reverseMax * slow, Math.min(effTop, car.speed));
      const braking = (keys.has('KeyS') || keys.has('ArrowDown')) && car.speed > 0.5;
      if (car.brakeLights) {
        for (const bl of car.brakeLights) bl.material.color.setHex(braking ? 0xff1a1a : 0x550000);
      }
      const steer = (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0)
        - (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
      const spd = Math.abs(car.speed);
      if (steer !== 0 && spd > 0.5) {
        car.heading += steer * turn * dt * Math.min(1, spd / 12) * Math.sign(car.speed);
      }
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      G.state.speed = Math.abs(car.speed) * 3.6; // km/h for the HUD
      // Wheel spin.
      if (car.wheels) {
        for (const w of car.wheels) w.rotation.x += car.speed * dt * 2.2;
      }
    } else if (car.kind === 'traffic') {
      // Traffic AI: follow the road grid, pause at random, avoid the player.
      if (car.waitTimer > 0) {
        car.waitTimer -= dt;
        car.speed = 0;
      } else {
        if (!car.target) {
          const lines = [-168, -126, -84, -42, 0, 42, 84, 126, 168];
          const line = lines[Math.floor(Math.random() * lines.length)];
          const along = (Math.random() - 0.5) * 360;
          if (Math.random() < 0.5) car.target = { x: line, z: along };
          else car.target = { x: along, z: line };
        }
        const dx = car.target.x - car.pos.x;
        const dz = car.target.z - car.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 4) {
          car.target = null;
          if (Math.random() < 0.25) car.waitTimer = 1 + Math.random() * 3;
        } else {
          steerToward(car, car.target.x, car.target.z, dt, 2.0);
          // Ease off when the player car is right ahead.
          let nearPlayer = false;
          if (G.state.inVehicle && G.state.inVehicle.pos) {
            const pdx = G.state.inVehicle.pos.x - car.pos.x;
            const pdz = G.state.inVehicle.pos.z - car.pos.z;
            if (Math.hypot(pdx, pdz) < 8) nearPlayer = true;
          }
          const want = nearPlayer ? 0 : car.cruise;
          car.speed += (want - car.speed) * Math.min(1, 1.5 * dt);
          car.pos.x += Math.sin(car.heading) * car.speed * dt;
          car.pos.z += Math.cos(car.heading) * car.speed * dt;
        }
      }
      if (car.wheels) {
        for (const w of car.wheels) w.rotation.x += car.speed * dt * 2.2;
      }
    }
    // Keep every car inside the city.
    car.pos.x = Math.max(-bounds, Math.min(bounds, car.pos.x));
    car.pos.z = Math.max(-bounds, Math.min(bounds, car.pos.z));
    car.group.position.copy(car.pos);
    car.group.rotation.y = car.heading;
  }
}
