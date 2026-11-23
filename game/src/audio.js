// audio.js — SOLMARA sound (round 5).
// WebAudio only, NO audio files. Everything is synthesised: engine hum
// (pitch follows speed), siren, gunshot, explosion, cash chime, and 4
// procedural radio stations of chiptune loops with DJ idents every ~45s.
// Audio starts only after the first user gesture (the START button calls
// initAudio / resumeAudio); creating the context earlier would be muted
// by the browser anyway, so initAudio is safe to call early but stays
// silent until resumed.
// Radio state persists through save.js: on init we read G.saveData
// (station + radioOn) defensively — defaults OFF / station 0.
// R key: first press turns the radio ON (station 0), later presses cycle
// SOL FM → EMBER ROCK → BAY BASS → SOLMARA NIGHTS → back to SOL FM.

export const STATIONS = [
  {
    id: 'sol', name: 'SOL FM', wave: 'sine', bpm: 100,
    dj: 'Sunny',
    lines: [
      'Golden hour on SOL FM — Sunny here, riding the sunset with you.',
      'SOL FM, where every drive feels like the last lap of summer.',
    ],
    tracks: ['Sunset Coastline', 'Palm Static'],
  },
  {
    id: 'ember', name: 'EMBER ROCK', wave: 'square', bpm: 140,
    dj: 'Rex',
    lines: [
      'EMBER ROCK — Rex turning the volume up till the windows shake.',
      'Rex here on EMBER ROCK — guitars loud, brakes louder.',
    ],
    tracks: ['Burnout Avenue', 'Chrome Thunder'],
  },
  {
    id: 'bass', name: 'BAY BASS', wave: 'sawtooth', bpm: 120,
    dj: 'Marina',
    lines: [
      'BAY BASS — Marina riding the low end down by the harbour.',
      'Marina on BAY BASS — bass so deep the seagulls feel it.',
    ],
    tracks: ['Harbour Nights', 'Low Tide Bounce'],
  },
  {
    id: 'nights', name: 'SOLMARA NIGHTS', wave: 'triangle', bpm: 90,
    dj: 'Nocturne',
    lines: [
      'SOLMARA NIGHTS — Nocturne, keeping the city soft after dark.',
      'Nocturne here — slow synths for slow streets, only on NIGHTS.',
    ],
    tracks: ['Neon Palms', 'Two A.M. at the Bay'],
  },
];

// Simple minor-key step patterns (semitone offsets from the root).
const LEAD_PATTERNS = [
  [0, 3, 7, 10, 7, 3, 5, 7],
  [0, 7, 10, 12, 10, 7, 3, 5],
  [0, 3, 5, 7, 12, 10, 7, 5],
];
const BASS_NOTES = [0, 0, 5, 7];

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function initAudio(G) {
  G.audio = G.audio || {};
  // Restore saved radio state if the save module left it on G.saveData.
  const saved = G.saveData || null;
  G.audio.radioOn = !!(saved && saved.radioOn);
  G.audio.station = (saved && typeof saved.station === 'number')
    ? Math.max(0, Math.min(STATIONS.length - 1, saved.station))
    : 0;
  G.audio.ctx = null;
  G.audio.master = null;
  G.audio.engineOsc = null;
  G.audio.engineGain = null;
  G.audio.sirenTimer = 0;
  G.audio.djTimer = 45;
  G.audio.djLine = 0;
  G.audio.nextNoteTime = 0;
  G.audio.step = 0;
  G.audio.prevR = false;
  G.audio.started = false;

  G.helpers = G.helpers || {};
  G.helpers.playSound = (name) => playSound(G, name);
  G.helpers.toggleRadio = () => cycleRadio(G);
  G.helpers.resumeAudio = () => resumeAudio(G);
  G.helpers.setStation = (i) => {
    if (typeof i === 'number' && i >= 0 && i < STATIONS.length) {
      G.audio.station = i;
      G.audio.radioOn = true;
      G.audio.djTimer = 45;
      updateRadioBox(G);
    }
  };
  updateRadioBox(G);
}

function ensureCtx(G) {
  if (G.audio.ctx) return G.audio.ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    G.audio.ctx = ctx;
    G.audio.master = master;
    // Engine hum: a low sawtooth whose pitch follows driving speed.
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const filter = ctx.createLowpassFilter();
    filter.frequency.value = 320;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start();
    G.audio.engineOsc = osc;
    G.audio.engineGain = gain;
    return ctx;
  } catch (e) {
    // No usable WebAudio (e.g. headless shells with a stub AudioContext):
    // the game must still start — audio just stays silent.
    G.audio.ctx = null;
    return null;
  }
}

