// crew.js — SOLMARA round 4: the crew system.
// Mara Voss runs the jobs; Jax Calloway (mission 10) and Lena Marlowe
// (mission 11) join the crew and give passive bonuses. During a mission with
// crewAssist, one crew driver car follows the player loosely. All helper
// calls are defensive: a missing helper is skipped, never a crash.

export const CREW = [
  { id: 'mara', name: 'Mara Voss', role: 'Fixer', bonus: '+10% mission payout', unlocked: true },
  { id: 'jax', name: 'Jax Calloway', role: 'Wheelman', bonus: '+15% getaway speed, police lose you faster', unlocked: false },
  { id: 'lena', name: 'Lena Marlowe', role: 'Ghost Driver', bonus: '-1 wanted star on mission start, +10% payout', unlocked: false },
];

const CREW_COLORS = { mara: 0xff7a1a, jax: 0x2a9d8f, lena: 0x8a5cf6 };

function call(G, name, ...args) {
  const fn = G && G.helpers && G.helpers[name];
  if (typeof fn === 'function') {
    try { return fn(...args); } catch (e) { /* helper failed: ignore */ }
  }
  return undefined;
}

function findMember(id) {
  return CREW.find((c) => c.id === id) || null;
}

export function initCrew(G) {
  G.crew = G.crew || {};
  if (!Array.isArray(G.crew.members)) G.crew.members = ['mara'];
  if (!G.crew.members.includes('mara')) G.crew.members.unshift('mara');
  if (typeof G.crew.active === 'undefined') G.crew.active = null;
  G.crew.car = null;
  G.crew._spawnTried = false;

  G.helpers = G.helpers || {};

  // Recruit a crew member by id. Idempotent; banners and saves defensively.
  G.helpers.recruitCrew = (id) => {
    const member = findMember(id);
    if (!member) return false;
    if (!G.crew.members.includes(id)) G.crew.members.push(id);
    member.unlocked = true;
    call(G, 'showBanner', member.name.toUpperCase() + ' JOINS THE CREW', member.role + ' — ' + member.bonus);
    call(G, 'playSound', 'cash');
    call(G, 'saveGame');
    return true;
  };

  // crewBonus(kind): 'payout' -> multiplier (1 when nobody gives it),
  // 'evade' -> multiplier (1.5 with Jax, else 1), 'wanted' -> star offset
  // (-1 with Lena, else 0).
  G.helpers.crewBonus = (kind) => {
    const members = G.crew.members || [];
    if (kind === 'payout') {
      let mult = 1;
      if (members.includes('mara')) mult += 0.1;
      if (members.includes('lena')) mult += 0.1;
      return mult;
    }
    if (kind === 'evade') return members.includes('jax') ? 1.5 : 1;
    if (kind === 'wanted') return members.includes('lena') ? -1 : 0;
    return 1;
  };

  // crewList(): full member objects for the members currently recruited.
  G.helpers.crewList = () => {
    const members = G.crew.members || [];
    return CREW.filter((c) => members.includes(c.id)).map((c) => ({ ...c }));
  };

  // crewCount(): number of recruited members (used by the pause screen stats).
  G.helpers.crewCount = () => (G.crew.members || []).length;
}

export function updateCrew(G, dt) {
  if (!G || !G.crew || !G.missions || !G.missions.current) return;
  if (!G.state || !G.state.started || G.state.paused || G.state.gameOver) return;

  const assist = G.missions.current.crewAssist;

  // Lena's bonus: -1 wanted star when a new mission starts (once per mission).
  if (G.crew._lastMissionId !== G.missions.current.id) {
    G.crew._lastMissionId = G.missions.current.id;
    const wantedOff = call(G, 'crewBonus', 'wanted');
    if (typeof wantedOff === 'number' && wantedOff < 0 && (G.state.wanted || 0) > 0) {
      call(G, 'setWanted', Math.max(0, (G.state.wanted || 0) + wantedOff));
    }
  }

  if (!assist) {
    // No crew assist on this mission: park any assist car out of the way.
    if (G.crew.car && G.crew.car.group && G.crew.car.group.visible !== false) {
      G.crew.car.group.visible = false;
    }
    return;
  }

  // Spawn one crew driver car the first time a crewAssist mission runs.
  if (!G.crew.car && !G.crew._spawnTried) {
    G.crew._spawnTried = true;
    const makeCar = G.helpers && G.helpers.makeCar;
    if (typeof makeCar === 'function') {
      try {
        const p = (G.player && G.player.pos) || { x: 0, z: 0 };
        const car = makeCar(G, CREW_COLORS[assist] || 0xff7a1a, 'traffic', {});
        if (car) {
          car.kind = 'crew';
          if (car.pos) { car.pos.x = p.x - 8; car.pos.z = p.z + 6; }
          if (car.group) car.group.visible = true;
          G.crew.car = car;
        }
      } catch (e) { G.crew.car = null; }
    }
    // If makeCar is unavailable, skip gracefully — the mission still works.
  }

  const car = G.crew.car;
  if (!car || !car.pos || !G.player || !G.player.pos) return;
  if (car.group) car.group.visible = true;

  // Follow loosely: hold a spot ~9 units behind the player, catch up if far.
  const p = G.player.pos;
  const heading = (G.player && G.player.heading) || 0;
  const tx = p.x - Math.sin(heading) * 9;
  const tz = p.z - Math.cos(heading) * 9;
  const dx = tx - car.pos.x;
  const dz = tz - car.pos.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist > 70) {
    // Too far behind (player teleported or sped off): catch up instantly.
    car.pos.x = tx;
    car.pos.z = tz;
  } else if (dist > 2) {
    const speed = Math.min(26, 8 + dist * 0.6);
    car.pos.x += (dx / dist) * speed * dt;
    car.pos.z += (dz / dist) * speed * dt;
    car.heading = Math.atan2(dx, dz);
  }
  if (car.group) {
    car.group.position.set(car.pos.x, 0, car.pos.z);
    car.group.rotation.y = car.heading || 0;
  }
}
