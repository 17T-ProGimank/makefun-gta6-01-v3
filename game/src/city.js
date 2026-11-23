// SOLMARA — city.js (round 5)
// 420-unit island city: bay + beach (south), downtown towers (centre), port
// (east), residential blocks (west), hills (north). Golden hour: warm low sun
// from the WEST, long shadows, streetlights on.
// Round 4: safehouse near the beach, 4 shop fronts, garage forecourt bays.
// Round 5 (exports at the TOP): race start pad at the port, checkpoint rings,
// 12 Golden Seagull statues, port office, weapon pickup crates, Vultures'
// compound yard at the port.

export function makeCheckpointRing(G, x, z, i) {
  // Gold torus ring, upright, numbered by a floating marker cube.
  const mat = new THREE.MeshLambertMaterial({ color: 0xffc21a, emissive: 0x8a6200 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.35, 10, 28), mat);
  ring.position.set(x, 4.5, z);
  ring.rotation.y = Math.PI / 2;
  if (G.scene) G.scene.add(ring);
  const tag = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.4, 1.4),
    new THREE.MeshLambertMaterial({ color: 0xffe066, emissive: 0x664400 }),
  );
  tag.position.set(x, 10, z);
  if (G.scene) G.scene.add(tag);
  return { group: ring, tag, x, z, index: i || 0 };
}

export function seagullSpots(G) {
  // Defensive read: CONFIG may be missing in a bare test harness.
  const spots = (G && G.config && G.config.collectibles && G.config.collectibles.spots)
    || (G && G.config && G.config.collectibles && G.config.collectibles.spots);
  if (Array.isArray(spots)) return spots;
  return [];
}

export function inSafehouse(G) {
  if (!G || !G.player || !G.player.pos) return false;
  const s = (G.city && G.city.spawnPoints && G.city.spawnPoints.safehouse)
    || { x: -60, z: 178 };
  const dx = G.player.pos.x - s.x;
  const dz = G.player.pos.z - s.z;
  return Math.hypot(dx, dz) < 6;
}

function makeSeagull(G, x, z) {
  // Small gold bird on a stone plinth.
  const group = new THREE.Group();
  const gold = new THREE.MeshLambertMaterial({ color: 0xffc21a, emissive: 0x7a5600 });
  const stone = new THREE.MeshLambertMaterial({ color: 0x8a8a86 });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 1.2), stone);
  plinth.position.y = 0.8;
  group.add(plinth);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), gold);
  body.scale.set(1, 0.7, 1.6);
  body.position.y = 2.1;
  group.add(body);
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.5), gold);
  wingL.position.set(-0.8, 2.3, 0);
  wingL.rotation.z = 0.35;
  group.add(wingL);
  const wingR = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.5), gold);
  wingR.position.set(0.8, 2.3, 0);
  wingR.rotation.z = -0.35;
  group.add(wingR);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 6), gold);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 2.2, 0.9);
  group.add(beak);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(1.4, 20),
    new THREE.MeshBasicMaterial({ color: 0xffc21a, transparent: true, opacity: 0.25 }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.06;
  group.add(glow);
  group.position.set(x, 0, z);
  group.rotation.y = Math.random() * Math.PI * 2;
  if (G.scene) G.scene.add(group);
  return group;
}

function makeWeaponCrate(G, x, z, color) {
  // Glowing pickup crate (combat.js collects on proximity).
  const mat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a, emissive: color });
  const crate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.6), mat);
  crate.position.set(x, 0.6, z);
  if (G.scene) G.scene.add(crate);
  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.25, 1.9),
    new THREE.MeshBasicMaterial({ color }),
  );
  glow.position.set(x, 0.12, z);
  if (G.scene) G.scene.add(glow);
  return crate;
}

