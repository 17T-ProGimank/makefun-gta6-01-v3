// respect.js — SOLMARA round 5: respect points and rank progression.
// Same RANKS and contract as round 4. Points come from events: missions call
// addRespect(reward/10) on completion (plus mission-specific bonuses),
// collectibles call addRespect(10) per Golden Seagull, a gold race result
// calls addRespect(25), and mission 15 calls addRespect(1200). Rank-ups
// show a banner, play a chime, and save. All helper calls are defensive.

export const RANKS = [
  { at: 0, title: 'NOBODY' },
  { at: 100, title: 'STREET HUSTLER' },
  { at: 300, title: 'WHEELMAN' },
  { at: 700, title: 'MADE' },
  { at: 1400, title: 'SHOT CALLER' },
  { at: 2500, title: 'KING OF SOLMARA' },
];

function call(G, name, ...args) {
  const fn = G && G.helpers && G.helpers[name];
  if (typeof fn === 'function') {
    try { return fn(...args); } catch (e) { /* helper failed: ignore */ }
  }
  return undefined;
}

function rankFor(points) {
  let current = RANKS[0];
  let next = null;
  for (let i = 0; i < RANKS.length; i++) {
    if (points >= RANKS[i].at) current = RANKS[i];
    else { next = RANKS[i]; break; }
  }
  return { title: current.title, points, nextAt: next ? next.at : null };
}

export function initRespect(G) {
  G.respect = G.respect || {};
  if (typeof G.respect.points !== 'number') G.respect.points = 0;
  G.helpers = G.helpers || {};

  // addRespect(n): add points; on rank-up, banner + chime + save.
  G.helpers.addRespect = (n) => {
    const amount = typeof n === 'number' ? n : 0;
    if (amount === 0) return rankFor(G.respect.points);
    const before = rankFor(G.respect.points);
    G.respect.points = Math.max(0, G.respect.points + amount);
    const after = rankFor(G.respect.points);
    if (after.title !== before.title) {
      call(G, 'showBanner', 'RANK UP — ' + after.title, 'Respect ' + G.respect.points + (after.nextAt ? ' · next rank at ' + after.nextAt : ' · top of the city'));
      call(G, 'playSound', 'cash');
    }
    call(G, 'saveGame');
    return after;
  };

  // respectRank(): {title, points, nextAt} for the current points.
  G.helpers.respectRank = () => rankFor(G.respect.points);

  // respectProgress(): {points, title, nextAt, frac} for the HUD respect bar
  // (frac = progress from the current rank to the next, 1 at max rank).
  G.helpers.respectProgress = () => {
    const r = rankFor(G.respect.points);
    const current = RANKS.filter((rk) => rk.at <= G.respect.points).pop() || RANKS[0];
    const frac = r.nextAt === null ? 1 : (G.respect.points - current.at) / (r.nextAt - current.at);
    return { points: G.respect.points, title: r.title, nextAt: r.nextAt, frac: Math.max(0, Math.min(1, frac)) };
  };
}

export function updateRespect(G, dt) {
  // No-op: respect only changes via addRespect calls from missions,
  // collectibles, races and combat. Kept so main.js can call it in the
  // update loop like every other module.
  return;
}
