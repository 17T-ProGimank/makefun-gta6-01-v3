// SOLMARA round 5 — dev server (serve.ts, stdlib only).
// Serves game/ on http://localhost:8080 so the game can be played and
// screenshotted locally. Usage: node serve.ts [port]
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, 'game');
const PORT = Number(process.argv[2] || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const path = url === '/' ? '/index.html' : url;
  const file = join(ROOT, path);
  if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found: ' + path);
    return;
  }
  res.writeHead(200, {
    'content-type': MIME[extname(file)] || 'application/octet-stream',
    // Dev server: never cache, so a rebuild is picked up on refresh.
    'cache-control': 'no-cache, no-store, must-revalidate'
  });
  res.end(readFileSync(file));
});

server.listen(PORT, () => console.log('SOLMARA dev server: http://localhost:' + PORT + '/'));