function box(G, w, h, d, color, x, y, z, emissive) {
  const mat = new THREE.MeshLambertMaterial({ color, emissive: emissive || 0x000000 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  if (G.scene) G.scene.add(m);
  return m;
}

export function buildCity(G) {
  const C = (G.config && G.config.colors) || {};
  const palette = C.buildingPalette || [0x8a6f5c, 0x6f7d8a, 0x9a8a6f, 0x7a6f8a, 0xb08a5c, 0x5c7a8a];
  const size = (G.config && G.config.city && G.config.city.size) || 420;
  const half = size / 2;
  G.city = G.city || {};
  G.city.bounds = half;
  G.city.roads = [];
  G.city.spawnPoints = {
    garage: { x: -27, z: 42 },
    beach: { x: -20, z: 178 },
    downtown: { x: 0, z: 0 },
    safehouse: { x: -60, z: 178 },
    office: { x: 168, z: -30 },
    racePad: { x: 148, z: 40 },
    compound: { x: 150, z: -110 },
  };

  // Sky: gradient dome + warm horizon glow, sun low in the WEST.
  const skyGeo = new THREE.SphereGeometry(900, 16, 12);
  const skyMat = new THREE.MeshBasicMaterial({
    color: C.skyHorizon || 0xff9a3c, side: THREE.BackSide, fog: false,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  if (G.scene) G.scene.add(sky);
  const sun = new THREE.DirectionalLight(C.sun || 0xffb347, 1.6);
  sun.position.set(-300, 90, 60); // low in the west
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 900;
  if (G.scene) G.scene.add(sun);
  if (G.scene) G.scene.add(new THREE.AmbientLight(0xff8a4a, 0.45));
  const hemi = new THREE.HemisphereLight(C.skyTop || 0x35507a, 0x3d5a3a, 0.5);
  if (G.scene) G.scene.add(hemi);

  // Ground, sand beach (south), sea beyond the shore.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshLambertMaterial({ color: C.ground || 0x3d5a3a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  if (G.scene) G.scene.add(ground);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(size, 42),
    new THREE.MeshLambertMaterial({ color: C.sand || 0xd9c08a }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.05, half - 21);
  sand.receiveShadow = true;
  if (G.scene) G.scene.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 500),
    new THREE.MeshLambertMaterial({ color: C.sea || 0x1d5f7a }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, half + 250);
  if (G.scene) G.scene.add(sea);

  // Road grid: 9 blocks of 42, roads on the 42-unit lines.
  const roadMat = new THREE.MeshLambertMaterial({ color: C.road || 0x23272e });
  const roadW = 12;
  for (let i = -4; i <= 4; i++) {
    const c = i * 42;
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(roadW, size), roadMat);
    ns.rotation.x = -Math.PI / 2;
    ns.position.set(c, 0.08, 0);
    ns.receiveShadow = true;
    if (G.scene) G.scene.add(ns);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(size, roadW), roadMat);
    ew.rotation.x = -Math.PI / 2;
    ew.position.set(0, 0.08, c);
    ew.receiveShadow = true;
    if (G.scene) G.scene.add(ew);
    G.city.roads.push({ x: c, z: 0, dir: 'ns' });
    G.city.roads.push({ x: 0, z: c, dir: 'ew' });
  }

  // Buildings: downtown towers in the centre, low blocks elsewhere.
  let bi = 0;
  for (let bx = -4; bx <= 4; bx++) {
    for (let bz = -4; bz <= 4; bz++) {
      const cx = bx * 42 + 21;
      const cz = bz * 42 + 21;
      if (Math.abs(cx) > 185 || Math.abs(cz) > 165) continue;
      // Skip the port yard (east), the beach strip and the race pad area.
      if (cx > 130) continue;
      if (cz > 165) continue;
      const downtown = Math.abs(cx) < 85 && Math.abs(cz) < 85;
      const h = downtown ? 22 + Math.random() * 38 : 6 + Math.random() * 10;
      const w = 18 + Math.random() * 8;
      const d = 18 + Math.random() * 8;
      const color = palette[bi % palette.length];
      bi++;
      const b = box(G, w, h, d, color, cx, h / 2, cz);
      // Lit windows: warm glow on the sunset side.
      const winMat = new THREE.MeshLambertMaterial({
        color: C.windowLit || 0xffd27a, emissive: 0xcc8822,
      });
      const winRows = Math.max(1, Math.floor(h / 6));
      for (let r = 0; r < winRows; r++) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, 1.4), winMat);
        win.position.set(cx, 3 + r * 6, cz + d / 2 + 0.06);
        if (G.scene) G.scene.add(win);
      }
      void b;
    }
  }

  // Port (east): warehouses, containers, cranes.
  const whMat = new THREE.MeshLambertMaterial({ color: 0x7a6a55 });
  for (let i = 0; i < 3; i++) {
    const wh = new THREE.Mesh(new THREE.BoxGeometry(30, 12, 18), whMat);
    wh.position.set(165, 6, -90 + i * 55);
    wh.castShadow = true;
    if (G.scene) G.scene.add(wh);
  }
  const contColors = [0xb03a2a, 0x2a6ab0, 0x3a8a4a, 0xb08a2a];
  for (let i = 0; i < 10; i++) {
    const c = box(G, 8, 3, 3, contColors[i % 4], 150 + (i % 2) * 12, 1.5, 60 + i * 9, 0);
    c.rotation.y = (i % 3) * 0.1;
  }
  // Port cranes (tall, silhouetted against the sunset).
  for (let i = 0; i < 2; i++) {
    box(G, 3, 42, 3, 0x8a2a2a, 185, 21, -40 + i * 80, 0);
    box(G, 26, 2.5, 2.5, 0x8a2a2a, 172, 40, -40 + i * 80, 0);
  }

  // Hills (north): low green mounds.
  const hillMat = new THREE.MeshLambertMaterial({ color: 0x2e4a2e });
  for (let i = 0; i < 5; i++) {
    const hill = new THREE.Mesh(new THREE.ConeGeometry(28 + Math.random() * 14, 16 + Math.random() * 10, 8), hillMat);
    hill.position.set(-150 + i * 75, 6, -185);
    hill.castShadow = true;
    if (G.scene) G.scene.add(hill);
  }

  // Ember Garage (round 4 landmark) at spawnPoints.garage.
  const g = G.city.spawnPoints.garage;
  box(G, 26, 9, 16, 0x4a2a1a, g.x, 4.5, g.z - 12, 0);
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(20, 3, 0.6),
    new THREE.MeshLambertMaterial({ color: 0xff6a1a, emissive: 0xaa3300 }),
  );
  sign.position.set(g.x, 10.5, g.z - 4);
  if (G.scene) G.scene.add(sign);
  // Garage forecourt: 4 marked parking bays in front of the garage.
  const bayMat = new THREE.MeshBasicMaterial({ color: 0xffc21a });
  for (let i = 0; i < 4; i++) {
    const bay = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 7), bayMat);
    bay.rotation.x = -Math.PI / 2;
    bay.position.set(g.x - 12 + i * 8, 0.12, g.z + 8);
    if (G.scene) G.scene.add(bay);
  }

  // Safehouse (round 4): small house near the beach spawn.
  const s = G.city.spawnPoints.safehouse;
  box(G, 10, 6, 9, 0xe8dcc0, s.x, 3, s.z, 0);
  box(G, 11, 2.5, 10, 0x8a2a2a, s.x, 7, s.z, 0);

  // Shops (round 4): 4 signed fronts downtown.
  const shops = [
    { name: 'TIRE KING', x: -42, z: -14, color: 0x2a2a2a },
    { name: 'BURGER BAY', x: 42, z: -14, color: 0x8a2a2a },
    { name: 'SOL SUN TAN', x: -42, z: 70, color: 0xd9a02a },
    { name: '24H MART', x: 42, z: 70, color: 0x2a6a8a },
  ];
  for (const shop of shops) {
    box(G, 16, 7, 12, 0x9a8a7a, shop.x, 3.5, shop.z, 0);
    const fascia = new THREE.Mesh(
      new THREE.BoxGeometry(15, 2, 0.5),
      new THREE.MeshLambertMaterial({ color: shop.color, emissive: shop.color }),
    );
    fascia.position.set(shop.x, 7.5, shop.z + 6.2);
    if (G.scene) G.scene.add(fascia);
    void shop.name;
  }

  // --- Round 5 additions ---

  // Race start pad at the port: checkered decal + arch.
  const pad = G.city.spawnPoints.racePad;
  const padBase = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 10),
    new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
  );
  padBase.rotation.x = -Math.PI / 2;
  padBase.position.set(pad.x, 0.12, pad.z);
  if (G.scene) G.scene.add(padBase);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 2; j++) {
      if ((i + j) % 2 === 0) continue;
      const sq = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 5),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      sq.rotation.x = -Math.PI / 2;
      sq.position.set(pad.x - 6 + i * 4, 0.14, pad.z - 2.5 + j * 5);
      if (G.scene) G.scene.add(sq);
    }
  }
  const archMat = new THREE.MeshLambertMaterial({ color: 0xffc21a, emissive: 0x664400 });
  const postL = new THREE.Mesh(new THREE.BoxGeometry(1, 7, 1), archMat);
  postL.position.set(pad.x - 8, 3.5, pad.z);
  if (G.scene) G.scene.add(postL);
  const postR = new THREE.Mesh(new THREE.BoxGeometry(1, 7, 1), archMat);
  postR.position.set(pad.x + 8, 3.5, pad.z);
  if (G.scene) G.scene.add(postR);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(17, 1.2, 1), archMat);
  beam.position.set(pad.x, 7.2, pad.z);
  if (G.scene) G.scene.add(beam);

  // 3 checkpoint rings downtown (shared by mission 13 + repeatable race).
  const cps = (G.config && G.config.race && G.config.race.checkpoints) || [];
  G.city.checkpointRings = [];
  for (let i = 0; i < cps.length; i++) {
    G.city.checkpointRings.push(makeCheckpointRing(G, cps[i].x, cps[i].z, i));
  }

  // 12 Golden Seagull statues.
  G.city.seagulls = [];
  G.city.seagullMeshes = [];
  for (const spot of seagullSpots(G)) {
    const mesh = makeSeagull(G, spot.x, spot.z);
    G.city.seagulls.push(mesh);
    G.city.seagullMeshes.push(mesh);
  }

  // Port office (mission 14 target): two-storey block with a marked door.
  const o = G.city.spawnPoints.office;
  box(G, 18, 12, 14, 0x5c6a7a, o.x, 6, o.z, 0);
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(3, 4.5, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x2a1a0a, emissive: 0x442200 }),
  );
  door.position.set(o.x, 2.25, o.z + 7.2);
  if (G.scene) G.scene.add(door);

  // Weapon pickup crates: SMG at the port warehouse, shotgun at the beach
  // lifeguard hut.
  const wspots = (G.config && G.config.weapons && G.config.weapons.spots) || {};
  if (wspots.smg) makeWeaponCrate(G, wspots.smg.x, wspots.smg.z, 0x2ad9ff);
  if (wspots.shotgun) makeWeaponCrate(G, wspots.shotgun.x, wspots.shotgun.z, 0xff6a2a);
  // Lifeguard hut on the beach.
  box(G, 5, 4, 5, 0xe8e0d0, -20, 2, 178, 0);
  box(G, 6, 0.6, 6, 0xd92a2a, -20, 4.3, 178, 0);

  // Vultures' compound yard at the port (mission 15): fenced yard + crates.
  const yardX = 150, yardZ = -110;
  const fenceMat = new THREE.MeshLambertMaterial({ color: 0x4a4a4a });
  const fenceN = new THREE.Mesh(new THREE.BoxGeometry(40, 3, 0.4), fenceMat);
  fenceN.position.set(yardX, 1.5, yardZ - 18);
  if (G.scene) G.scene.add(fenceN);
  const fenceS = new THREE.Mesh(new THREE.BoxGeometry(40, 3, 0.4), fenceMat);
  fenceS.position.set(yardX, 1.5, yardZ + 18);
  if (G.scene) G.scene.add(fenceS);
  const fenceW = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3, 36), fenceMat);
  fenceW.position.set(yardX - 20, 1.5, yardZ);
  if (G.scene) G.scene.add(fenceW);
  const fenceE = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3, 36), fenceMat);
  fenceE.position.set(yardX + 20, 1.5, yardZ);
  if (G.scene) G.scene.add(fenceE);
  for (let i = 0; i < 5; i++) {
    box(G, 4, 2.5, 4, 0x3a3a3a, yardX - 12 + (i % 3) * 10, 1.25, yardZ - 8 + Math.floor(i / 3) * 12, 0);
  }
  const rookSign = new THREE.Mesh(
    new THREE.BoxGeometry(10, 2, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x1a1a1a, emissive: 0x8a1a1a }),
  );
  rookSign.position.set(yardX, 5, yardZ - 18);
  if (G.scene) G.scene.add(rookSign);

  // Streetlights along the road grid (golden hour: all on).
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  for (let i = -4; i <= 4; i++) {
    for (let j = -4; j <= 4; j++) {
      if ((i + j) % 2 !== 0) continue;
      const px = i * 42 + 8;
      const pz = j * 42 + 8;
      if (Math.abs(px) > 190 || Math.abs(pz) > 190) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 6), poleMat);
      pole.position.set(px, 3, pz);
      if (G.scene) G.scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampMat);
      lamp.position.set(px, 6.2, pz);
      if (G.scene) G.scene.add(lamp);
    }
  }
}

export function randomRoadPos(G) {
  const lines = [-168, -126, -84, -42, 0, 42, 84, 126, 168];
  const line = lines[Math.floor(Math.random() * lines.length)];
  const along = (Math.random() - 0.5) * 360;
  if (Math.random() < 0.5) return { x: line, z: along };
  return { x: along, z: line };
}

export function clampToCity(G, x, z) {
  const b = (G && G.city && G.city.bounds) || 210;
  return { x: Math.max(-b, Math.min(b, x)), z: Math.max(-b, Math.min(b, z)) };
}
