// SOLMARA — Open-World Crime Game (round 5)
// Entrypoint: creates the renderer/scene/camera, builds the shared G
// context, inits every module once, then runs the loop in the fixed
// update order. 15 missions, street races, 12 Golden Seagulls, spike
// strips, bribes, 3 weapons, crew of 3, garage, respect ranks, 3-slot save.
import { CONFIG } from './config.js';
import { initInput, updateInput } from './input.js';
import { buildCity } from './city.js';
import { initPlayer, updatePlayer } from './player.js';
import { initVehicles, updateVehicles } from './vehicles.js';
import { initPedestrians, updatePedestrians } from './pedestrians.js';
import { initPolice, updatePolice } from './police.js';
import { initMissions, updateMissions } from './missions.js';
import { initCrew, updateCrew } from './crew.js';
import { initGarage, updateGarage } from './garage.js';
import { initRespect, updateRespect } from './respect.js';
import { initCollectibles, updateCollectibles } from './collectibles.js';
import { initCombat, updateCombat } from './combat.js';
import { initEffects, updateEffects } from './effects.js';
import { initHUD, updateHUD } from './hud.js';
import { initAudio, updateAudio } from './audio.js';
import { initMenus, updateMenus, refreshSlotButtons } from './menus.js';
import { initSave } from './save.js';
import { applyShot } from './shots.js';

const app = document.getElementById('app');

// --- Renderer / scene / camera -------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.colors.skyTop);
scene.fog = new THREE.Fog(0xff9a3c, 180, 520);

const camera = new THREE.PerspectiveCamera(
  62, window.innerWidth / window.innerHeight, 0.1, 900
);
camera.position.set(0, 6, 14);

const clock = new THREE.Clock();

// --- Shared context G ------------------------------------------------------
const G = {
  scene, camera, renderer, clock,
  config: CONFIG,
  state: {
    money: CONFIG.money.start, wanted: 0, health: CONFIG.player.health,
    missionIndex: 0, objectiveText: '', objectiveTarget: null,
    started: false, paused: false, gameOver: false,
    time: 0, speed: 0, inVehicle: null, kills: 0, carsStolen: 0,
    nearGarage: false, inSafehouse: false,
    // Round 5: wanted depth + race/lockpick state
    spikeSlowUntil: 0, bribeAvailable: false, spikeAhead: false,
    lockpickProgress: 0
  },
  player: { group: null, pos: new THREE.Vector3(0, 0, 0), heading: 0, speed: 0, onFoot: true },
  cars: [],
  peds: [],
  police: { cars: [], heli: null, roadblocks: [] },
  missions: { list: [], currentIndex: 0, current: null, lockpick: 0 },
  audio: { ctx: null, master: null, radioOn: false, station: 0 },
  hud: { el: {} },
  city: { bounds: CONFIG.city.size / 2, roads: [], spawnPoints: {} },
  input: { keys: new Set(), mouseDX: 0 },
  helpers: {},
  // Round 4 systems
  crew: { members: ['mara'], active: null },
  garage: { owned: [], active: 0 },
  respect: { points: 0 },
  save: { slot: 1 },
  // Round 5 systems
  race: { active: false, checkpoints: [], current: 0, startTime: 0, parTime: 90 },
  collectibles: { found: [] },
  weapons: { owned: ['pistol'], current: 'pistol' }
};

// --- Init (each module exactly once) ---------------------------------------
buildCity(G);
initInput(G);
initPlayer(G);
initVehicles(G);
initPedestrians(G);
initPolice(G);
initMissions(G);
initCrew(G);
initGarage(G);
initRespect(G);
initCollectibles(G);
initCombat(G);
initEffects(G);
initHUD(G);
initAudio(G);
initMenus(G);
initSave(G);
// initMenus refreshed the slot buttons before initSave attached listSaves,
// so refresh again now that saves are readable.
refreshSlotButtons(G);

// --- Resize + pause --------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.state.started && !G.state.gameOver) {
    G.state.paused = true;
    // Autosave when the tab is hidden so progress is never lost to a crash.
    if (G.helpers.saveGame) { try { G.helpers.saveGame(); } catch (e) { /* save is best-effort */ } }
  }
});

// --- Main loop (fixed update order) ----------------------------------------
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (G.state.started && !G.state.paused && !G.state.gameOver) {
    G.state.time += dt;
    updateInput(G, dt);
    updatePlayer(G, dt);
    updateVehicles(G, dt);
    updatePedestrians(G, dt);
    updatePolice(G, dt);
    updateMissions(G, dt);
    updateCrew(G, dt);
    updateGarage(G, dt);
    updateRespect(G, dt);
    updateCollectibles(G, dt);
    updateCombat(G, dt);
    updateEffects(G, dt);
    updateHUD(G, dt);
    updateAudio(G, dt);
  }
  updateMenus(G, dt);
  renderer.render(scene, camera);
}
loop();

// --- Screenshot hook (?shot=cover|mission|activity|city) --------------------
const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  setTimeout(() => applyShot(G, shot), 1200);
}
