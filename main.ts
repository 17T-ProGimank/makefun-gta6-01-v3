// SOLMARA round 5 — build entrypoint (main.ts, stdlib only + vendor/makefun-game.ts)
// 15 missions, street races, 12 Golden Seagulls, spike strips, bribes,
// 3 weapons, crew of 3, garage, respect ranks, 3-slot save, 4 radio stations.
// Copies game/ + screenshots/ into $MAKEFUN_OUTPUT_DIR and writes
// dossier.json via buildDossier from vendor/makefun-game.ts.
// Deterministic: no timestamps, no random ids, fixed file order.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.MAKEFUN_OUTPUT_DIR || join(__dirname, 'out');
const SRC = __dirname;

function listFiles(dir, rel = '') {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    if (name === 'node_modules' || name === 'out' || name.startsWith('.git')) continue;
    const full = join(dir, name);
    const r = rel ? rel + '/' + name : name;
    if (statSync(full).isDirectory()) out.push(...listFiles(full, r));
    else out.push(r);
  }
  return out;
}

function main() {
  mkdirSync(OUT, { recursive: true });
  // game/ — the whole playable game, copied verbatim.
  for (const rel of listFiles(join(SRC, 'game'))) {
    const dest = join(OUT, 'game', rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(SRC, 'game', rel), dest);
  }
  // screenshots/ — the 4 staged shots, if present.
  const shotsDir = join(SRC, 'screenshots');
  if (existsSync(shotsDir)) {
    for (const rel of listFiles(shotsDir)) {
      const dest = join(OUT, 'screenshots', rel);
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(join(shotsDir, rel), dest);
    }
  }
  // dossier.json — buildDossier(dir, caps) returns canonical JSON bytes
  // (Uint8Array) for the entry at dir, reading dir/game/ + dir/screenshots/.
  const dossier = buildDossier(SRC, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648
  });
  writeFileSync(join(OUT, 'dossier.json'), dossier);
  console.log('SOLMARA round 5 -> ' + OUT);
  console.log('files: ' + listFiles(OUT).length + ' · dossier bytes: ' + dossier.length);
}

main();