export function resumeAudio(G) {
  let ctx = null;
  try { ctx = ensureCtx(G); } catch (e) { ctx = null; }
  if (ctx && ctx.state === 'suspended') {
    try { ctx.resume(); } catch (e) { /* ignore */ }
  }
  G.audio.started = true;
}

function tone(G, freq, dur, type, vol, delay, slideTo) {
  const ctx = G.audio.ctx;
  if (!ctx || !G.audio.master) return;
  const t0 = ctx.currentTime + (delay || 0);
  const osc = ctx.createOscillator();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(G.audio.master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noiseBurst(G, dur, filterFreq, vol, delay, type) {
  const ctx = G.audio.ctx;
  if (!ctx || !G.audio.master) return;
  const t0 = ctx.currentTime + (delay || 0);
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = type || 'lowpass';
  filter.frequency.value = filterFreq || 800;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol || 0.3, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(G.audio.master);
  src.start(t0);
  src.stop(t0 + dur);
}

export function playSound(G, name) {
  if (!G.audio) return;
  // First user gesture may arrive via a sound (click); make sure we exist.
  if (!G.audio.started) {
    try { resumeAudio(G); } catch (e) { return; }
  }
  const ctx = G.audio.ctx;
  if (!ctx || ctx.state !== 'running') return;
  switch (name) {
    case 'shot':
      noiseBurst(G, 0.09, 2400, 0.35, 0, 'highpass');
      tone(G, 220, 0.07, 'square', 0.12, 0, 60);
      break;
    case 'explosion':
      noiseBurst(G, 0.7, 300, 0.6);
      tone(G, 90, 0.6, 'sine', 0.4, 0, 35);
      break;
    case 'siren':
      tone(G, 660, 0.28, 'sine', 0.10, 0);
      tone(G, 880, 0.28, 'sine', 0.10, 0.28);
      tone(G, 660, 0.28, 'sine', 0.10, 0.56);
      break;
    case 'pickup':
      tone(G, 660, 0.12, 'sine', 0.22, 0);
      tone(G, 990, 0.18, 'sine', 0.22, 0.12);
      break;
    case 'cash':
      tone(G, 880, 0.12, 'sine', 0.22, 0);
      tone(G, 1318, 0.22, 'sine', 0.22, 0.12);
      break;
    case 'click':
      tone(G, 1200, 0.05, 'square', 0.10, 0);
      break;
    case 'mission':
      tone(G, 523, 0.15, 'triangle', 0.25, 0);
      tone(G, 659, 0.15, 'triangle', 0.25, 0.15);
      tone(G, 784, 0.15, 'triangle', 0.25, 0.30);
      tone(G, 1046, 0.3, 'triangle', 0.25, 0.45);
      break;
    case 'engine':
      // Engine hum is continuous (see updateAudio); a one-shot call
      // just gives a short rev so the name is safe to call anywhere.
      tone(G, 70, 0.25, 'sawtooth', 0.10, 0, 140);
      break;
    case 'race':
      // Countdown beeps: three short, one long "GO".
      tone(G, 880, 0.12, 'square', 0.20, 0);
      tone(G, 880, 0.12, 'square', 0.20, 0.25);
      tone(G, 880, 0.12, 'square', 0.20, 0.50);
      tone(G, 1320, 0.35, 'square', 0.22, 0.75);
      break;
    case 'spike':
      // Tyre pop, then a deflating hiss.
      noiseBurst(G, 0.08, 1800, 0.5, 0, 'bandpass');
      noiseBurst(G, 0.6, 3500, 0.14, 0.08, 'highpass');
      break;
    case 'gull':
      // Golden chime arpeggio for a seagull statue.
      tone(G, 1046, 0.14, 'sine', 0.22, 0);
      tone(G, 1318, 0.14, 'sine', 0.22, 0.12);
      tone(G, 1568, 0.14, 'sine', 0.22, 0.24);
      tone(G, 2093, 0.35, 'sine', 0.22, 0.36);
      break;
    case 'weapon':
      // Click-clack of a weapon switch: two dry mechanical clicks.
      noiseBurst(G, 0.04, 3000, 0.25, 0, 'highpass');
      noiseBurst(G, 0.05, 2000, 0.3, 0.09, 'bandpass');
      break;
    default:
      tone(G, 440, 0.08, 'sine', 0.12, 0);
      break;
  }
}

function cycleRadio(G) {
  if (!G.audio.radioOn) {
    G.audio.radioOn = true;
    G.audio.station = 0;
  } else {
    G.audio.station = (G.audio.station + 1) % STATIONS.length;
  }
  G.audio.djTimer = 45;
  G.audio.step = 0;
  // Drop any notes already scheduled for the old station so the new
  // station starts clean instead of playing one stale bar.
  G.audio.nextNoteTime = 0;
  updateRadioBox(G);
  if (G.audio.radioOn) playSound(G, 'click');
}

function updateRadioBox(G) {
  const box = (G.hud && G.hud.el && G.hud.el['radio-box'])
    || document.getElementById('radio-box');
  if (!box) return;
  if (G.audio.radioOn) {
    const st = STATIONS[G.audio.station] || STATIONS[0];
    box.textContent = '♪ ' + st.name + ' — ' + st.tracks[G.audio.djLine % st.tracks.length];
    box.style.display = 'block';
  } else {
    box.textContent = '♪ RADIO OFF — press R';
  }
}

function radioNote(G, step) {
  const ctx = G.audio.ctx;
  if (!ctx || !G.audio.master) return;
  const st = STATIONS[G.audio.station] || STATIONS[0];
  const beat = 60 / st.bpm / 2; // eighth notes
  const t0 = G.audio.nextNoteTime;
  const pattern = LEAD_PATTERNS[G.audio.station % LEAD_PATTERNS.length];
  const root = 57 + (G.audio.station * 2); // A3-ish, varies per station
  const leadMidi = root + 12 + pattern[step % pattern.length];
  const osc = ctx.createOscillator();
  osc.type = st.wave;
  osc.frequency.value = midiToFreq(leadMidi);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + beat * 0.9);
  osc.connect(g);
  g.connect(G.audio.master);
  osc.start(t0);
  osc.stop(t0 + beat);
  // Bass on every other step.
  if (step % 2 === 0) {
    const bassMidi = root - 12 + BASS_NOTES[(step / 2) % BASS_NOTES.length];
    const bOsc = ctx.createOscillator();
    bOsc.type = 'sine';
    bOsc.frequency.value = midiToFreq(bassMidi);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.0001, t0);
    bg.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
    bg.gain.exponentialRampToValueAtTime(0.0001, t0 + beat * 1.8);
    bOsc.connect(bg);
    bg.connect(G.audio.master);
    bOsc.start(t0);
    bOsc.stop(t0 + beat * 2);
  }
  G.audio.nextNoteTime = t0 + beat;
}

