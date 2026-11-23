// SOLMARA round 5 — screenshot poses (?shot=cover|mission|activity|city).
// applyShot(G, name) stages the scene for one still: positions the player /
// cars, sets the wanted level, objective and banner, then frames the camera.
// Called by main.js 1.2s after load when ?shot= is present. All reads are
// defensive: if a helper or spawn point is missing, fall back gracefully.
import { spawnEnemy } from './combat.js';
export function applyShot(G, name) {
  const sp = (G.city && G.city.spawnPoints) || {};
  const garage = sp.garage || { x: -27, z: 42 };
  const beach = sp.beach || { x: 0, z: 190 };
  const downtown = sp.downtown || { x: 0, z: 0 };
  const port = sp.port || { x: 180, z: 60 };

  const setWanted = (n) => { if (G.helpers.setWanted) G.helpers.setWanted(n); else G.state.wanted = n; };
  const setObjective = (t, target) => {
    if (G.helpers.setObjective) G.helpers.setObjective(t, target);
    else { G.state.objectiveText = t; G.state.objectiveTarget = target; }
  };
  const banner = (t, s) => { if (G.helpers.showBanner) G.helpers.showBanner(t, s); };
  const placePlayer = (x, z, heading) => {
    G.player.pos.set(x, 0, z);
    G.player.heading = heading || 0;
    if (G.player.group) { G.player.group.position.set(x, 0, z); G.player.group.rotation.y = G.player.heading; }
  };
  const placeCar = (x, z, heading) => {
    const car = G.cars.find((c) => c.kind === 'player') || G.cars[0];
    if (!car) return null;
    car.pos.set(x, 0, z);
    car.heading = heading || 0;
    if (car.group) { car.group.position.set(x, 0, z); car.group.rotation.y = car.heading; }
    return car;
  };
  const frame = (cx, cy, cz, lx, ly, lz) => {
    G.camera.position.set(cx, cy, cz);
    G.camera.lookAt(lx, ly, lz);
  };

  // Start the game world so the HUD is live for every pose.
  G.state.started = true;
  G.state.paused = false;
  // Hide the start menu: initMenus showed it, and started=true alone does
  // not dismiss it, so a shot would otherwise be covered by the menu.
  for (const id of ['menu-start', 'menu-pause', 'menu-gameover', 'menu-garage', 'menu-crew']) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }
  if (G.hud && G.hud.el && G.hud.el.hud) G.hud.el.hud.classList.add('on');

  if (name === 'cover') {
    // Street race: Dante at the race start pad, checkpoint ring ahead,
    // rival Vultures car beside, race timer on the HUD, golden hour.
    const pad = sp.racePad || { x: port.x - 20, z: port.z };
    const car = placeCar(pad.x, pad.z, -Math.PI / 2);
    if (car) G.state.inVehicle = car;
    G.player.onFoot = false;
    // Rival car beside the player (a traffic car re-dressed as a Vulture).
    const rival = G.cars.find((c) => c.kind === 'traffic');
    if (rival) {
      rival.pos.set(pad.x + 6, 0, pad.z);
      rival.heading = -Math.PI / 2;
      if (rival.group) { rival.group.position.copy(rival.pos); rival.group.rotation.y = rival.heading; }
    }
    G.race = { active: true, checkpoints: [{ x: pad.x, z: pad.z - 60 }, { x: pad.x + 40, z: pad.z - 90 }, { x: pad.x, z: pad.z - 140 }], current: 0, startTime: G.state.time, parTime: 90 };
    setWanted(0);
    setObjective('STREET KINGS — beat the 90s clock through 3 checkpoints', { x: pad.x, z: pad.z - 60, label: 'CHECKPOINT 1' });
    banner('STREET KINGS', '3 checkpoints · 90 seconds · beat the Vultures');
    frame(pad.x - 4, 5, pad.z + 16, pad.x, 1.5, pad.z - 40);
  } else if (name === 'mission') {
    // Finale "End of the Vultures": compound assault at the port yard,
    // 5 stars, AIR-1 overhead, payout banner visible.
    const cmp = sp.compound || port;
    placePlayer(cmp.x - 12, cmp.z + 14, Math.PI / 2);
    G.player.onFoot = true;
    G.state.inVehicle = null;
    setWanted(5);
    for (let i = 0; i < 5; i++) spawnEnemy(G, cmp.x + i * 4 - 8, cmp.z - 6 - (i % 2) * 6);
    spawnEnemy(G, cmp.x, cmp.z - 12, { hp: 300 }); // Silas Rook, 3x health
    setObjective('END OF THE VULTURES — clear the compound, take down Silas Rook', { x: cmp.x, z: cmp.z - 12, label: 'ROOK' });
    banner('END OF THE VULTURES', 'Reward $12,000 · Rook\'s Vulture GT');
    frame(cmp.x - 24, 9, cmp.z + 28, cmp.x, 2, cmp.z - 10);
  } else if (name === 'activity') {
    // Golden Seagull pickup: Dante on foot at the beach statue, gold glow,
    // "SEAGULLS 4/12" on the HUD. Statue 0 is the beach west-end spot.
    const gull = (G.collectibles && G.collectibles.found) || [];
    for (let i = 0; i < 4 && i < gull.length; i++) gull[i] = true;
    const sx = -60, sz = 185; // beach west-end seagull statue
    placePlayer(sx + 3, sz + 3, Math.PI * 0.75);
    G.player.onFoot = true;
    G.state.inVehicle = null;
    setWanted(0);
    setObjective('GOLDEN SEAGULLS — find all 12 statues across Solmara', { x: sx, z: sz, label: 'SEAGULL 4/12' });
    banner('GOLDEN SEAGULL', '+$250 · +10 respect');
    frame(sx + 10, 4, sz + 11, sx, 1.5, sz);
  } else {
    // city: wide aerial of downtown + bay at golden hour with traffic.
    placePlayer(downtown.x, downtown.z + 20, 0);
    setWanted(0);
    setObjective('SOLMARA — explore the island, take jobs from Mara', null);
    frame(downtown.x - 90, 110, downtown.z + 150, downtown.x, 0, downtown.z - 60);
  }
}
