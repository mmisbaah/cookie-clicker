/**
 * Static file server.
 *
 * No dependencies, on purpose. This game is entirely client-side and has no
 * build step, so the only thing a server has to do is hand three kinds of file to
 * the browser:
 *
 *   /            -> public/
 *   /src/...     -> public/src/...   (ES modules)
 *   /shared/...  -> shared/...        (the rules layer, imported by the client)
 *
 * That last one is why the `shared/` directory is a sibling of `public/` rather
 * than nested inside it: the client imports `../../shared/economy.js` directly, so
 * the test suite and the browser are provably running the same code. There is no
 * bundler, no copy step, and nothing to keep in sync.
 *
 * `node server/serve.js` and open the printed URL.
 */

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PUBLIC = join(ROOT, 'public');
const SHARED = join(ROOT, 'shared');
const PORT = Number(process.env.PORT ?? 5173);
const HOST = process.env.HOST ?? '127.0.0.1';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/**
 * Resolve a URL path to a file, or null.
 *
 * The containment check is the point of this function. `join` alone will happily
 * resolve `../../etc/passwd` out of the served root; comparing the resolved path
 * against the root prefix is what stops it. Both roots are checked because
 * `/shared/` is a second mount point.
 */
async function resolveFile(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null; // a malformed percent-escape is a bad request, not a crash
  }

  if (decoded === '/' || decoded === '') decoded = '/index.html';

  const sharedMount = decoded.startsWith('/shared/');
  const base = sharedMount ? SHARED : PUBLIC;
  const relative = sharedMount ? decoded.slice('/shared'.length) : decoded;

  // normalize() collapses `..` segments before the prefix check, so the check
  // below is on a path that can no longer climb out.
  const target = resolve(join(base, normalize(relative)));
  if (target !== base && !target.startsWith(base + sep)) return null;

  try {
    const info = await stat(target);
    if (!info.isFile()) return null;
    return { path: target, size: info.size };
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' }).end('Method Not Allowed');
    return;
  }

  const file = await resolveFile(req.url ?? '/');
  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      .end('404 — not found');
    return;
  }

  const type = TYPES[extname(file.path).toLowerCase()] ?? 'application/octet-stream';

  res.writeHead(200, {
    'content-type': type,
    'content-length': file.size,
    // Never cache during development: a stale module is indistinguishable from a
    // bug, and it is the single most annoying failure mode when a game is split
    // across a dozen ES modules.
    'cache-control': 'no-store',
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  createReadStream(file.path)
    .on('error', () => res.destroy())
    .pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`\n  🍪  Cookie Empire`);
  console.log(`  →  http://${HOST}:${PORT}\n`);
  console.log(`  serving  public/  at /`);
  console.log(`           shared/  at /shared/   (the same modules the tests import)\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