export function updateAudio(G, dt) {
  if (!G.audio) return;
  const keys = (G.input && G.input.keys) || new Set();
  const rDown = keys.has('KeyR');
  if (rDown && !G.audio.prevR) cycleRadio(G);
  G.audio.prevR = rDown;

  const ctx = G.audio.ctx;
  if (!ctx || ctx.state !== 'running') return;

  // Engine hum follows speed: idle murmur on foot, rising rev in a car.
  if (G.audio.engineOsc && G.audio.engineGain) {
    const speed = (G.state && (G.state.speed || 0)) || 0;
    const driving = !!(G.state && G.state.inVehicle);
    const target = driving ? 55 + speed * 2.2 : 40;
    const vol = driving ? 0.05 + Math.min(0.10, speed * 0.002) : 0.02;
    G.audio.engineOsc.frequency.setTargetAtTime(target, ctx.currentTime, 0.1);
    G.audio.engineGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.1);
  }

  // Siren wail while the law is after the player (every ~1.1s at 2+ stars).
  if (G.state && (G.state.wanted || 0) >= 2) {
    G.audio.sirenTimer -= dt;
    if (G.audio.sirenTimer <= 0) {
      playSound(G, 'siren');
      G.audio.sirenTimer = 1.1;
    }
  } else {
    G.audio.sirenTimer = 0;
  }

  // Radio: schedule chiptune notes ahead of the playhead.
  if (G.audio.radioOn) {
    if (G.audio.nextNoteTime < ctx.currentTime + 0.15) {
      if (G.audio.nextNoteTime < ctx.currentTime) {
        G.audio.nextNoteTime = ctx.currentTime + 0.05;
      }
      radioNote(G, G.audio.step);
      G.audio.step++;
    }
    // DJ ident every ~45s while the radio is on.
    G.audio.djTimer -= dt;
    if (G.audio.djTimer <= 0) {
      G.audio.djTimer = 45;
      const st = STATIONS[G.audio.station] || STATIONS[0];
      const line = st.lines[G.audio.djLine % st.lines.length];
      const track = st.tracks[G.audio.djLine % st.tracks.length];
      G.audio.djLine++;
      if (G.helpers && G.helpers.showBanner) {
        G.helpers.showBanner(st.name + ' — DJ ' + st.dj, line + ' ♪ ' + track);
      }
      updateRadioBox(G);
    }
  }
}
