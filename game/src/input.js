// input.js — keyboard + mouse input for SOLMARA.
// Owns G.input.keys (a Set of KeyboardEvent.code strings) and G.input.mouseDX
// (accumulated horizontal mouse movement, decayed each frame by updateInput).
// Every other module reads G.input.keys; nothing else touches the listeners.

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'ShiftLeft', 'ShiftRight',
  'KeyE', 'KeyF', 'KeyG', 'KeyC', 'KeyR', 'Enter', 'Escape',
]);

export function initInput(G) {
  if (!G.input) G.input = { keys: new Set(), mouseDX: 0 };
  // Edge detection: code -> game time of its most recent fresh press.
  // Other modules (bribe, weapon switch) ask wasPressed(G, code) for a
  // one-frame action instead of a held key.
  if (!G.input.pressed) G.input.pressed = new Map();
  const keys = G.input.keys;

  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    // Ignore repeats: the Set already dedupes, but skip re-adding.
    keys.add(e.code);
    if (!e.repeat && G.input.pressed) {
      G.input.pressed.set(e.code, G.state ? G.state.time : 0);
    }
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
  });
  // Losing focus must not leave a key stuck down.
  window.addEventListener('blur', () => {
    keys.clear();
  });
  window.addEventListener('mousemove', (e) => {
    if (typeof e.movementX === 'number') G.input.mouseDX += e.movementX;
  });
}

export function updateInput(G, dt) {
  // Decay the accumulated mouse delta so a flick does not spin the camera
  // forever; frame-rate independent.
  if (G.input) G.input.mouseDX *= Math.pow(0.001, dt);
  if (G.input && Math.abs(G.input.mouseDX) < 0.001) G.input.mouseDX = 0;
  // Drop pressed-edge entries older than the window so the map stays tiny
  // and a stale press can never fire later.
  if (G.input && G.input.pressed) {
    const now = G.state ? G.state.time : 0;
    for (const [code, t] of G.input.pressed) {
      if (now - t > 0.15) G.input.pressed.delete(code);
    }
  }
}

// isDown(G, code): true while the key is held down. (Base-spec contract;
// combat.js imports it for hold-to-fire on KeyF.)
export function isDown(G, code) {
  return !!(G.input && G.input.keys && G.input.keys.has(code));
}

// wasPressed(G, code): true only if the key was freshly pressed within the
// last 0.15s of game time. Consumes the press (a second call returns false),
// so edge-triggered actions (bribe, weapon switch) fire exactly once.
export function wasPressed(G, code) {
  if (!G.input || !G.input.pressed) return false;
  const t = G.input.pressed.get(code);
  if (t === undefined) return false;
  G.input.pressed.delete(code);
  const now = G.state ? G.state.time : 0;
  return now - t <= 0.15;
}
